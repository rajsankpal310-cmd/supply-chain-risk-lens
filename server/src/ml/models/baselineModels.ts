/**
 * NEXUS-CFR Tiered Machine Learning Models
 * Phase 4: Production ML Foundation
 *
 * Implements interpretable, leakage-safe, high-performance tabular models:
 * 1. Regularized Logistic Regression Classifier (L2 penalty)
 * 2. Regularized Ridge Regressor
 * 3. Interpretable Decision Forest Ensemble (Bagged shallow tree stumps)
 *
 * Fully deterministic with zero external C++ / Python binary dependencies.
 */

export interface ScalerParameters {
  means: number[];
  stds: number[];
}

export interface ModelTrainingResult {
  modelType: "LOGISTIC_REGRESSION" | "RIDGE_REGRESSION" | "DECISION_FOREST";
  hyperparameters: Record<string, any>;
  scaler: ScalerParameters;
  weights?: number[];
  bias?: number;
  featureNames: string[];
  iterationsTrained: number;
  converged: boolean;
  trainingDurationMs: number;
}

export class StandardFeatureScaler {
  public static fit(X: number[][]): ScalerParameters {
    const numFeatures = X[0].length;
    const means: number[] = new Array(numFeatures).fill(0);
    const stds: number[] = new Array(numFeatures).fill(0);
    const n = X.length;

    for (let j = 0; j < numFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += X[i][j];
      means[j] = sum / n;

      let sumSq = 0;
      for (let i = 0; i < n; i++) {
        const diff = X[i][j] - means[j];
        sumSq += diff * diff;
      }
      const variance = sumSq / n;
      stds[j] = variance > 1e-7 ? Math.sqrt(variance) : 1.0;
    }

    return { means, stds };
  }

  public static transform(X: number[][], scaler: ScalerParameters): number[][] {
    return X.map((row) =>
      row.map((val, j) => (val - scaler.means[j]) / scaler.stds[j])
    );
  }

  public static transformVector(x: number[], scaler: ScalerParameters): number[] {
    return x.map((val, j) => (val - scaler.means[j]) / scaler.stds[j]);
  }
}

export class LogisticRegressionClassifier {
  private weights: number[] = [];
  private bias = 0;
  private scaler: ScalerParameters | null = null;
  private featureNames: string[] = [];

  constructor(
    private learningRate = 0.05,
    private l2Penalty = 0.01,
    private maxIterations = 500,
    private tolerance = 1e-2
  ) {}

  public fit(
    X: number[][],
    y: number[],
    featureNames: string[]
  ): ModelTrainingResult {
    const startTime = Date.now();
    const n = X.length;
    const p = X[0].length;
    this.featureNames = [...featureNames];

    // Standardize features
    this.scaler = StandardFeatureScaler.fit(X);
    const X_scaled = StandardFeatureScaler.transform(X, this.scaler);

    // Initialize weights to zero
    this.weights = new Array(p).fill(0);
    this.bias = 0;

    let converged = false;
    let actualIterations = 0;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      actualIterations++;
      const gradW = new Array(p).fill(0);
      let gradB = 0;
      let totalLoss = 0;

      for (let i = 0; i < n; i++) {
        let linear = this.bias;
        for (let j = 0; j < p; j++) linear += this.weights[j] * X_scaled[i][j];

        // Numerically stable sigmoid
        const prob = 1.0 / (1.0 + Math.exp(-Math.max(-20, Math.min(20, linear))));
        const error = prob - y[i];

        for (let j = 0; j < p; j++) {
          gradW[j] += error * X_scaled[i][j];
        }
        gradB += error;
      }

      // Apply L2 regularization to weights (not bias)
      let maxGrad = 0;
      for (let j = 0; j < p; j++) {
        const regGrad = (gradW[j] / n) + this.l2Penalty * this.weights[j];
        this.weights[j] -= this.learningRate * regGrad;
        maxGrad = Math.max(maxGrad, Math.abs(regGrad));
      }
      this.bias -= this.learningRate * (gradB / n);

      if (maxGrad < this.tolerance) {
        converged = true;
        break;
      }
    }

    return {
      modelType: "LOGISTIC_REGRESSION",
      hyperparameters: {
        learningRate: this.learningRate,
        l2Penalty: this.l2Penalty,
        maxIterations: this.maxIterations,
      },
      scaler: this.scaler,
      weights: [...this.weights],
      bias: this.bias,
      featureNames: this.featureNames,
      iterationsTrained: actualIterations,
      converged,
      trainingDurationMs: Date.now() - startTime,
    };
  }

  public predictRawScore(x: number[]): number {
    if (!this.scaler) throw new Error("Model not trained.");
    const scaled = StandardFeatureScaler.transformVector(x, this.scaler);
    let score = this.bias;
    for (let j = 0; j < scaled.length; j++) score += this.weights[j] * scaled[j];
    return score;
  }

  public predictProbability(x: number[]): number {
    const raw = this.predictRawScore(x);
    return 1.0 / (1.0 + Math.exp(-Math.max(-20, Math.min(20, raw))));
  }

  public predict(x: number[], threshold = 0.5): number {
    return this.predictProbability(x) >= threshold ? 1 : 0;
  }

  public getWeights(): { weights: number[]; bias: number; featureNames: string[] } {
    return { weights: [...this.weights], bias: this.bias, featureNames: [...this.featureNames] };
  }
}

export class RidgeRegressor {
  private weights: number[] = [];
  private bias = 0;
  private scaler: ScalerParameters | null = null;
  private featureNames: string[] = [];

  constructor(
    private learningRate = 0.02,
    private l2Penalty = 0.1,
    private maxIterations = 600
  ) {}

  public fit(
    X: number[][],
    y: number[],
    featureNames: string[]
  ): ModelTrainingResult {
    const startTime = Date.now();
    const n = X.length;
    const p = X[0].length;
    this.featureNames = [...featureNames];

    this.scaler = StandardFeatureScaler.fit(X);
    const X_scaled = StandardFeatureScaler.transform(X, this.scaler);

    this.weights = new Array(p).fill(0);
    this.bias = y.reduce((a, b) => a + b, 0) / n;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      const gradW = new Array(p).fill(0);
      let gradB = 0;

      for (let i = 0; i < n; i++) {
        let pred = this.bias;
        for (let j = 0; j < p; j++) pred += this.weights[j] * X_scaled[i][j];
        const error = pred - y[i];

        for (let j = 0; j < p; j++) gradW[j] += error * X_scaled[i][j];
        gradB += error;
      }

      for (let j = 0; j < p; j++) {
        const regGrad = (gradW[j] / n) + this.l2Penalty * this.weights[j];
        this.weights[j] -= this.learningRate * regGrad;
      }
      this.bias -= this.learningRate * (gradB / n);
    }

    return {
      modelType: "RIDGE_REGRESSION",
      hyperparameters: {
        learningRate: this.learningRate,
        l2Penalty: this.l2Penalty,
        maxIterations: this.maxIterations,
      },
      scaler: this.scaler,
      weights: [...this.weights],
      bias: this.bias,
      featureNames: this.featureNames,
      iterationsTrained: this.maxIterations,
      converged: true,
      trainingDurationMs: Date.now() - startTime,
    };
  }

  public predict(x: number[]): number {
    if (!this.scaler) throw new Error("Model not fitted.");
    const scaled = StandardFeatureScaler.transformVector(x, this.scaler);
    let pred = this.bias;
    for (let j = 0; j < scaled.length; j++) pred += this.weights[j] * scaled[j];
    return Math.max(0, pred); // Duration cannot be negative
  }
}

export interface DecisionTreeStump {
  featureIdx: number;
  threshold: number;
  leftPred: number;
  rightPred: number;
  gain: number;
}

export class DecisionForestClassifier {
  private trees: DecisionTreeStump[] = [];
  private baseRate = 0.5;
  private featureNames: string[] = [];

  constructor(private numEstimators = 15) {}

  public fit(X: number[][], y: number[], featureNames: string[]): ModelTrainingResult {
    const startTime = Date.now();
    const n = X.length;
    const p = X[0].length;
    this.featureNames = [...featureNames];

    const posCount = y.filter((val) => val === 1).length;
    this.baseRate = posCount / n;
    this.trees = [];

    // Bagging ensemble of best split stumps
    for (let t = 0; t < this.numEstimators; t++) {
      // Deterministic bootstrap pseudo-sample
      const sampleIndices: number[] = [];
      for (let i = 0; i < n; i++) {
        // pseudo-random deterministic index
        const idx = (i * 17 + t * 31) % n;
        sampleIndices.push(idx);
      }

      let bestGain = -1;
      let bestStump: DecisionTreeStump = {
        featureIdx: 0,
        threshold: 0,
        leftPred: this.baseRate,
        rightPred: this.baseRate,
        gain: 0,
      };

      for (let j = 0; j < p; j++) {
        const featureValues = sampleIndices.map((idx) => X[idx][j]).sort((a, b) => a - b);
        const medThreshold = featureValues[Math.floor(featureValues.length / 2)];

        let leftPos = 0, leftTotal = 0;
        let rightPos = 0, rightTotal = 0;

        for (const idx of sampleIndices) {
          const val = X[idx][j];
          const label = y[idx];
          if (val <= medThreshold) {
            leftTotal++;
            if (label === 1) leftPos++;
          } else {
            rightTotal++;
            if (label === 1) rightPos++;
          }
        }

        if (leftTotal > 0 && rightTotal > 0) {
          const leftP = leftPos / leftTotal;
          const rightP = rightPos / rightTotal;
          // Variance / Gini gain proxy
          const gain = Math.abs(leftP - rightP);
          if (gain > bestGain) {
            bestGain = gain;
            bestStump = {
              featureIdx: j,
              threshold: medThreshold,
              leftPred: leftP,
              rightPred: rightP,
              gain,
            };
          }
        }
      }

      this.trees.push(bestStump);
    }

    return {
      modelType: "DECISION_FOREST",
      hyperparameters: { numEstimators: this.numEstimators },
      scaler: { means: [], stds: [] },
      featureNames: this.featureNames,
      iterationsTrained: this.numEstimators,
      converged: true,
      trainingDurationMs: Date.now() - startTime,
    };
  }

  public predictProbability(x: number[]): number {
    if (this.trees.length === 0) return this.baseRate;
    let sum = 0;
    for (const tree of this.trees) {
      const val = x[tree.featureIdx];
      const p = val <= tree.threshold ? tree.leftPred : tree.rightPred;
      sum += p;
    }
    return sum / this.trees.length;
  }

  public predict(x: number[], threshold = 0.5): number {
    return this.predictProbability(x) >= threshold ? 1 : 0;
  }
}

export class GradientBoostingClassifier {
  private baseLogOdds = 0;
  private trees: DecisionTreeStump[] = [];
  private featureNames: string[] = [];

  constructor(
    private numEstimators = 20,
    private learningRate = 0.1
  ) {}

  public fit(X: number[][], y: number[], featureNames: string[]): ModelTrainingResult {
    const startTime = Date.now();
    const n = X.length;
    const p = X[0].length;
    this.featureNames = [...featureNames];

    const posCount = y.filter((val) => val === 1).length;
    const baseP = Math.max(0.01, Math.min(0.99, posCount / n));
    this.baseLogOdds = Math.log(baseP / (1 - baseP));

    const F = new Array(n).fill(this.baseLogOdds);
    this.trees = [];

    for (let iter = 0; iter < this.numEstimators; iter++) {
      // 1. Calculate pseudo-residuals
      const residuals = new Array(n);
      for (let i = 0; i < n; i++) {
        const prob = 1.0 / (1.0 + Math.exp(-Math.max(-20, Math.min(20, F[i]))));
        residuals[i] = y[i] - prob;
      }

      // 2. Find best split stump minimizing squared error on residuals
      let bestLoss = Infinity;
      let bestStump: DecisionTreeStump = {
        featureIdx: 0,
        threshold: 0,
        leftPred: 0,
        rightPred: 0,
        gain: 0,
      };

      for (let j = 0; j < p; j++) {
        const vals = X.map((row) => row[j]).sort((a, b) => a - b);
        const threshold = vals[Math.floor(vals.length / 2)];

        let leftSum = 0, leftCount = 0;
        let rightSum = 0, rightCount = 0;

        for (let i = 0; i < n; i++) {
          if (X[i][j] <= threshold) {
            leftSum += residuals[i];
            leftCount++;
          } else {
            rightSum += residuals[i];
            rightCount++;
          }
        }

        const leftMean = leftCount > 0 ? leftSum / leftCount : 0;
        const rightMean = rightCount > 0 ? rightSum / rightCount : 0;

        let loss = 0;
        for (let i = 0; i < n; i++) {
          const pred = X[i][j] <= threshold ? leftMean : rightMean;
          loss += Math.pow(residuals[i] - pred, 2);
        }

        if (loss < bestLoss) {
          bestLoss = loss;
          bestStump = {
            featureIdx: j,
            threshold,
            leftPred: leftMean,
            rightPred: rightMean,
            gain: 1 / (1 + loss),
          };
        }
      }

      this.trees.push(bestStump);

      // 3. Update F
      for (let i = 0; i < n; i++) {
        const delta = X[i][bestStump.featureIdx] <= bestStump.threshold ? bestStump.leftPred : bestStump.rightPred;
        F[i] += this.learningRate * delta;
      }
    }

    return {
      modelType: "DECISION_FOREST",
      hyperparameters: { numEstimators: this.numEstimators, learningRate: this.learningRate },
      scaler: { means: [], stds: [] },
      featureNames: this.featureNames,
      iterationsTrained: this.numEstimators,
      converged: true,
      trainingDurationMs: Date.now() - startTime,
    };
  }

  public predictLogOdds(x: number[]): number {
    let F = this.baseLogOdds;
    for (const tree of this.trees) {
      const delta = x[tree.featureIdx] <= tree.threshold ? tree.leftPred : tree.rightPred;
      F += this.learningRate * delta;
    }
    return F;
  }

  public predictProbability(x: number[]): number {
    const F = this.predictLogOdds(x);
    return 1.0 / (1.0 + Math.exp(-Math.max(-20, Math.min(20, F))));
  }

  public predict(x: number[], threshold = 0.5): number {
    return this.predictProbability(x) >= threshold ? 1 : 0;
  }
}

export class CalibratedProbabilityModel {
  private plattA = 1.0;
  private plattB = 0.0;

  constructor(private baseClassifier: LogisticRegressionClassifier | DecisionForestClassifier | GradientBoostingClassifier) {}

  public fitCalibration(valX: number[][], valY: number[]): void {
    if (valX.length === 0) return;

    // Extract uncalibrated predictions / probabilities
    const rawProbs = valX.map((x) => {
      if ("predictProbability" in this.baseClassifier) {
        return (this.baseClassifier as any).predictProbability(x);
      }
      return 0.5;
    });

    // Simple Platt scaling optimization via gradient descent
    let a = 1.0, b = 0.0;
    const lr = 0.05;
    for (let iter = 0; iter < 100; iter++) {
      let gradA = 0, gradB = 0;
      for (let i = 0; i < valX.length; i++) {
        const p = Math.max(1e-4, Math.min(0.9999, rawProbs[i]));
        const logit = Math.log(p / (1 - p));
        const calibrated = 1.0 / (1.0 + Math.exp(-(a * logit + b)));
        const err = calibrated - valY[i];
        gradA += err * logit;
        gradB += err;
      }
      a -= lr * (gradA / valX.length);
      b -= lr * (gradB / valX.length);
    }

    this.plattA = a;
    this.plattB = b;
  }

  public predictProbability(x: number[]): number {
    const rawP = "predictProbability" in this.baseClassifier
      ? (this.baseClassifier as any).predictProbability(x)
      : 0.5;
    const p = Math.max(1e-4, Math.min(0.9999, rawP));
    const logit = Math.log(p / (1 - p));
    return 1.0 / (1.0 + Math.exp(-(this.plattA * logit + this.plattB)));
  }

  public predict(x: number[], threshold = 0.5): number {
    return this.predictProbability(x) >= threshold ? 1 : 0;
  }
}

export class RandomForestRegressor {
  private trees: Array<{ featureIdx: number; threshold: number; leftVal: number; rightVal: number }> = [];
  private baseMean = 30;

  constructor(private numEstimators = 15) {}

  public fit(X: number[][], y: number[], featureNames: string[]): ModelTrainingResult {
    const startTime = Date.now();
    const n = X.length;
    const p = X[0].length;
    this.baseMean = y.reduce((a, b) => a + b, 0) / Math.max(1, n);
    this.trees = [];

    for (let t = 0; t < this.numEstimators; t++) {
      const sampleIndices: number[] = [];
      for (let i = 0; i < n; i++) {
        sampleIndices.push((i * 19 + t * 29) % n);
      }

      let bestVarianceReduction = -1;
      let bestTree = { featureIdx: 0, threshold: 0, leftVal: this.baseMean, rightVal: this.baseMean };

      for (let j = 0; j < p; j++) {
        const sortedVals = sampleIndices.map((i) => X[i][j]).sort((a, b) => a - b);
        const threshold = sortedVals[Math.floor(sortedVals.length / 2)];

        let leftSum = 0, leftCount = 0;
        let rightSum = 0, rightCount = 0;

        for (const idx of sampleIndices) {
          if (X[idx][j] <= threshold) {
            leftSum += y[idx];
            leftCount++;
          } else {
            rightSum += y[idx];
            rightCount++;
          }
        }

        if (leftCount > 0 && rightCount > 0) {
          const leftMean = leftSum / leftCount;
          const rightMean = rightSum / rightCount;
          const reduction = Math.abs(leftMean - rightMean);
          if (reduction > bestVarianceReduction) {
            bestVarianceReduction = reduction;
            bestTree = { featureIdx: j, threshold, leftVal: leftMean, rightVal: rightMean };
          }
        }
      }

      this.trees.push(bestTree);
    }

    return {
      modelType: "DECISION_FOREST",
      hyperparameters: { numEstimators: this.numEstimators },
      scaler: { means: [], stds: [] },
      featureNames,
      iterationsTrained: this.numEstimators,
      converged: true,
      trainingDurationMs: Date.now() - startTime,
    };
  }

  public predict(x: number[]): number {
    if (this.trees.length === 0) return Math.max(0, this.baseMean);
    let sum = 0;
    for (const tree of this.trees) {
      sum += x[tree.featureIdx] <= tree.threshold ? tree.leftVal : tree.rightVal;
    }
    return Math.max(0, Math.round((sum / this.trees.length) * 100) / 100);
  }
}

export class GradientBoostingRegressor {
  private baseMean = 30;
  private trees: Array<{ featureIdx: number; threshold: number; leftVal: number; rightVal: number }> = [];

  constructor(
    private numEstimators = 15,
    private learningRate = 0.1
  ) {}

  public fit(X: number[][], y: number[], featureNames: string[]): ModelTrainingResult {
    const startTime = Date.now();
    const n = X.length;
    const p = X[0].length;
    this.baseMean = y.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const F = new Array(n).fill(this.baseMean);
    this.trees = [];

    for (let iter = 0; iter < this.numEstimators; iter++) {
      const residuals = y.map((val, i) => val - F[i]);

      let bestLoss = Infinity;
      let bestTree = { featureIdx: 0, threshold: 0, leftVal: 0, rightVal: 0 };

      for (let j = 0; j < p; j++) {
        const sortedVals = X.map((r) => r[j]).sort((a, b) => a - b);
        const threshold = sortedVals[Math.floor(sortedVals.length / 2)];

        let leftSum = 0, leftCount = 0;
        let rightSum = 0, rightCount = 0;

        for (let i = 0; i < n; i++) {
          if (X[i][j] <= threshold) {
            leftSum += residuals[i];
            leftCount++;
          } else {
            rightSum += residuals[i];
            rightCount++;
          }
        }

        const leftVal = leftCount > 0 ? leftSum / leftCount : 0;
        const rightVal = rightCount > 0 ? rightSum / rightCount : 0;

        let loss = 0;
        for (let i = 0; i < n; i++) {
          const pred = X[i][j] <= threshold ? leftVal : rightVal;
          loss += Math.pow(residuals[i] - pred, 2);
        }

        if (loss < bestLoss) {
          bestLoss = loss;
          bestTree = { featureIdx: j, threshold, leftVal, rightVal };
        }
      }

      this.trees.push(bestTree);

      for (let i = 0; i < n; i++) {
        const delta = X[i][bestTree.featureIdx] <= bestTree.threshold ? bestTree.leftVal : bestTree.rightVal;
        F[i] += this.learningRate * delta;
      }
    }

    return {
      modelType: "DECISION_FOREST",
      hyperparameters: { numEstimators: this.numEstimators, learningRate: this.learningRate },
      scaler: { means: [], stds: [] },
      featureNames,
      iterationsTrained: this.numEstimators,
      converged: true,
      trainingDurationMs: Date.now() - startTime,
    };
  }

  public predict(x: number[]): number {
    let F = this.baseMean;
    for (const tree of this.trees) {
      const delta = x[tree.featureIdx] <= tree.threshold ? tree.leftVal : tree.rightVal;
      F += this.learningRate * delta;
    }
    return Math.max(0, Math.round(F * 100) / 100);
  }
}

