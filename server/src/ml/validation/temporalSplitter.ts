/**
 * NEXUS-CFR Temporal Validation & Chronological Splitter
 * Phase 4: Production ML Foundation
 *
 * Implements strict out-of-time chronological partitioning.
 * Random train/test split is strictly rejected.
 * Guarantees zero look-ahead bias between train, validation, and test cohorts.
 */

export interface DatedRecord {
  id: string;
  invoiceDate: Date | string;
  [key: string]: any;
}

export interface TemporalSplitResult<T extends DatedRecord> {
  splitStrategy: "OUT_OF_TIME_CHRONOLOGICAL" | "WALK_FORWARD_EXPANDING";
  trainSet: T[];
  validationSet: T[];
  testSet: T[];
  trainWindow: { start: string; end: string; count: number };
  valWindow: { start: string; end: string; count: number };
  testWindow: { start: string; end: string; count: number };
  temporalIntegrityVerified: boolean;
  leakageCheckMessage: string;
}

export interface WalkForwardFold<T extends DatedRecord> {
  foldIndex: number;
  trainWindow: { start: string; end: string; count: number };
  testWindow: { start: string; end: string; count: number };
  trainSet: T[];
  testSet: T[];
}

export class TemporalSplitter {
  /**
   * Partitions records chronologically into Train (60%), Validation (20%), Out-of-Time Test (20%).
   */
  public static splitChronological<T extends DatedRecord>(
    records: T[],
    trainRatio = 0.6,
    valRatio = 0.2,
    embargoDays = 0
  ): TemporalSplitResult<T> {
    if (records.length < 5) {
      throw new Error(`Insufficient records for temporal split. Found only ${records.length} records.`);
    }

    // 1. Sort strictly by invoiceDate ascending
    const sorted = [...records].sort((a, b) => {
      const ta = new Date(a.invoiceDate).getTime();
      const tb = new Date(b.invoiceDate).getTime();
      return ta - tb;
    });

    const n = sorted.length;
    const trainEndIdx = Math.max(1, Math.floor(n * trainRatio));
    const valEndIdx = Math.max(trainEndIdx + 1, Math.floor(n * (trainRatio + valRatio)));

    const rawTrainSet = sorted.slice(0, trainEndIdx);
    let rawValidationSet = sorted.slice(trainEndIdx, valEndIdx);
    let rawTestSet = sorted.slice(valEndIdx);

    // Apply optional temporal embargo buffer between Train and Val/Test
    if (embargoDays > 0 && rawTrainSet.length > 0) {
      const embargoMs = embargoDays * 24 * 60 * 60 * 1000;
      const trainMaxTime = new Date(rawTrainSet[rawTrainSet.length - 1].invoiceDate).getTime();
      const valThreshold = trainMaxTime + embargoMs;
      rawValidationSet = rawValidationSet.filter(
        (r) => new Date(r.invoiceDate).getTime() >= valThreshold
      );

      if (rawValidationSet.length > 0) {
        const valMaxTime = new Date(rawValidationSet[rawValidationSet.length - 1].invoiceDate).getTime();
        const testThreshold = valMaxTime + embargoMs;
        rawTestSet = rawTestSet.filter(
          (r) => new Date(r.invoiceDate).getTime() >= testThreshold
        );
      }
    }

    const trainSet = rawTrainSet;
    const validationSet = rawValidationSet;
    const testSet = rawTestSet;

    // 2. Validate strict non-overlapping temporal ordering
    const trainMax = trainSet.length > 0 ? new Date(trainSet[trainSet.length - 1].invoiceDate).getTime() : 0;
    const valMin = validationSet.length > 0 ? new Date(validationSet[0].invoiceDate).getTime() : trainMax;
    const valMax = validationSet.length > 0 ? new Date(validationSet[validationSet.length - 1].invoiceDate).getTime() : valMin;
    const testMin = testSet.length > 0 ? new Date(testSet[0].invoiceDate).getTime() : valMax;

    const noLeakageTrainVal = trainSet.length === 0 || validationSet.length === 0 || trainMax <= valMin;
    const noLeakageValTest = validationSet.length === 0 || testSet.length === 0 || valMax <= testMin;
    const temporalIntegrityVerified = noLeakageTrainVal && noLeakageValTest;

    const leakageCheckMessage = temporalIntegrityVerified
      ? "PASSED: Temporal boundary verified. trainMax <= valMin <= valMax <= testMin."
      : "FAILED: Temporal overlap detected between validation and training cohorts!";

    return {
      splitStrategy: "OUT_OF_TIME_CHRONOLOGICAL",
      trainSet,
      validationSet,
      testSet,
      trainWindow: {
        start: trainSet.length > 0 ? new Date(trainSet[0].invoiceDate).toISOString() : "N/A",
        end: trainSet.length > 0 ? new Date(trainSet[trainSet.length - 1].invoiceDate).toISOString() : "N/A",
        count: trainSet.length,
      },
      valWindow: {
        start: validationSet.length > 0 ? new Date(validationSet[0].invoiceDate).toISOString() : "N/A",
        end: validationSet.length > 0 ? new Date(validationSet[validationSet.length - 1].invoiceDate).toISOString() : "N/A",
        count: validationSet.length,
      },
      testWindow: {
        start: testSet.length > 0 ? new Date(testSet[0].invoiceDate).toISOString() : "N/A",
        end: testSet.length > 0 ? new Date(testSet[testSet.length - 1].invoiceDate).toISOString() : "N/A",
        count: testSet.length,
      },
      temporalIntegrityVerified,
      leakageCheckMessage,
    };
  }

  /**
   * Generates expanding-window walk-forward folds for backtesting.
   */
  public static generateWalkForwardFolds<T extends DatedRecord>(
    records: T[],
    minTrainSize: number,
    stepSize: number
  ): WalkForwardFold<T>[] {
    const sorted = [...records].sort((a, b) => {
      const ta = new Date(a.invoiceDate).getTime();
      const tb = new Date(b.invoiceDate).getTime();
      return ta - tb;
    });

    const folds: WalkForwardFold<T>[] = [];
    let currentTrainEnd = minTrainSize;
    let foldIdx = 1;

    while (currentTrainEnd + stepSize <= sorted.length) {
      const trainSet = sorted.slice(0, currentTrainEnd);
      const testSet = sorted.slice(currentTrainEnd, currentTrainEnd + stepSize);

      folds.push({
        foldIndex: foldIdx++,
        trainWindow: {
          start: new Date(trainSet[0].invoiceDate).toISOString(),
          end: new Date(trainSet[trainSet.length - 1].invoiceDate).toISOString(),
          count: trainSet.length,
        },
        testWindow: {
          start: new Date(testSet[0].invoiceDate).toISOString(),
          end: new Date(testSet[testSet.length - 1].invoiceDate).toISOString(),
          count: testSet.length,
        },
        trainSet,
        testSet,
      });

      currentTrainEnd += stepSize;
    }

    return folds;
  }
}
