/**
 * NEXUS-CFR Governed Prediction Service
 * Phase 4 & Phase 6: Production ML Foundation & Hardened Prediction Safety
 *
 * Serves real-time or batch explainable predictions using approved deployed models.
 * Output includes model version, feature version, calibrated risk probability,
 * governed risk band, mathematical explanation, and full provenance tracking.
 *
 * CRITICAL SAFETY GATE:
 * If no approved production model exists, ML_UNAVAILABLE is returned.
 * Non-ML heuristic fallbacks are strictly labeled:
 * - NON_ML_FALLBACK
 * - NOT_A_MODEL_PREDICTION
 * - NOT_FOR_PRODUCTION_DECISIONING
 */

import { MultiTenantModelRegistry } from "../registry/modelRegistry";
import { FeatureEngine, RawInvoiceRecord, ExtractedFeatureSnapshot } from "../features/featureEngine";
import { LogisticRegressionClassifier, StandardFeatureScaler } from "../models/baselineModels";
import { ModelExplainer, LocalExplanation } from "../explainability/explainer";
import { RiskBandManager, RiskBandClassification, DEFAULT_THRESHOLD_POLICIES } from "./riskBands";
import { ProbabilityCalibrator } from "../models/calibration";
import { LineageTracker, PredictionLineageRecord } from "../lineage/lineageTracker";
import { AuditLogService } from "../../pipeline/auditLogService";

export interface PredictionRequest {
  organizationId: string;
  invoice: RawInvoiceRecord;
  historicalTransactions: RawInvoiceRecord[];
  targetId?: string;
}

export class MLUnavailableError extends Error {
  public readonly code = "NO_APPROVED_MODEL";
  public readonly status = "ML_UNAVAILABLE";
  public readonly organizationId: string;
  public readonly targetId: string;

  constructor(organizationId: string, targetId: string) {
    super(
      `Production ML Locked: No APPROVED and DEPLOYED model found for organization '${organizationId}' and target '${targetId}'.`
    );
    this.name = "MLUnavailableError";
    this.organizationId = organizationId;
    this.targetId = targetId;
  }
}

export interface GovernedPredictionResult {
  isModelPrediction: true;
  inferenceType: "APPROVED_ML_MODEL";
  invoiceId: string;
  organizationId: string;
  targetId: string;
  modelId: string;
  modelVersion: string;
  featureVersion: string;
  predictionTimestamp: string;
  rawScore: number;
  riskProbability: number;
  isCalibrated: boolean;
  riskBand: RiskBandClassification;
  isProvisionalThreshold: boolean;
  explanation: LocalExplanation;
  dataQualityStatus: "VERIFIED" | "INSUFFICIENT_HISTORY" | "PROVISIONAL";
  disclaimer: string;
  predictionLineage: PredictionLineageRecord;
}

export interface GovernedFallbackPredictionResult {
  isModelPrediction: false;
  inferenceType: "NON_ML_FALLBACK";
  status: "ML_UNAVAILABLE";
  reasonCode: "NO_APPROVED_MODEL";
  warningLabel: "NOT_A_MODEL_PREDICTION";
  policyNotice: "NOT_FOR_PRODUCTION_DECISIONING";
  disclaimer: string;
  invoiceId: string;
  organizationId: string;
  targetId: string;
  heuristicRiskScore: number;
  heuristicRiskBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  heuristicExplanation: string;
  predictionTimestamp: string;
}

export class PredictionService {
  /**
   * Generates a fully governed, explainable prediction for an invoice with fail-safe guards.
   */
  public static predictInvoice(
    req: PredictionRequest,
    allowFallback = false
  ): GovernedPredictionResult | GovernedFallbackPredictionResult {
    // 1. Data Quality Gate for Input Invoice
    const amt = Number(req.invoice.invoiceAmount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error(
        `DATA QUALITY BLOCK: Invoice '${req.invoice.id}' has non-positive amount (${amt}). Production ML rejects invalid financial records.`
      );
    }

    if (!req.invoice.invoiceDate || !req.invoice.dueDate) {
      throw new Error(
        `DATA QUALITY BLOCK: Invoice '${req.invoice.id}' missing mandatory date fields (invoiceDate or dueDate).`
      );
    }

    const invTime = new Date(req.invoice.invoiceDate).getTime();
    const dueTime = new Date(req.invoice.dueDate).getTime();
    if (dueTime <= invTime) {
      throw new Error(
        `DATA QUALITY BLOCK: Invoice '${req.invoice.id}' has non-positive credit duration (dueDate <= invoiceDate).`
      );
    }

    // 2. Governed Model Retrieval
    const targetId = req.targetId || "PAYMENT_DELAY_RISK";
    const deployedModel = MultiTenantModelRegistry.getDeployedModel(req.organizationId, targetId);

    if (!deployedModel) {
      if (allowFallback) {
        AuditLogService.logEvent({
          organizationId: req.organizationId,
          eventType: "FALLBACK_INFERENCE_DISPATCHED",
          actor: "prediction-service",
          status: "WARNING",
          entityId: req.invoice.id,
          entityType: "INFERENCE",
          details: `ML unavailable (no approved model for ${targetId}). Dispatched NON_ML_FALLBACK with strict governance labeling.`,
        });
        return this.generateFallbackPrediction(req);
      }

      AuditLogService.logEvent({
        organizationId: req.organizationId,
        eventType: "PRODUCTION_INFERENCE_BLOCKED",
        actor: "prediction-service",
        status: "BLOCKED",
        entityId: req.invoice.id,
        entityType: "INFERENCE",
        details: `Production ML Locked: No APPROVED model for organization '${req.organizationId}', target '${targetId}'.`,
      });

      throw new MLUnavailableError(req.organizationId, targetId);
    }

    // 3. Model Integrity Check
    const integrityOk = MultiTenantModelRegistry.verifyModelIntegrity(req.organizationId, deployedModel.modelId);
    if (!integrityOk) {
      throw new Error(
        `FATAL MODEL INTEGRITY FAILURE: Checksum verification failed for model '${deployedModel.modelId}'. Artifact may be corrupted.`
      );
    }

    // 4. Feature Extraction strictly pre-t0
    const featureSnapshot: ExtractedFeatureSnapshot = FeatureEngine.extractFeaturesForInvoice(
      req.invoice,
      req.historicalTransactions
    );

    // 5. Version Compatibility Guard
    if (deployedModel.featureVersion !== featureSnapshot.featureVersion) {
      throw new Error(
        `VERSION MISMATCH ERROR: Deployed model expects feature version '${deployedModel.featureVersion}', but feature engine extracted '${featureSnapshot.featureVersion}'.`
      );
    }

    // 6. Rehydrate model from artifact weights
    const classifier = new LogisticRegressionClassifier();
    if (deployedModel.serializedWeights) {
      const parsed = JSON.parse(deployedModel.serializedWeights);
      (classifier as any).weights = parsed.weights;
      (classifier as any).bias = parsed.bias;
      (classifier as any).scaler = parsed.scaler;
      (classifier as any).featureNames = parsed.featureNames;
    }

    const rawScore = classifier.predictRawScore(featureSnapshot.featureVector);
    let riskProbability = classifier.predictProbability(featureSnapshot.featureVector);
    let isCalibrated = false;

    // Apply Platt calibration if model was calibrated
    if (deployedModel.calibration.status === "CALIBRATED" && deployedModel.calibration.plattParameters) {
      riskProbability = ProbabilityCalibrator.applyPlattScaling(
        rawScore,
        deployedModel.calibration.plattParameters.a,
        deployedModel.calibration.plattParameters.b
      );
      isCalibrated = true;
    }

    // 7. Classify into governed risk band
    const policy = DEFAULT_THRESHOLD_POLICIES[targetId] || DEFAULT_THRESHOLD_POLICIES.PAYMENT_DELAY_RISK;
    const bandInfo = RiskBandManager.classifyRisk(riskProbability, policy);

    // 8. Generate local feature explanation
    const explanation = ModelExplainer.explainInvoicePrediction(
      classifier,
      featureSnapshot.featureVector,
      featureSnapshot.features,
      bandInfo.riskBand
    );

    const buyerHistoryCount = featureSnapshot.features.buyerSettledCountPreT0 || 0;
    const dataQualityStatus = buyerHistoryCount >= 5 ? "VERIFIED" : "INSUFFICIENT_HISTORY";

    // 9. Cryptographic Prediction Lineage
    const predictionLineage = LineageTracker.createPredictionLineage({
      organizationId: req.organizationId,
      invoiceId: req.invoice.id,
      buyerId: req.invoice.buyerId,
      supplierId: req.invoice.supplierId,
      modelId: deployedModel.modelId,
      modelVersion: deployedModel.version,
      modelChecksum: deployedModel.checksum,
      datasetId: deployedModel.datasetId,
      datasetVersion: deployedModel.datasetVersion,
      featureVersion: featureSnapshot.featureVersion,
      featureSnapshotHash: featureSnapshot.snapshotHash,
      predictedProbability: parseFloat(riskProbability.toFixed(4)),
      riskBand: bandInfo.riskBand,
      featuresUsed: featureSnapshot.features,
      featureLineages: [],
    });

    AuditLogService.logEvent({
      organizationId: req.organizationId,
      eventType: "PRODUCTION_INFERENCE_INVOKED",
      actor: "prediction-service",
      status: "SUCCESS",
      entityId: req.invoice.id,
      entityType: "INFERENCE",
      details: `Inference executed using approved model ${deployedModel.modelId} (Prob: ${(riskProbability * 100).toFixed(1)}%).`,
      metadata: { modelId: deployedModel.modelId, riskBand: bandInfo.riskBand },
    });

    return {
      isModelPrediction: true,
      inferenceType: "APPROVED_ML_MODEL",
      invoiceId: req.invoice.id,
      organizationId: req.organizationId,
      targetId,
      modelId: deployedModel.modelId,
      modelVersion: deployedModel.version,
      featureVersion: featureSnapshot.featureVersion,
      predictionTimestamp: new Date().toISOString(),
      rawScore: parseFloat(rawScore.toFixed(4)),
      riskProbability: parseFloat(riskProbability.toFixed(4)),
      isCalibrated,
      riskBand: bandInfo.riskBand,
      isProvisionalThreshold: bandInfo.isProvisional,
      explanation,
      dataQualityStatus,
      predictionLineage,
      disclaimer:
        "DECISION SUPPORT ONLY: Predictions represent statistical default or delay likelihoods based strictly on historical trade behavior. Does not constitute guaranteed financial advice.",
    };
  }

  /**
   * Generates a clearly labeled non-ML fallback heuristic response.
   */
  public static generateFallbackPrediction(req: PredictionRequest): GovernedFallbackPredictionResult {
    const targetId = req.targetId || "PAYMENT_DELAY_RISK";
    const amt = Number(req.invoice.invoiceAmount) || 0;

    // Simple heuristic calculation based on historical overdue proportion
    const buyerHistory = req.historicalTransactions.filter((t) => t.buyerId === req.invoice.buyerId);
    let delayedCount = 0;
    buyerHistory.forEach((t) => {
      if (t.paymentDelayDays && t.paymentDelayDays > 15) delayedCount++;
    });

    const overdueFraction = buyerHistory.length > 0 ? delayedCount / buyerHistory.length : 0.25;
    const heuristicScore = Math.min(0.95, Math.max(0.05, overdueFraction));

    let heuristicRiskBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (heuristicScore > 0.75) heuristicRiskBand = "CRITICAL";
    else if (heuristicScore > 0.5) heuristicRiskBand = "HIGH";
    else if (heuristicScore > 0.25) heuristicRiskBand = "MEDIUM";

    return {
      isModelPrediction: false,
      inferenceType: "NON_ML_FALLBACK",
      status: "ML_UNAVAILABLE",
      reasonCode: "NO_APPROVED_MODEL",
      warningLabel: "NOT_A_MODEL_PREDICTION",
      policyNotice: "NOT_FOR_PRODUCTION_DECISIONING",
      disclaimer:
        "NON_ML_FALLBACK: This output is a heuristic benchmark generated because Production ML is LOCKED with no approved model. It must NOT be used for automated credit decisioning.",
      invoiceId: req.invoice.id,
      organizationId: req.organizationId,
      targetId,
      heuristicRiskScore: parseFloat(heuristicScore.toFixed(4)),
      heuristicRiskBand,
      heuristicExplanation: `Heuristic computed from ${buyerHistory.length} historical vouchers (${delayedCount} delayed). No production ML model is active.`,
      predictionTimestamp: new Date().toISOString(),
    };
  }
}
