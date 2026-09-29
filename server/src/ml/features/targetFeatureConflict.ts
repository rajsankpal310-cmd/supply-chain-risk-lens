/**
 * NEXUS-CFR Target <-> Feature Conflict Checker
 * Phase 4.5: ML Production Hardening & Data-Arrival Readiness
 *
 * Automatically inspects candidate feature lists against target-generation fields.
 * Prevents any component of the mathematical label formulation from leaking into
 * the feature matrix.
 */

import { TARGET_REGISTRY, TargetDefinition } from "../targets/targetRegistry";

export interface TargetConflictAudit {
  targetId: string;
  hasTargetFeatureConflict: boolean;
  conflictingFeatures: Array<{
    featureName: string;
    conflictingTargetField: string;
    reason: string;
  }>;
  auditPassed: boolean;
  auditSummary: string;
}

export class TargetFeatureConflictChecker {
  /**
   * Blacklisted target-generation fields mapped by target ID
   */
  private static readonly TARGET_GENERATION_FIELDS: Record<string, string[]> = {
    PAYMENT_DELAY_RISK: [
      "paymentDate",
      "payment_date",
      "paymentDelayDays",
      "payment_delay_days",
      "actualPaymentStatus",
      "settledAmount",
      "clearingDate",
      "daysOverduePostMaturity",
      "finalStatus",
    ],
    PAYMENT_DELAY_SEVERITY: [
      "paymentDate",
      "payment_date",
      "paymentDelayDays",
      "payment_delay_days",
      "actualPaymentStatus",
      "settledAmount",
      "clearingDate",
      "exactDelayDays",
    ],
    SEVERE_DELINQUENCY_RISK: [
      "dpd",
      "daysPastDue",
      "statutoryDefaultFlag",
      "writeOffAmount",
      "recoveryAmount",
      "npaClassification",
      "legalFreezeDate",
    ],
    SME_FINANCIAL_STRESS: [
      "futureOverdueExposure",
      "realizedQuarterlyVolume",
      "realizedDSO",
      "postHorizonReceivables",
    ],
  };

  /**
   * Audits candidate feature names against target generation fields.
   */
  public static auditTargetFeatureConflict(
    targetId: string,
    candidateFeatureNames: string[]
  ): TargetConflictAudit {
    const forbiddenTargetFields = this.TARGET_GENERATION_FIELDS[targetId] || this.TARGET_GENERATION_FIELDS.PAYMENT_DELAY_RISK;
    const targetDef: TargetDefinition = TARGET_REGISTRY[targetId] || TARGET_REGISTRY.PAYMENT_DELAY_RISK;

    const conflictingFeatures: Array<{
      featureName: string;
      conflictingTargetField: string;
      reason: string;
    }> = [];

    for (const feat of candidateFeatureNames) {
      const lowerFeat = feat.toLowerCase();
      for (const field of forbiddenTargetFields) {
        if (lowerFeat === field.toLowerCase() || lowerFeat.includes(field.toLowerCase())) {
          conflictingFeatures.push({
            featureName: feat,
            conflictingTargetField: field,
            reason: `Feature '${feat}' is a constitutive component of target formula '${targetDef.formula}' and leaks future outcome status.`,
          });
          break;
        }
      }
    }

    const hasConflict = conflictingFeatures.length > 0;
    const auditPassed = !hasConflict;

    return {
      targetId,
      hasTargetFeatureConflict: hasConflict,
      conflictingFeatures,
      auditPassed,
      auditSummary: auditPassed
        ? `AUDIT PASSED: Zero target generation fields found in candidate feature list for target '${targetId}'.`
        : `FATAL TARGET LEAKAGE: Detected ${conflictingFeatures.length} target generation fields in candidate feature list: ${conflictingFeatures
            .map((c) => c.featureName)
            .join(", ")}`,
    };
  }
}
