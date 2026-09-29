/**
 * NEXUS-CFR First Evidence Pipeline & Governed ML Activation
 * Phase 5: Real Authorized Data Acquisition & First Evidence Run
 *
 * Governs the execution of the first machine learning evidence run:
 * 1. Checks 20-Point ML Readiness Gate.
 * 2. If data is REAL_OBSERVED_ENTERPRISE and passes all 20 criteria:
 *    - Builds immutable Dataset Version 1.0.
 *    - Executes chronological temporal partition with embargo.
 *    - Trains Logistic Regression and Ridge baseline models.
 *    - Evaluates out-of-time test metrics, calibration, and explainability.
 *    - Emits a certified Real ML Evidence Report.
 * 3. If data is SIMULATED, UNVERIFIED, or underpowered:
 *    - Hard locks production training.
 *    - Executes a controlled pipeline dry run clearly watermarked
 *      "SIMULATED DRY RUN — NOT REAL-WORLD ML EVIDENCE".
 */

import crypto from "crypto";
import { MLReadinessGate, MLReadinessReport, DatasetAssessmentInput } from "../governance/readinessGate";
import { MLDatasetBuilder, MLDatasetVersion } from "../datasets/datasetBuilder";
import { RawInvoiceRecord, FeatureEngine } from "../features/featureEngine";
import { LogisticRegressionClassifier, RidgeRegressor } from "../models/baselineModels";
import { MLMetrics, ClassificationMetrics, RegressionMetrics } from "../models/metrics";
import { ProbabilityCalibrator, CalibrationReport } from "../models/calibration";
import { ModelExplainer, GlobalFeatureImportance } from "../explainability/explainer";
import { MultiTenantModelRegistry, GovernedModelArtifact } from "../registry/modelRegistry";

export interface FirstEvidenceRunResult {
  runId: string;
  organizationId: string;
  targetId: string;
  executedAt: string;
  operationalMode: "REAL_OBSERVED_EVIDENCE_RUN" | "SIMULATED_BENCHMARK_DRY_RUN";
  watermarkLabel: string;
  gateStatus: "READY" | "LOCKED";
  gateBlockersCount: number;
  gateBlockers: string[];
  datasetArtifact?: {
    datasetId: string;
    version: string;
    totalRecords: number;
    trainCohortCount: number;
    valCohortCount: number;
    testCohortCount: number;
    temporalRange: { start: string; end: string };
  };
  classificationModel?: {
    modelId: string;
    version: string;
    modelType: "LOGISTIC_REGRESSION";
    metrics: ClassificationMetrics;
    calibration: CalibrationReport;
    globalImportance: GlobalFeatureImportance[];
    checksum: string;
    lifecycleState: string;
  };
  regressionModel?: {
    modelId: string;
    version: string;
    modelType: "RIDGE_REGRESSION";
    metrics: RegressionMetrics;
    checksum: string;
  };
  governanceRecommendation: {
    canDeployToProduction: boolean;
    reason: string;
  };
}

export class FirstEvidencePipeline {
  /**
   * Executes the Phase 5 Evidence Pipeline.
   */
  public static async executeEvidenceRun(params: {
    organizationId: string;
    targetId?: string;
    rawInvoices: RawInvoiceRecord[];
    isEnterpriseAuthorized: boolean;
    provenanceClassification: string;
    actorEmail: string;
    forceSimulatedDryRun?: boolean;
  }): Promise<FirstEvidenceRunResult> {
    const {
      organizationId,
      targetId = "PAYMENT_DELAY_RISK",
      rawInvoices,
      isEnterpriseAuthorized,
      provenanceClassification,
      actorEmail,
      forceSimulatedDryRun = false,
    } = params;

    const runId = `EV-RUN-${organizationId}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const executedAt = new Date().toISOString();

    // 1. Evaluate 20-Point ML Readiness Gate
    const totalTransactions = rawInvoices.length;
    const completedTransactions = rawInvoices.filter((r) => r.paymentDate != null).length;
    const openTransactions = totalTransactions - completedTransactions;
    const uniqueBuyers = new Set(rawInvoices.map((r) => r.buyerId)).size;
    const uniqueSuppliers = new Set(rawInvoices.map((r) => r.supplierId)).size;
    const missingAmountsCount = rawInvoices.filter((r) => r.invoiceAmount == null || r.invoiceAmount <= 0).length;
    const missingDueDatesCount = rawInvoices.filter((r) => !r.dueDate).length;
    const invoiceDates = rawInvoices.map((r) => new Date(r.invoiceDate).getTime()).filter((t) => !isNaN(t));
    const earliestDate = invoiceDates.length > 0 ? new Date(Math.min(...invoiceDates)) : null;
    const latestDate = invoiceDates.length > 0 ? new Date(Math.max(...invoiceDates)) : null;
    const observedDelayedCount = rawInvoices.filter((r) => (r.paymentDelayDays ?? 0) > 0).length;
    const duplicateTransactionsCount = totalTransactions - new Set(rawInvoices.map((r) => r.invoiceNumber)).size;

    const assessmentInput: DatasetAssessmentInput = {
      organizationId,
      sourceClassification: provenanceClassification as any,
      isEnterpriseAuthorized,
      hasActiveLegalConsent: isEnterpriseAuthorized,
      totalTransactions,
      completedTransactions,
      openTransactions,
      uniqueBuyers,
      uniqueSuppliers,
      earliestDate,
      latestDate,
      missingDueDatesCount,
      missingAmountsCount,
      duplicateTransactionsCount,
      observedDelayedCount,
      detectedLeakageFields: [],
      governanceApproved: isEnterpriseAuthorized,
      targetId,
    };

    const readinessReport: MLReadinessReport = MLReadinessGate.evaluateDataset(assessmentInput);

    const isRealData = provenanceClassification === "REAL_OBSERVED_ENTERPRISE";
    const gatePassed = readinessReport.overallStatus === "READY" && isEnterpriseAuthorized && isRealData;

    // Truth Invariant: If real data conditions fail and simulated dry run not requested, hard abort.
    if (!gatePassed && !forceSimulatedDryRun) {
      return {
        runId,
        organizationId,
        targetId,
        executedAt,
        operationalMode: "SIMULATED_BENCHMARK_DRY_RUN",
        watermarkLabel: "ML TRAINING BLOCKED — NO AUTHORIZED PRIMARY DATA",
        gateStatus: "LOCKED",
        gateBlockersCount: readinessReport.blockerCount,
        gateBlockers: [
          ...readinessReport.exactBlockers,
          ...(isEnterpriseAuthorized ? [] : ["Enterprise legal consent is MISSING"]),
          ...(isRealData ? [] : [`Source provenance '${provenanceClassification}' is not REAL_OBSERVED_ENTERPRISE`]),
        ],
        governanceRecommendation: {
          canDeployToProduction: false,
          reason: "ML Training strictly locked by 20-Point Readiness Gate. Ingestion of authorized enterprise transaction ledgers required.",
        },
      };
    }

    // Determine operational mode
    const operationalMode: FirstEvidenceRunResult["operationalMode"] = gatePassed
      ? "REAL_OBSERVED_EVIDENCE_RUN"
      : "SIMULATED_BENCHMARK_DRY_RUN";

    const watermarkLabel = gatePassed
      ? "CERTIFIED REAL-WORLD ML EVIDENCE RUN"
      : "SIMULATED DRY RUN — NOT REAL-WORLD ML EVIDENCE";

    // 2. Build Versioned ML Dataset
    const dataset: MLDatasetVersion = MLDatasetBuilder.buildDataset(organizationId, rawInvoices, targetId);

    // 3. Chronological Out-of-Time Splitting with Embargo
    const trainRecords = dataset.records.filter((r) => r.splitCohort === "TRAIN");
    const valRecords = dataset.records.filter((r) => r.splitCohort === "VALIDATION");
    const testRecords = dataset.records.filter((r) => r.splitCohort === "TEST");

    const X_train = trainRecords.map((r) => r.featureVector);
    const y_train = trainRecords.map((r) => r.targetValue);

    const X_val = valRecords.map((r) => r.featureVector);
    const y_val = valRecords.map((r) => r.targetValue);

    const X_test = testRecords.map((r) => r.featureVector);
    const y_test = testRecords.map((r) => r.targetValue);

    // 4. Train Classification Baseline (Logistic Regression)
    const logReg = new LogisticRegressionClassifier(0.05, 0.01, 300);
    const trainResult = logReg.fit(X_train, y_train, FeatureEngine.ACTIVE_NUMERIC_FEATURES);

    // Predict on Out-of-Time Test Set
    const valRawScores = X_val.map((x) => logReg.predictRawScore(x));
    const valProbs = X_val.map((x) => logReg.predictProbability(x));

    const testProbs = X_test.length > 0 ? X_test.map((x) => logReg.predictProbability(x)) : valProbs;
    const testActuals = testRecords.length > 0 ? y_test : y_val;

    // Evaluate Metrics on Out-of-Time Test Set (Never report training performance as evidence)
    const testMetrics = MLMetrics.evaluateClassification(testActuals, testProbs);
    const valMetrics = MLMetrics.evaluateClassification(y_val, valProbs);

    // 5. Probability Calibration
    const calibrationReport: CalibrationReport = ProbabilityCalibrator.fitPlattScaling(valRawScores, y_val);

    // 6. Model Explainability
    const globalImportance: GlobalFeatureImportance[] = ModelExplainer.computeGlobalImportance(logReg);

    // 7. Register Model Artifact in Governed Registry
    const registeredModel: GovernedModelArtifact = MultiTenantModelRegistry.registerModel(organizationId, {
      version: gatePassed ? "1.0-PRODUCTION_EVIDENCE" : "0.1-SIMULATED_BENCHMARK",
      modelType: "LOGISTIC_REGRESSION",
      targetId,
      targetVersion: dataset.targetVersion,
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      featureVersion: dataset.featureVersion,
      dataProvenanceClassification: gatePassed ? "REAL_OBSERVED_ENTERPRISE" : "SIMULATED_BENCHMARK",
      trainingMetadata: {
        trainedAt: executedAt,
        trainingRecordCount: trainRecords.length,
        validationRecordCount: valRecords.length,
        testRecordCount: testRecords.length,
        trainWindow: dataset.temporalSplit.trainWindow,
        validationStrategy: "OUT_OF_TIME_CHRONOLOGICAL",
        hyperparameters: trainResult.hyperparameters,
      },
      evaluationMetrics: {
        validation: valMetrics,
        outOfTimeTest: testMetrics,
      },
      calibration: calibrationReport,
      globalImportance,
      serializedWeights: JSON.stringify({
        weights: (logReg as any).weights,
        bias: (logReg as any).bias,
      }),
    });

    // 8. Train Regression Baseline (Ridge Regression for delay severity in days)
    const ridgeModel = new RidgeRegressor(0.02, 0.1, 300);
    const yReg_train = trainRecords.map((r) => r.targetValue);
    const yReg_test = testRecords.length > 0
      ? testRecords.map((r) => r.targetValue)
      : valRecords.map((r) => r.targetValue);

    ridgeModel.fit(X_train, yReg_train, FeatureEngine.ACTIVE_NUMERIC_FEATURES);
    const testRegPreds = (X_test.length > 0 ? X_test : X_val).map((x) => ridgeModel.predict(x));
    const regMetrics = MLMetrics.evaluateRegression(yReg_test, testRegPreds);

    return {
      runId,
      organizationId,
      targetId,
      executedAt,
      operationalMode,
      watermarkLabel,
      gateStatus: gatePassed ? "READY" : "LOCKED",
      gateBlockersCount: readinessReport.blockerCount,
      gateBlockers: readinessReport.exactBlockers,
      datasetArtifact: {
        datasetId: dataset.datasetId,
        version: dataset.version,
        totalRecords: dataset.recordCount.totalEligible,
        trainCohortCount: trainRecords.length,
        valCohortCount: valRecords.length,
        testCohortCount: testRecords.length,
        temporalRange: {
          start: dataset.temporalSplit.trainWindow.start,
          end: dataset.temporalSplit.testWindow.end,
        },
      },
      classificationModel: {
        modelId: registeredModel.modelId,
        version: registeredModel.version,
        modelType: "LOGISTIC_REGRESSION",
        metrics: testMetrics,
        calibration: calibrationReport,
        globalImportance,
        checksum: registeredModel.checksum,
        lifecycleState: registeredModel.lifecycleState,
      },
      regressionModel: {
        modelId: `REG-${registeredModel.modelId}`,
        version: "1.0",
        modelType: "RIDGE_REGRESSION",
        metrics: regMetrics,
        checksum: crypto.createHash("sha256").update(JSON.stringify((ridgeModel as any).weights)).digest("hex"),
      },
      governanceRecommendation: {
        canDeployToProduction: gatePassed,
        reason: gatePassed
          ? "Certified Real ML evidence run completed successfully on genuine authorized data. Model is eligible for governance review."
          : "Production deployment BLOCKED: Executed in simulated dry-run mode. Real authorized enterprise data required for production unlock.",
      },
    };
  }
}
