/**
 * NEXUS-CFR Probability Calibration Engine
 * Phase 4: Production ML Foundation
 *
 * Implements Platt Scaling (logistic sigmoid calibration) and
 * binned Reliability Diagrams (Expected Calibration Error - ECE).
 */

export interface CalibrationBin {
  binIndex: number;
  probRange: [number, number];
  meanPredictedProb: number;
  observedEmpiricalRate: number;
  sampleCount: number;
}

export interface CalibrationReport {
  status: "CALIBRATED" | "UNCALIBRATED" | "INSUFFICIENT_EVIDENCE";
  method: "PLATT_SCALING" | "NONE";
  plattParameters?: { a: number; b: number };
  expectedCalibrationError: number; // ECE
  maxCalibrationError: number;      // MCE
  bins: CalibrationBin[];
  sampleSize: number;
  diagnostics: string;
}

export class ProbabilityCalibrator {
  /**
   * Generates a 10-bin Reliability Diagram / Calibration Curve.
   */
  public static computeCalibrationCurve(
    actuals: number[],
    probabilities: number[],
    numBins = 10
  ): { bins: CalibrationBin[]; ece: number; mce: number } {
    const bins: CalibrationBin[] = [];
    const binSize = 1.0 / numBins;

    let totalEce = 0;
    let maxCe = 0;
    const n = actuals.length;

    for (let b = 0; b < numBins; b++) {
      const lower = b * binSize;
      const upper = (b + 1) * binSize;

      const indices: number[] = [];
      for (let i = 0; i < n; i++) {
        const p = probabilities[i];
        if (b === numBins - 1 ? p >= lower && p <= upper : p >= lower && p < upper) {
          indices.push(i);
        }
      }

      if (indices.length === 0) {
        bins.push({
          binIndex: b,
          probRange: [parseFloat(lower.toFixed(2)), parseFloat(upper.toFixed(2))],
          meanPredictedProb: parseFloat(((lower + upper) / 2).toFixed(4)),
          observedEmpiricalRate: 0,
          sampleCount: 0,
        });
        continue;
      }

      let probSum = 0;
      let actualSum = 0;
      for (const idx of indices) {
        probSum += probabilities[idx];
        actualSum += actuals[idx];
      }

      const meanProb = probSum / indices.length;
      const empiricalRate = actualSum / indices.length;
      const diff = Math.abs(meanProb - empiricalRate);

      totalEce += (indices.length / n) * diff;
      if (diff > maxCe) maxCe = diff;

      bins.push({
        binIndex: b,
        probRange: [parseFloat(lower.toFixed(2)), parseFloat(upper.toFixed(2))],
        meanPredictedProb: parseFloat(meanProb.toFixed(4)),
        observedEmpiricalRate: parseFloat(empiricalRate.toFixed(4)),
        sampleCount: indices.length,
      });
    }

    return {
      bins,
      ece: parseFloat(totalEce.toFixed(4)),
      mce: parseFloat(maxCe.toFixed(4)),
    };
  }

  /**
   * Fits a Platt scaling parameter set (A, B) such that P(y=1|f) = 1 / (1 + exp(A*f + B))
   * using regularized logistic regression on validation margins f.
   */
  public static fitPlattScaling(
    valRawScores: number[],
    valActuals: number[]
  ): CalibrationReport {
    const n = valActuals.length;

    // Minimum 100 validation samples required to calibrate safely without overfitting
    if (n < 100) {
      const curve = this.computeCalibrationCurve(valActuals, valRawScores, 5);
      return {
        status: "INSUFFICIENT_EVIDENCE",
        method: "NONE",
        expectedCalibrationError: curve.ece,
        maxCalibrationError: curve.mce,
        bins: curve.bins,
        sampleSize: n,
        diagnostics: `Sample size ${n} < 100 threshold; probability calibration withheld to prevent secondary overfitting.`,
      };
    }

    // Target smoothing (Platt 1999) to avoid extreme zero/one targets
    let posCount = 0;
    for (const y of valActuals) if (y === 1) posCount++;
    const negCount = n - posCount;

    const tPos = (posCount + 1.0) / (posCount + 2.0);
    const tNeg = 1.0 / (negCount + 2.0);
    const targets = valActuals.map((y) => (y === 1 ? tPos : tNeg));

    // Gradient descent optimization for A and B
    let a = -1.0; // initial slope
    let b = 0.0;  // initial intercept
    const lr = 0.01;
    const iterations = 500;

    for (let iter = 0; iter < iterations; iter++) {
      let gradA = 0;
      let gradB = 0;

      for (let i = 0; i < n; i++) {
        const f = valRawScores[i];
        const t = targets[i];
        const logit = a * f + b;
        const p = 1.0 / (1.0 + Math.exp(-logit));
        const err = p - t;

        gradA += err * f;
        gradB += err;
      }

      a -= lr * (gradA / n);
      b -= lr * (gradB / n);
    }

    // Calibrate validation set and evaluate post-calibration ECE
    const calibratedProbs = valRawScores.map((f) => 1.0 / (1.0 + Math.exp(-(a * f + b))));
    const curve = this.computeCalibrationCurve(valActuals, calibratedProbs, 10);

    return {
      status: "CALIBRATED",
      method: "PLATT_SCALING",
      plattParameters: { a: parseFloat(a.toFixed(4)), b: parseFloat(b.toFixed(4)) },
      expectedCalibrationError: curve.ece,
      maxCalibrationError: curve.mce,
      bins: curve.bins,
      sampleSize: n,
      diagnostics: `Platt scaling successfully fitted on ${n} validation observations (ECE: ${(curve.ece * 100).toFixed(1)}%).`,
    };
  }

  /**
   * Applies fitted Platt parameters to transform a raw score/logit into a calibrated probability.
   */
  public static applyPlattScaling(rawScore: number, a: number, b: number): number {
    const logit = a * rawScore + b;
    return 1.0 / (1.0 + Math.exp(-logit));
  }
}
