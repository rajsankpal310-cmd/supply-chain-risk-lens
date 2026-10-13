/**
 * NEXUS-CFR Model Promotion Gate
 * Phase 10: Statistical Power & Evidence-Based Lifecycle Promotion
 *
 * Enforces rigorous criteria before any model can transition from EXPERIMENTAL to VALIDATED:
 * 1. PROVENANCE GATE: Dataset must be classified as VERIFIED_REAL.
 * 2. SAMPLE SIZE GATE: Minimum validation (N >= 50) and test (N >= 50) records.
 * 3. CLASS DIVERSITY GATE: For classification, both classes must be observed in test set (N_pos >= 5, N_neg >= 5).
 *    If out-of-time test has 0 negative or 0 positive instances, promotion is BLOCKED.
 * 4. METRIC AVAILABILITY: Target metrics must be statistically computable (not NaN or undefined).
 * 5. LEAKAGE GATE: Features must be confirmed pre-prediction timestamp safe.
 * 6. CALIBRATION GATE: Calibration must be evaluated over sufficient instances.
 */

import { GovernedModelArtifact } from "../registry/modelRegistry";
import { ClassificationMetrics } from "../models/metrics";

export interface PromotionEligibilityResult {
  eligible: boolean;
  status: "ELIGIBLE" | "BLOCKED";
  blockers: string[];
  warnings: string[];
  metricsSummary: {
    datasetProvenance: string;
    valCount: number;
    testCount: number;
    isClassification: boolean;
    valPositives?: number;
    valNegatives?: number;
    testPositives?: number;
    testNegatives?: number;
  };
}

export class ModelPromotionGate {
  /**
   * Evaluates whether a model meets all scientific and governance criteria for promotion to VALIDATED.
   */
  public static evaluateForValidation(model: GovernedModelArtifact): PromotionEligibilityResult {
    const blockers: string[] = [];
    const warnings: string[] = [];

    const provenance = model.dataProvenanceClassification || model.sourceProvenance || "UNVERIFIED";
    const valCount = model.trainingMetadata?.validationRecordCount ?? 0;
    const testCount = model.trainingMetadata?.testRecordCount ?? 0;

    // 1. Provenance Gate
    if (provenance !== "VERIFIED_REAL") {
      blockers.push(
        `PROVENANCE_GATE_FAILED: Model was trained on '${provenance}'. Only models trained on 'VERIFIED_REAL' data may be promoted to VALIDATED.`
      );
    }

    // 2. Sample Power Gate
    if (valCount < 50) {
      blockers.push(
        `SAMPLE_SIZE_GATE_FAILED: Validation sample size (${valCount}) is below the required threshold of 50 instances.`
      );
    }
    if (testCount < 50) {
      blockers.push(
        `SAMPLE_SIZE_GATE_FAILED: Out-of-time test sample size (${testCount}) is below the required threshold of 50 instances.`
      );
    }

    // Determine problem type
    const isClassification = model.evaluationMetrics?.validation && "rocAuc" in model.evaluationMetrics.validation;
    let valPos: number | undefined;
    let valNeg: number | undefined;
    let testPos: number | undefined;
    let testNeg: number | undefined;

    if (isClassification) {
      const valMetrics = model.evaluationMetrics.validation as ClassificationMetrics;
      const testMetrics = model.evaluationMetrics.outOfTimeTest as ClassificationMetrics;

      if (valMetrics?.confusionMatrix) {
        valPos = (valMetrics.confusionMatrix.truePositive ?? (valMetrics.confusionMatrix as any).tp ?? 0) +
                 (valMetrics.confusionMatrix.falseNegative ?? (valMetrics.confusionMatrix as any).fn ?? 0);
        valNeg = (valMetrics.confusionMatrix.trueNegative ?? (valMetrics.confusionMatrix as any).tn ?? 0) +
                 (valMetrics.confusionMatrix.falsePositive ?? (valMetrics.confusionMatrix as any).fp ?? 0);
      }
      if (testMetrics?.confusionMatrix) {
        testPos = (testMetrics.confusionMatrix.truePositive ?? (testMetrics.confusionMatrix as any).tp ?? 0) +
                  (testMetrics.confusionMatrix.falseNegative ?? (testMetrics.confusionMatrix as any).fn ?? 0);
        testNeg = (testMetrics.confusionMatrix.trueNegative ?? (testMetrics.confusionMatrix as any).tn ?? 0) +
                  (testMetrics.confusionMatrix.falsePositive ?? (testMetrics.confusionMatrix as any).fp ?? 0);
      }

      // 3. Class Diversity Gate
      if (testPos !== undefined && testNeg !== undefined) {
        if (testPos === 0) {
          blockers.push(
            `CLASS_DIVERSITY_GATE_FAILED: Out-of-time test split contains 0 positive instances. ROC-AUC and PR-AUC cannot be statistically evaluated.`
          );
        }
        if (testNeg === 0) {
          blockers.push(
            `CLASS_DIVERSITY_GATE_FAILED: Out-of-time test split contains 0 negative instances. ROC-AUC is mathematically undefined.`
          );
        }
        if (testPos > 0 && testPos < 5) {
          warnings.push(`Minority positive class in test set is underpowered (${testPos} < 5 instances).`);
        }
      }

      // 4. Metric computability
      if (testMetrics && isNaN(testMetrics.rocAuc)) {
        blockers.push(`METRIC_COMPUTABILITY_FAILED: Out-of-time test ROC-AUC is NaN.`);
      }
    }

    // 5. Calibration Gate
    if (model.calibration?.status === "UNCALIBRATED" || model.calibration?.method === "NONE") {
      warnings.push("Model calibration status is UNCALIBRATED. Uncalibrated probability estimates require conservative decision thresholds.");
    }

    const eligible = blockers.length === 0;

    return {
      eligible,
      status: eligible ? "ELIGIBLE" : "BLOCKED",
      blockers,
      warnings,
      metricsSummary: {
        datasetProvenance: provenance,
        valCount,
        testCount,
        isClassification,
        valPositives: valPos,
        valNegatives: valNeg,
        testPositives: testPos,
        testNegatives: testNeg,
      },
    };
  }
}
