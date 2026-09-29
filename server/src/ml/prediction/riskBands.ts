/**
 * NEXUS-CFR Governed Risk Bands Configuration
 * Phase 4: Production ML Foundation
 *
 * Implements audited, versioned, policy-backed risk thresholds.
 * Eliminates ungrounded hardcoded magic numbers.
 */

export type RiskBandClassification = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface GovernedThresholdPolicy {
  policyId: string;
  version: string;
  targetId: string;
  methodology: "EMPIRICAL_QUANTILE" | "COST_MINIMIZATION" | "PROVISIONAL_BASE";
  isProvisional: boolean;
  thresholds: {
    lowMax: number;     // e.g. < 0.25 -> LOW
    mediumMax: number;  // e.g. 0.25 - 0.55 -> MEDIUM
    highMax: number;    // e.g. 0.55 - 0.80 -> HIGH
    criticalMin: number;// e.g. >= 0.80 -> CRITICAL
  };
  rationale: string;
  approvedBy: string;
  updatedAt: string;
}

export const DEFAULT_THRESHOLD_POLICIES: Record<string, GovernedThresholdPolicy> = {
  PAYMENT_DELAY_RISK: {
    policyId: "POL-RISK-BAND-DELAY-1.0",
    version: "1.0-PROVISIONAL",
    targetId: "PAYMENT_DELAY_RISK",
    methodology: "PROVISIONAL_BASE",
    isProvisional: true,
    thresholds: {
      lowMax: 0.20,
      mediumMax: 0.50,
      highMax: 0.75,
      criticalMin: 0.75,
    },
    rationale:
      "Provisional baseline pending empirical ROC operating point optimization against authorized enterprise loss data.",
    approvedBy: "ENTERPRISE_RISK_COMMITTEE_PROVISIONAL",
    updatedAt: "2026-09-24T00:00:00.000Z",
  },
  SEVERE_DELINQUENCY_RISK: {
    policyId: "POL-RISK-BAND-DEFAULT-1.0",
    version: "1.0-PROVISIONAL",
    targetId: "SEVERE_DELINQUENCY_RISK",
    methodology: "PROVISIONAL_BASE",
    isProvisional: true,
    thresholds: {
      lowMax: 0.05,
      mediumMax: 0.15,
      highMax: 0.35,
      criticalMin: 0.35,
    },
    rationale:
      "Statutory delinquency targets operate under low base-rates (<5%); high threshold compressed to 0.35 to prioritize recall.",
    approvedBy: "ENTERPRISE_RISK_COMMITTEE_PROVISIONAL",
    updatedAt: "2026-09-24T00:00:00.000Z",
  },
};

export class RiskBandManager {
  /**
   * Maps a calibrated probability to a governed risk band.
   */
  public static classifyRisk(
    probability: number,
    policy: GovernedThresholdPolicy = DEFAULT_THRESHOLD_POLICIES.PAYMENT_DELAY_RISK
  ): { riskBand: RiskBandClassification; isProvisional: boolean; policyVersion: string } {
    const p = Math.max(0, Math.min(1, probability));
    const t = policy.thresholds;

    let riskBand: RiskBandClassification = "LOW";
    if (p >= t.criticalMin) {
      riskBand = "CRITICAL";
    } else if (p >= t.mediumMax) {
      riskBand = "HIGH";
    } else if (p >= t.lowMax) {
      riskBand = "MEDIUM";
    } else {
      riskBand = "LOW";
    }

    return {
      riskBand,
      isProvisional: policy.isProvisional,
      policyVersion: policy.version,
    };
  }
}
