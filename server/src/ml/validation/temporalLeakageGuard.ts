/**
 * NEXUS-CFR Temporal Leakage Hardening Guard
 * Phase 4.5: ML Production Hardening & Data-Arrival Readiness
 *
 * Enforces strict temporal boundaries:
 * 1. feature_information_time < t0 (HARD FAIL if violated).
 * 2. max(train event time) < min(val prediction time).
 * 3. max(val event time) < min(test prediction time).
 */

export class TemporalLeakageError extends Error {
  constructor(message: string, public readonly details?: Record<string, any>) {
    super(message);
    this.name = "TemporalLeakageError";
  }
}

export class TemporalLeakageGuard {
  /**
   * Asserts that an event timestamp strictly precedes the prediction anchor time t0.
   * Throws TemporalLeakageError on any look-ahead violation.
   */
  public static assertPrecedesT0(
    eventTimestamp: Date | string | number,
    predictionT0: Date | string | number,
    featureName: string,
    invoiceId: string
  ): void {
    const eventTime = new Date(eventTimestamp).getTime();
    const t0 = new Date(predictionT0).getTime();

    if (isNaN(eventTime) || isNaN(t0)) {
      throw new TemporalLeakageError(
        `Invalid timestamp provided for temporal leakage check on feature '${featureName}'.`
      );
    }

    if (eventTime >= t0) {
      throw new TemporalLeakageError(
        `FATAL TEMPORAL LEAKAGE: Feature '${featureName}' for invoice '${invoiceId}' uses information from ${new Date(
          eventTime
        ).toISOString()} which does not strictly precede prediction anchor t0 (${new Date(t0).toISOString()}).`,
        {
          featureName,
          invoiceId,
          eventTime: new Date(eventTime).toISOString(),
          predictionT0: new Date(t0).toISOString(),
          lookaheadViolationMs: eventTime - t0,
        }
      );
    }
  }

  /**
   * Validates that historical transaction features were aggregated strictly prior to t0.
   */
  public static validateHistoricalFeatureCutoff(
    historicalTransactions: Array<{ id: string; paymentDate?: Date | string | null }>,
    predictionT0: Date | string | number,
    featureName: string
  ): void {
    const t0 = new Date(predictionT0).getTime();

    for (const tx of historicalTransactions) {
      if (tx.paymentDate) {
        const payTime = new Date(tx.paymentDate).getTime();
        if (payTime >= t0) {
          throw new TemporalLeakageError(
            `FATAL TEMPORAL CONTAMINATION: Historical aggregation for '${featureName}' included payment settlement at ${new Date(
              payTime
            ).toISOString()} which occurred on or after prediction timestamp ${new Date(t0).toISOString()}.`
          );
        }
      }
    }
  }

  /**
   * Validates non-overlapping temporal cohort boundaries with optional embargo gap.
   */
  public static validateCohortBoundaries(
    trainEnd: Date | string,
    valStart: Date | string,
    valEnd?: Date | string,
    testStart?: Date | string,
    requiredEmbargoDays = 0
  ): boolean {
    const trainEndTime = new Date(trainEnd).getTime();
    const valStartTime = new Date(valStart).getTime();
    const requiredGapMs = requiredEmbargoDays * 24 * 60 * 60 * 1000;

    if (valStartTime < trainEndTime + requiredGapMs) {
      throw new TemporalLeakageError(
        `Temporal boundary violation: valStart (${new Date(
          valStartTime
        ).toISOString()}) must be >= trainEnd (${new Date(trainEndTime).toISOString()}) + ${requiredEmbargoDays} days embargo.`
      );
    }

    if (valEnd && testStart) {
      const valEndTime = new Date(valEnd).getTime();
      const testStartTime = new Date(testStart).getTime();
      if (testStartTime < valEndTime + requiredGapMs) {
        throw new TemporalLeakageError(
          `Temporal boundary violation: testStart (${new Date(
            testStartTime
          ).toISOString()}) must be >= valEnd (${new Date(valEndTime).toISOString()}) + ${requiredEmbargoDays} days embargo.`
        );
      }
    }

    return true;
  }
}
