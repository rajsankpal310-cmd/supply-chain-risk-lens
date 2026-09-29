/**
 * NEXUS-CFR Machine Learning Controller
 * Phase 4: Production ML Foundation
 *
 * Exposes governed ML endpoints with strict tenant isolation and role checks.
 */

import { Request, Response } from "express";
import { TARGET_REGISTRY } from "../ml/targets/targetRegistry";
import { FEATURE_SPECIFICATIONS } from "../ml/features/featureEligibility";
import { MLPipelineService } from "../ml/pipeline/mlPipelineService";
import { MultiTenantModelRegistry, ModelLifecycleState } from "../ml/registry/modelRegistry";
import { PredictionService, MLUnavailableError } from "../ml/prediction/predictionService";
import { DEFAULT_THRESHOLD_POLICIES } from "../ml/prediction/riskBands";
import { DriftMonitor } from "../ml/monitoring/driftMonitor";
import { prisma } from "../config/database";
import { DataArrivalContractEvaluator } from "../ml/contracts/dataArrivalContract";
import { DuplicateLeakageGuard } from "../ml/datasets/duplicateLeakageGuard";
import { AntiLeakageAuditor } from "../ml/features/featureEligibility";
import { FeatureEngine } from "../ml/features/featureEngine";
import { FirstEvidencePipeline } from "../ml/pipeline/firstEvidencePipeline";
import { SourceRegistry } from "../connectors/sourceRegistry";

export class MLController {
  /**
   * GET /api/ml/targets
   */
  public static async getTargets(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        targets: Object.values(TARGET_REGISTRY),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/ml/features
   */
  public static async getFeatures(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        features: Object.values(FEATURE_SPECIFICATIONS),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/ml/readiness
   */
  public static async getReadiness(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const targetId = (req.query.targetId as string) || "PAYMENT_DELAY_RISK";

      const report = await MLPipelineService.assessReadiness(organizationId, targetId);
      res.json({ success: true, report });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/ml/pipeline/run
   */
  public static async runPipeline(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const userRole = (req as any).user?.role || "ANALYST";

      if (userRole === "VIEWER") {
        res.status(403).json({ success: false, error: "VIEWER role is not authorized to execute ML training pipeline." });
        return;
      }

      const { targetId, forceSimulatedSmokeTest } = req.body;

      const result = await MLPipelineService.runTrainingPipeline({
        organizationId,
        targetId,
        forceSimulatedSmokeTest: Boolean(forceSimulatedSmokeTest),
      });

      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/ml/models
   */
  public static async listModels(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const models = MultiTenantModelRegistry.listModelsForTenant(organizationId);
      res.json({ success: true, models });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/ml/models/:modelId
   */
  public static async getModelDetails(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const modelId = String(req.params.modelId);

      const model = MultiTenantModelRegistry.getModel(organizationId, modelId);
      if (!model) {
        res.status(404).json({ success: false, error: `Model ${modelId} not found for this organization.` });
        return;
      }

      res.json({ success: true, model });
    } catch (err: any) {
      res.status(403).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/ml/models/:modelId/transition
   */
  public static async transitionModelLifecycle(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const userRole = (req as any).user?.role || "ANALYST";
      const modelId = String(req.params.modelId);
      const { newState, notes, allowSimulatedDemo } = req.body;

      const isDemoAuthorized =
        allowSimulatedDemo === true ||
        req.headers["x-ml-demo-mode"] === "true" ||
        (process.env.NODE_ENV === "test" && allowSimulatedDemo !== false);

      const updated = MultiTenantModelRegistry.transitionLifecycle(
        organizationId,
        modelId,
        newState as ModelLifecycleState,
        userRole,
        notes,
        isDemoAuthorized
      );

      res.json({ success: true, model: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/ml/predict
   */
  public static async predictInvoice(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const { invoiceId, targetId, allowFallback } = req.body;

      const invoice = await prisma.transaction.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice || invoice.organizationId !== organizationId) {
        res.status(404).json({ success: false, error: "Invoice not found or tenant unauthorized." });
        return;
      }

      const allTxs = await prisma.transaction.findMany({
        where: { organizationId },
      });

      const prediction = PredictionService.predictInvoice(
        {
          organizationId,
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.transactionId || invoice.id,
            organizationId: invoice.organizationId,
            supplierId: invoice.supplierId || invoice.smeId,
            buyerId: invoice.buyerId,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            invoiceAmount: Number(invoice.invoiceAmount),
            paymentDate: invoice.paymentDate,
            paymentDelayDays: invoice.paymentDelayDays,
            status: invoice.paymentStatus,
          },
          historicalTransactions: allTxs.map((t) => ({
            id: t.id,
            invoiceNumber: t.transactionId || t.id,
            organizationId: t.organizationId,
            supplierId: t.supplierId || t.smeId,
            buyerId: t.buyerId,
            invoiceDate: t.invoiceDate,
            dueDate: t.dueDate,
            invoiceAmount: Number(t.invoiceAmount),
            paymentDate: t.paymentDate,
            paymentDelayDays: t.paymentDelayDays,
            status: t.paymentStatus,
          })),
          targetId: targetId || "PAYMENT_DELAY_RISK",
        },
        Boolean(allowFallback)
      );

      res.json({ success: true, prediction });
    } catch (err: any) {
      if (err instanceof MLUnavailableError || err.code === "NO_APPROVED_MODEL") {
        res.status(422).json({
          success: false,
          status: "ML_UNAVAILABLE",
          code: "NO_APPROVED_MODEL",
          error: err.message,
          isModelPrediction: false,
          inferenceType: "NON_ML_FALLBACK",
          governanceNotice: "NOT_FOR_PRODUCTION_DECISIONING",
        });
        return;
      }
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/ml/monitoring
   */
  public static async getMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const deployed = MultiTenantModelRegistry.getDeployedModel(organizationId, "PAYMENT_DELAY_RISK");

      if (!deployed) {
        res.json({
          success: true,
          status: "INACTIVE",
          message: "No production model currently deployed for monitoring.",
        });
        return;
      }

      // Sample monitoring report
      const monitoringReport = DriftMonitor.generateMonitoringReport(
        organizationId,
        deployed.modelId,
        { invoiceAmount: [100000, 250000, 500000, 750000, 1000000] },
        { invoiceAmount: [110000, 260000, 490000, 780000, 1050000] },
        [0.15, 0.22, 0.45, 0.62, 0.81],
        12
      );

      res.json({ success: true, monitoringReport });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/ml/risk-bands
   */
  /**
   * GET /api/ml/risk-bands
   */
  public static async getRiskBands(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        policies: Object.values(DEFAULT_THRESHOLD_POLICIES),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/ml/data-arrival/assessment
   */
  public static async getDataArrivalAssessment(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      const transactions = await prisma.transaction.findMany({ where: { organizationId } });

      const dupAudit = DuplicateLeakageGuard.auditDuplicates(
        transactions.map((t) => ({
          id: t.id,
          invoiceNumber: t.transactionId || t.id,
          supplierId: t.supplierId || t.smeId,
          buyerId: t.buyerId,
          invoiceAmount: Number(t.invoiceAmount),
          invoiceDate: t.invoiceDate,
        }))
      );

      const leakageAudit = AntiLeakageAuditor.auditFeatureCandidateList(FeatureEngine.ACTIVE_NUMERIC_FEATURES);

      const assessment = DataArrivalContractEvaluator.evaluateArrival({
        sourceType: "SIMULATED_BENCHMARK",
        sourceSystem: "CONTROLLED_FILE_EXPORT",
        organizationId,
        provenanceClassification: (org as any)?.provenanceClassification || "SIMULATED_BENCHMARK",
        isEnterpriseAuthorized: (org as any)?.isEnterpriseAuthorized ?? false,
        hasActiveLegalConsent: (org as any)?.hasActiveLegalConsent ?? false,
        invoices: transactions.map((t) => ({
          id: t.id,
          invoiceNumber: t.transactionId || t.id,
          supplierId: t.supplierId || t.smeId,
          buyerId: t.buyerId,
          invoiceDate: t.invoiceDate,
          dueDate: t.dueDate,
          invoiceAmount: Number(t.invoiceAmount),
          paymentDate: t.paymentDate,
          paymentDelayDays: t.paymentDelayDays,
        })),
        duplicateCount: dupAudit.duplicateVouchersCount,
        leakageViolations: leakageAudit.violations.map((v) => v.reason),
      });

      res.json({ success: true, assessment });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/ml/data-arrival/dry-run
   */
  public static async runDataArrivalDryRun(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const userRole = (req as any).user?.role || "ANALYST";

      if (userRole === "VIEWER") {
        res.status(403).json({ success: false, error: "VIEWER role cannot trigger dry run." });
        return;
      }

      // Execute ML pipeline in non-production simulation mode
      const dryRunResult = await MLPipelineService.runTrainingPipeline({
        organizationId,
        targetId: "PAYMENT_DELAY_RISK",
        forceSimulatedSmokeTest: true,
      });

      res.json({
        success: true,
        dryRunMode: "SIMULATED DRY RUN — NOT ML EVIDENCE",
        disclaimer:
          "TECHNICAL VERIFICATION ONLY: This dry run exercises the end-to-end data ingestion, target formulation, chronological splitting, and model registration pipeline using architectural benchmark records. It does NOT represent genuine SME credit risk evidence.",
        result: dryRunResult,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/ml/models/:modelId/rollback
   */
  public static async rollbackModel(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const userRole = (req as any).user?.role || "ANALYST";
      const { targetId, notes } = req.body;
      const modelId = String(req.params.modelId);

      const rollback = MultiTenantModelRegistry.rollbackProductionModel(
        organizationId,
        targetId || "PAYMENT_DELAY_RISK",
        modelId,
        userRole,
        notes || "Production model rollback executed."
      );

      res.json({ success: true, rollback });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/ml/evidence/run
   * Phase 5: Real Authorized Data Acquisition & First Evidence Run
   */
  public static async executeEvidenceRun(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";
      const userRole = (req as any).user?.role || "VIEWER";
      const actorEmail = (req as any).user?.email || "auditor@nexuscfr.in";
      const { targetId, forceSimulatedDryRun } = req.body;

      // Governance: Only ADMIN or ANALYST can trigger evidence runs
      if (userRole === "VIEWER") {
        res.status(403).json({ success: false, error: "Unauthorized: Viewers cannot trigger ML evidence runs." });
        return;
      }

      // Check if organization has real authorized data sources
      const sources = SourceRegistry.listSourcesForTenant(organizationId);
      const authorizedSource = sources.find((s) => s.isEnterpriseAuthorized && s.provenance === "REAL_OBSERVED_ENTERPRISE");

      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      const isOrgAuthorized = Boolean((org as any)?.isEnterpriseAuthorized || authorizedSource?.isEnterpriseAuthorized);
      const provenance = authorizedSource?.provenance || (org as any)?.provenanceClassification || "SIMULATED_BENCHMARK";

      const transactions = await prisma.transaction.findMany({ where: { organizationId } });

      const rawInvoices = transactions.map((t) => ({
        id: t.id,
        invoiceNumber: t.transactionId || t.id,
        organizationId: t.organizationId,
        supplierId: t.supplierId || t.smeId,
        buyerId: t.buyerId,
        invoiceDate: t.invoiceDate,
        dueDate: t.dueDate,
        invoiceAmount: Number(t.invoiceAmount),
        paymentDate: t.paymentDate,
        paymentDelayDays: t.paymentDelayDays,
        status: t.paymentStatus,
      }));

      const evidenceResult = await FirstEvidencePipeline.executeEvidenceRun({
        organizationId,
        targetId: targetId || "PAYMENT_DELAY_RISK",
        rawInvoices,
        isEnterpriseAuthorized: isOrgAuthorized,
        provenanceClassification: provenance,
        actorEmail,
        forceSimulatedDryRun: Boolean(forceSimulatedDryRun),
      });

      res.json({
        success: true,
        evidenceResult,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/ml/evidence/status
   * Phase 5: Real Data & Readiness Status
   */
  public static async getEvidenceStatus(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || "ORG-003";

      const sources = SourceRegistry.listSourcesForTenant(organizationId);
      const authorizedSources = sources.filter((s) => s.isEnterpriseAuthorized);
      const realSources = sources.filter((s) => s.provenance === "REAL_OBSERVED_ENTERPRISE");

      const txCount = await prisma.transaction.count({ where: { organizationId } });
      const completedCount = await prisma.transaction.count({
        where: { organizationId, paymentDate: { not: null } },
      });

      const hasRealAuthorizedData = authorizedSources.length > 0 && realSources.length > 0 && completedCount >= 1000;

      res.json({
        success: true,
        organizationId,
        hasRealAuthorizedData,
        overallMLStatus: hasRealAuthorizedData ? "READY_FOR_EVIDENCE_RUN" : "LOCKED",
        registeredSourcesCount: sources.length,
        authorizedSourcesCount: authorizedSources.length,
        totalTransactions: txCount,
        completedTransactions: completedCount,
        blockers: hasRealAuthorizedData
          ? []
          : [
              ...(authorizedSources.length === 0 ? ["No authorized enterprise source connected."] : []),
              ...(completedCount < 1000 ? [`Underpowered dataset: ${completedCount} completed invoices observed (requires ≥ 1,000).`] : []),
            ],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
