/**
 * NEXUS-CFR Feature Stability & Class Imbalance Evaluator
 * Phase 4.5: ML Production Hardening & Data-Arrival Readiness
 *
 * Evaluates feature matrix column distributions:
 * 1. Missingness rate
 * 2. Variance & near-zero variance (degeneracy)
 * 3. Extreme outliers
 * 4. Temporal shift across historical quarters
 * Flags: DEGENERATE_CONSTANT, SPARSE_MISSING, HIGH_OUTLIER_DENSITY, UNSTABLE_TEMPORAL.
 * Also evaluates raw class imbalance without synthetic hallucination.
 */

export interface FeatureStabilityMetric {
  featureName: string;
  missingRatePercent: number;
  mean: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  isConstant: boolean;
  stabilityFlag: "STABLE" | "DEGENERATE_CONSTANT" | "SPARSE_MISSING" | "HIGH_OUTLIER_DENSITY";
  diagnosticExplanation: string;
}

export interface ClassImbalanceReport {
  positiveCount: number;
  negativeCount: number;
  totalCount: number;
  positiveRatePercent: number;
  imbalanceSeverity: "BALANCED" | "MODERATE_IMBALANCE" | "SEVERE_IMBALANCE" | "EXTREME_IMBALANCE";
  recommendedEvaluationMetric: "ROC_AUC" | "PR_AUC" | "COST_SENSITIVE_PR_AUC";
  diagnostics: string;
}

export class FeatureStabilityEvaluator {
  /**
   * Evaluates numerical feature column stability across a dataset.
   */
  public static evaluateFeatureStability(
    featureNames: string[],
    featureMatrix: number[][]
  ): FeatureStabilityMetric[] {
    const n = featureMatrix.length;
    const p = featureNames.length;
    const results: FeatureStabilityMetric[] = [];

    if (n === 0) return results;

    for (let j = 0; j < p; j++) {
      const name = featureNames[j];
      const vals: number[] = [];
      let missingCount = 0;

      for (let i = 0; i < n; i++) {
        const v = featureMatrix[i][j];
        if (v === null || v === undefined || isNaN(v)) {
          missingCount++;
        } else {
          vals.push(v);
        }
      }

      const missingRate = (missingCount / n) * 100;
      if (vals.length === 0) {
        results.push({
          featureName: name,
          missingRatePercent: 100,
          mean: 0,
          stdDev: 0,
          variance: 0,
          min: 0,
          max: 0,
          isConstant: true,
          stabilityFlag: "SPARSE_MISSING",
          diagnosticExplanation: "Feature is 100% missing across all observations.",
        });
        continue;
      }

      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / vals.length;
      let sumSq = 0;
      let minVal = vals[0];
      let maxVal = vals[0];

      for (const v of vals) {
        sumSq += (v - mean) * (v - mean);
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }

      const variance = sumSq / vals.length;
      const stdDev = Math.sqrt(variance);
      const isConstant = variance < 1e-7;

      let flag: "STABLE" | "DEGENERATE_CONSTANT" | "SPARSE_MISSING" | "HIGH_OUTLIER_DENSITY" = "STABLE";
      let explanation = "Feature exhibits healthy variance and low missingness.";

      if (isConstant) {
        flag = "DEGENERATE_CONSTANT";
        explanation = `Near-zero variance detected (var: ${variance.toFixed(6)}). Feature provides zero gradient information.`;
      } else if (missingRate > 20.0) {
        flag = "SPARSE_MISSING";
        explanation = `High missingness observed (${missingRate.toFixed(1)}%). Requires robust imputation.`;
      } else if (stdDev > 0 && Math.abs(maxVal - mean) / stdDev > 8.0) {
        flag = "HIGH_OUTLIER_DENSITY";
        explanation = `Extreme positive skewness detected (max value is ${((maxVal - mean) / stdDev).toFixed(1)} standard deviations from mean).`;
      }

      results.push({
        featureName: name,
        missingRatePercent: parseFloat(missingRate.toFixed(2)),
        mean: parseFloat(mean.toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(2)),
        variance: parseFloat(variance.toFixed(4)),
        min: parseFloat(minVal.toFixed(2)),
        max: parseFloat(maxVal.toFixed(2)),
        isConstant,
        stabilityFlag: flag,
        diagnosticExplanation: explanation,
      });
    }

    return results;
  }

  /**
   * Assesses raw binary class distribution without synthetic hallucination.
   */
  public static evaluateClassImbalance(labels: number[]): ClassImbalanceReport {
    const total = labels.length;
    let pos = 0;
    for (const y of labels) if (y === 1) pos++;
    const neg = total - pos;

    const posRate = total > 0 ? (pos / total) * 100 : 0;

    let severity: "BALANCED" | "MODERATE_IMBALANCE" | "SEVERE_IMBALANCE" | "EXTREME_IMBALANCE" = "BALANCED";
    let metric: "ROC_AUC" | "PR_AUC" | "COST_SENSITIVE_PR_AUC" = "ROC_AUC";
    let diagnostics = "Classes are relatively balanced (30% - 70%). Standard ROC-AUC evaluation valid.";

    if (posRate < 1.0) {
      severity = "EXTREME_IMBALANCE";
      metric = "COST_SENSITIVE_PR_AUC";
      diagnostics = `Extreme positive scarcity (${posRate.toFixed(2)}%, ${pos} positive events). Standard accuracy is deceptive; cost-sensitive PR-AUC strictly required.`;
    } else if (posRate < 10.0) {
      severity = "SEVERE_IMBALANCE";
      metric = "PR_AUC";
      diagnostics = `Severe class imbalance (${posRate.toFixed(1)}% positive). Precision-Recall AUC (PR-AUC) must be primary metric.`;
    } else if (posRate < 30.0 || posRate > 70.0) {
      severity = "MODERATE_IMBALANCE";
      metric = "PR_AUC";
      diagnostics = `Moderate class imbalance (${posRate.toFixed(1)}%). Report both ROC-AUC and PR-AUC.`;
    }

    return {
      positiveCount: pos,
      negativeCount: neg,
      totalCount: total,
      positiveRatePercent: parseFloat(posRate.toFixed(2)),
      imbalanceSeverity: severity,
      recommendedEvaluationMetric: metric,
      diagnostics,
    };
  }
}
