/**
 * NEXUS-CFR Machine Learning Evaluation Metrics Suite
 * Phase 4: Production ML Foundation
 *
 * Implements rigorous numerical metrics for credit & risk models:
 * - Trapezoidal Area Under the ROC Curve (ROC-AUC)
 * - Precision-Recall Curve Area (PR-AUC / Average Precision)
 * - Brier Probability Score (mean squared error of probabilities)
 * - Precision, Recall, F1-Score, Specificity, Confusion Matrix
 * - Regression Diagnostics: MAE, RMSE, R-squared, Median Error
 */

export interface ClassificationMetrics {
  rocAuc: number;
  prAuc: number;
  brierScore: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  specificity: number;
  confusionMatrix: {
    truePositive: number;
    falsePositive: number;
    trueNegative: number;
    falseNegative: number;
  };
  sampleCount: number;
  positiveRate: number;
}

export interface RegressionMetrics {
  mae: number;
  rmse: number;
  rSquared: number;
  medianAbsoluteError: number;
  sampleCount: number;
}

export class MLMetrics {
  /**
   * Evaluates binary classification probabilities against ground-truth labels (0 or 1).
   */
  public static evaluateClassification(
    actuals: number[],
    probabilities: number[],
    threshold = 0.5
  ): ClassificationMetrics {
    if (actuals.length === 0 || actuals.length !== probabilities.length) {
      throw new Error("Invalid arrays passed to evaluateClassification: lengths must be non-zero and equal.");
    }

    const n = actuals.length;
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;
    let brierSum = 0;
    let posCount = 0;

    for (let i = 0; i < n; i++) {
      const y = actuals[i];
      const p = Math.max(0, Math.min(1, probabilities[i]));
      if (y === 1) posCount++;

      brierSum += (p - y) * (p - y);
      const pred = p >= threshold ? 1 : 0;

      if (pred === 1 && y === 1) tp++;
      else if (pred === 1 && y === 0) fp++;
      else if (pred === 0 && y === 0) tn++;
      else if (pred === 0 && y === 1) fn++;
    }

    const accuracy = (tp + tn) / n;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const brierScore = brierSum / n;

    const rocAuc = this.calculateRocAuc(actuals, probabilities);
    const prAuc = this.calculatePrAuc(actuals, probabilities);

    return {
      rocAuc: parseFloat(rocAuc.toFixed(4)),
      prAuc: parseFloat(prAuc.toFixed(4)),
      brierScore: parseFloat(brierScore.toFixed(4)),
      accuracy: parseFloat(accuracy.toFixed(4)),
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      f1Score: parseFloat(f1Score.toFixed(4)),
      specificity: parseFloat(specificity.toFixed(4)),
      confusionMatrix: { truePositive: tp, falsePositive: fp, trueNegative: tn, falseNegative: fn },
      sampleCount: n,
      positiveRate: parseFloat((posCount / n).toFixed(4)),
    };
  }

  /**
   * Computes the Area Under the Receiver Operating Characteristic Curve (ROC-AUC)
   * using the trapezoidal rule.
   */
  public static calculateRocAuc(actuals: number[], probabilities: number[]): number {
    const pairs = actuals.map((y, i) => ({ y, p: probabilities[i] }));
    pairs.sort((a, b) => b.p - a.p); // Sort descending by predicted probability

    let totalPos = 0;
    let totalNeg = 0;
    for (const p of pairs) {
      if (p.y === 1) totalPos++;
      else totalNeg++;
    }

    if (totalPos === 0 || totalNeg === 0) {
      return 0.5; // Undefined ROC curve when only one class present
    }

    let tp = 0;
    let fp = 0;
    let prevFp = 0;
    let prevTp = 0;
    let auc = 0;

    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].y === 1) {
        tp++;
      } else {
        fp++;
      }

      // Add trapezoid when probability changes or at end
      if (i === pairs.length - 1 || pairs[i].p !== pairs[i + 1].p) {
        // Trapezoid area: (fp - prevFp) * (tp + prevTp) / 2
        auc += (fp - prevFp) * (tp + prevTp) / 2;
        prevFp = fp;
        prevTp = tp;
      }
    }

    return auc / (totalPos * totalNeg);
  }

  /**
   * Computes Precision-Recall AUC (Average Precision) using trapezoidal integration.
   */
  public static calculatePrAuc(actuals: number[], probabilities: number[]): number {
    const pairs = actuals.map((y, i) => ({ y, p: probabilities[i] }));
    pairs.sort((a, b) => b.p - a.p);

    let totalPos = 0;
    for (const p of pairs) {
      if (p.y === 1) totalPos++;
    }

    if (totalPos === 0) return 0.0;

    let tp = 0;
    let fp = 0;
    let prevRecall = 0;
    let prAuc = 0;

    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].y === 1) tp++;
      else fp++;

      if (i === pairs.length - 1 || pairs[i].p !== pairs[i + 1].p) {
        const precision = tp / (tp + fp);
        const recall = tp / totalPos;
        prAuc += (recall - prevRecall) * precision;
        prevRecall = recall;
      }
    }

    return Math.max(0, Math.min(1, prAuc));
  }

  /**
   * Evaluates continuous regression predictions against ground truth.
   */
  public static evaluateRegression(actuals: number[], predictions: number[]): RegressionMetrics {
    if (actuals.length === 0 || actuals.length !== predictions.length) {
      throw new Error("Invalid arrays for regression evaluation.");
    }

    const n = actuals.length;
    let sumAbsErr = 0;
    let sumSqErr = 0;
    let actualSum = 0;
    const absErrors: number[] = [];

    for (let i = 0; i < n; i++) {
      const err = predictions[i] - actuals[i];
      const absErr = Math.abs(err);
      sumAbsErr += absErr;
      sumSqErr += err * err;
      actualSum += actuals[i];
      absErrors.push(absErr);
    }

    const mae = sumAbsErr / n;
    const rmse = Math.sqrt(sumSqErr / n);

    // R-squared
    const meanActual = actualSum / n;
    let totalSumSq = 0;
    for (let i = 0; i < n; i++) {
      const diff = actuals[i] - meanActual;
      totalSumSq += diff * diff;
    }
    const rSquared = totalSumSq > 0 ? Math.max(0, 1 - sumSqErr / totalSumSq) : 0;

    // Median absolute error
    absErrors.sort((a, b) => a - b);
    const mid = Math.floor(absErrors.length / 2);
    const medianAbsoluteError = absErrors.length % 2 === 0
      ? (absErrors[mid - 1] + absErrors[mid]) / 2
      : absErrors[mid];

    return {
      mae: parseFloat(mae.toFixed(2)),
      rmse: parseFloat(rmse.toFixed(2)),
      rSquared: parseFloat(rSquared.toFixed(4)),
      medianAbsoluteError: parseFloat(medianAbsoluteError.toFixed(2)),
      sampleCount: n,
    };
  }
}
