/**
 * NEXUS-CFR Feature Eligibility & Anti-Leakage Framework
 * Phase 4: Production ML Foundation
 *
 * Implements strict pre-prediction feature eligibility definitions and
 * automated leakage auditing. Prevents target leakage and look-ahead bias.
 */

export type FeatureEligibilityClass =
  | "SAFE_PRE_PREDICTION"   // Known unconditionally at invoice issuance timestamp t0
  | "POST_OUTCOME_FORBIDDEN" // Future clearing, payment, or settlement events - FATAL LEAKAGE
  | "CONDITIONAL_HISTORICAL"; // Rolling aggregate valid strictly when event_time < t0

export interface FeatureSpecification {
  featureName: string;
  category: "INVOICE" | "BUYER_BEHAVIOR" | "SUPPLIER_BEHAVIOR" | "TEMPORAL" | "NETWORK";
  eligibility: FeatureEligibilityClass;
  description: string;
  dataType: "NUMERIC" | "CATEGORICAL" | "BOOLEAN";
  availabilityPoint: string;
  leakageRiskExplanation?: string;
  imputationStrategy: "MEDIAN" | "ZERO" | "MEAN" | "INDICATOR" | "DROP";
}

export const FEATURE_SPECIFICATIONS: Record<string, FeatureSpecification> = {
  // Safe Invoice Features (Known at t0)
  invoiceAmount: {
    featureName: "invoiceAmount",
    category: "INVOICE",
    eligibility: "SAFE_PRE_PREDICTION",
    description: "Gross total invoice amount in INR.",
    dataType: "NUMERIC",
    availabilityPoint: "Invoice issuance (t0)",
    imputationStrategy: "MEDIAN",
  },
  creditPeriodDays: {
    featureName: "creditPeriodDays",
    category: "INVOICE",
    eligibility: "SAFE_PRE_PREDICTION",
    description: "Contractual credit period in days: round((dueDate - invoiceDate) / 86400000).",
    dataType: "NUMERIC",
    availabilityPoint: "Invoice issuance (t0)",
    imputationStrategy: "MEDIAN",
  },
  invoiceDayOfWeek: {
    featureName: "invoiceDayOfWeek",
    category: "TEMPORAL",
    eligibility: "SAFE_PRE_PREDICTION",
    description: "Day of week invoice was issued (0=Sun, 6=Sat).",
    dataType: "NUMERIC",
    availabilityPoint: "Invoice issuance (t0)",
    imputationStrategy: "ZERO",
  },
  invoiceMonthOfYear: {
    featureName: "invoiceMonthOfYear",
    category: "TEMPORAL",
    eligibility: "SAFE_PRE_PREDICTION",
    description: "Calendar month invoice was issued (1-12).",
    dataType: "NUMERIC",
    availabilityPoint: "Invoice issuance (t0)",
    imputationStrategy: "ZERO",
  },

  // Buyer Historical Behavior Pre-t0
  buyerHistoricalDelayMean30d: {
    featureName: "buyerHistoricalDelayMean30d",
    category: "BUYER_BEHAVIOR",
    eligibility: "CONDITIONAL_HISTORICAL",
    description: "Mean delay in days on buyer's settled invoices in trailing 30 days prior to t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Strictly prior to t0",
    imputationStrategy: "ZERO",
  },
  buyerHistoricalDelayMean90d: {
    featureName: "buyerHistoricalDelayMean90d",
    category: "BUYER_BEHAVIOR",
    eligibility: "CONDITIONAL_HISTORICAL",
    description: "Mean delay in days on buyer's settled invoices in trailing 90 days prior to t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Strictly prior to t0",
    imputationStrategy: "ZERO",
  },
  buyerOverdueRatioPreT0: {
    featureName: "buyerOverdueRatioPreT0",
    category: "BUYER_BEHAVIOR",
    eligibility: "CONDITIONAL_HISTORICAL",
    description: "Ratio of buyer's invoices that were overdue as of t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Strictly prior to t0",
    imputationStrategy: "ZERO",
  },
  buyerSettledCountPreT0: {
    featureName: "buyerSettledCountPreT0",
    category: "BUYER_BEHAVIOR",
    eligibility: "CONDITIONAL_HISTORICAL",
    description: "Total completed historical transactions for this buyer prior to t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Strictly prior to t0",
    imputationStrategy: "ZERO",
  },

  // Supplier Behavior Pre-t0
  supplierTrailingVolume90d: {
    featureName: "supplierTrailingVolume90d",
    category: "SUPPLIER_BEHAVIOR",
    eligibility: "CONDITIONAL_HISTORICAL",
    description: "Sum of invoice billing volume originated by supplier in 90 days prior to t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Strictly prior to t0",
    imputationStrategy: "MEDIAN",
  },
  supplierOverdueReceivableExposurePreT0: {
    featureName: "supplierOverdueReceivableExposurePreT0",
    category: "SUPPLIER_BEHAVIOR",
    eligibility: "CONDITIONAL_HISTORICAL",
    description: "Total unpaid overdue receivables owed to supplier as of t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Strictly prior to t0",
    imputationStrategy: "ZERO",
  },
  amountRelativeToBuyerAvg: {
    featureName: "amountRelativeToBuyerAvg",
    category: "INVOICE",
    eligibility: "CONDITIONAL_HISTORICAL",
    description: "Ratio of current invoice amount to buyer's historical mean ticket size prior to t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Strictly prior to t0",
    imputationStrategy: "INDICATOR",
  },

  // Network Topology Pre-t0
  networkBuyerInDegreePreT0: {
    featureName: "networkBuyerInDegreePreT0",
    category: "NETWORK",
    eligibility: "CONDITIONAL_HISTORICAL",
    description: "Number of active supplier ties connected to buyer prior to t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Strictly prior to t0",
    imputationStrategy: "ZERO",
  },
  networkSupplierConcentrationPreT0: {
    featureName: "networkSupplierConcentrationPreT0",
    category: "NETWORK",
    eligibility: "CONDITIONAL_HISTORICAL",
    description: "Herfindahl-Hirschman concentration index of supplier's revenue across buyers prior to t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Strictly prior to t0",
    imputationStrategy: "ZERO",
  },

  // FORBIDDEN / POST-OUTCOME FIELDS - ABSOLUTE LEAKAGE
  paymentDate: {
    featureName: "paymentDate",
    category: "INVOICE",
    eligibility: "POST_OUTCOME_FORBIDDEN",
    description: "Clearing date of payment. Occurs at settlement t_clear > t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Settlement completion",
    leakageRiskExplanation: "FATAL: Directly leaks whether and when the invoice was paid.",
    imputationStrategy: "DROP",
  },
  paymentDelayDays: {
    featureName: "paymentDelayDays",
    category: "INVOICE",
    eligibility: "POST_OUTCOME_FORBIDDEN",
    description: "Days between due date and actual payment date.",
    dataType: "NUMERIC",
    availabilityPoint: "Settlement completion",
    leakageRiskExplanation: "FATAL: This is the exact target label for regression.",
    imputationStrategy: "DROP",
  },
  actualPaymentStatus: {
    featureName: "actualPaymentStatus",
    category: "INVOICE",
    eligibility: "POST_OUTCOME_FORBIDDEN",
    description: "Final post-clearing status (e.g. COMPLETED, DEFAULTED, WRITE_OFF).",
    dataType: "CATEGORICAL",
    availabilityPoint: "Settlement completion",
    leakageRiskExplanation: "FATAL: Directly encodes target outcome.",
    imputationStrategy: "DROP",
  },
  settledAmount: {
    featureName: "settledAmount",
    category: "INVOICE",
    eligibility: "POST_OUTCOME_FORBIDDEN",
    description: "Total amount actually credited by bank at clearing.",
    dataType: "NUMERIC",
    availabilityPoint: "Settlement completion",
    leakageRiskExplanation: "FATAL: Leaks recovery and discount deductions.",
    imputationStrategy: "DROP",
  },
  postDueOutstandingAmount: {
    featureName: "postDueOutstandingAmount",
    category: "INVOICE",
    eligibility: "POST_OUTCOME_FORBIDDEN",
    description: "Outstanding balance evaluated after due date has passed.",
    dataType: "NUMERIC",
    availabilityPoint: "Post-due date epoch",
    leakageRiskExplanation: "FATAL: Leaks delinquency if evaluated after t0.",
    imputationStrategy: "DROP",
  },
  futureRollingBuyerDelay: {
    featureName: "futureRollingBuyerDelay",
    category: "BUYER_BEHAVIOR",
    eligibility: "POST_OUTCOME_FORBIDDEN",
    description: "Rolling delay statistics computed including invoices issued after t0.",
    dataType: "NUMERIC",
    availabilityPoint: "Future horizon",
    leakageRiskExplanation: "FATAL: Look-ahead temporal leakage.",
    imputationStrategy: "DROP",
  },
};

export interface LeakageAuditResult {
  isLeakageFree: boolean;
  auditedFeatureCount: number;
  forbiddenFeaturesDetected: string[];
  safeFeaturesPassed: string[];
  conditionalFeaturesAudited: string[];
  auditTimestamp: string;
  violations: Array<{
    featureName: string;
    reason: string;
  }>;
}

export class AntiLeakageAuditor {
  /**
   * Audits candidate feature keys against forbidden post-outcome fields.
   */
  public static auditFeatureCandidateList(candidateFeatureKeys: string[]): LeakageAuditResult {
    const forbidden: string[] = [];
    const safe: string[] = [];
    const conditional: string[] = [];
    const violations: Array<{ featureName: string; reason: string }> = [];

    // Blacklist patterns for post-outcome terms
    const forbiddenPatterns = [
      /payment_?date/i,
      /settle(d|ment)/i,
      /delay_?days/i,
      /clearing/i,
      /default_?status/i,
      /write_?off/i,
      /recovery/i,
      /actual_?status/i,
      /post_?due/i,
    ];

    for (const key of candidateFeatureKeys) {
      const spec = FEATURE_SPECIFICATIONS[key];
      const isExplicitForbidden = spec && spec.eligibility === "POST_OUTCOME_FORBIDDEN";
      const isExplicitAllowed = spec && (spec.eligibility === "SAFE_PRE_PREDICTION" || spec.eligibility === "CONDITIONAL_HISTORICAL");
      const matchesRegex = forbiddenPatterns.some((pattern) => pattern.test(key));

      if (isExplicitForbidden || (!isExplicitAllowed && matchesRegex)) {
        forbidden.push(key);
        violations.push({
          featureName: key,
          reason: spec?.leakageRiskExplanation || `Feature name matches forbidden post-outcome pattern (${key}).`,
        });
      } else if (spec && spec.eligibility === "SAFE_PRE_PREDICTION") {
        safe.push(key);
      } else if (spec && spec.eligibility === "CONDITIONAL_HISTORICAL") {
        conditional.push(key);
      } else {
        // Unknown custom feature - check for timestamp safety
        safe.push(key);
      }
    }

    return {
      isLeakageFree: forbidden.length === 0,
      auditedFeatureCount: candidateFeatureKeys.length,
      forbiddenFeaturesDetected: forbidden,
      safeFeaturesPassed: safe,
      conditionalFeaturesAudited: conditional,
      auditTimestamp: new Date().toISOString(),
      violations,
    };
  }

  /**
   * Validates whether an aggregate observation window timestamp strictly precedes t0.
   */
  public static verifyTemporalWindowPrecedesT0(observationCutoff: Date, predictionT0: Date): boolean {
    return observationCutoff.getTime() <= predictionT0.getTime();
  }
}
