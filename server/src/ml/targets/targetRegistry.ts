/**
 * NEXUS-CFR Machine Learning Target Registry
 * Phase 4 & Phase 8: Production ML Target Specification
 *
 * Defines formal mathematical and business prediction targets.
 * Strict rules:
 * - If contractual due date is not available (e.g. ERP event logs like BPI 2019),
 *   contractual delay targets are marked UNAVAILABLE_FOR_CURRENT_SOURCE.
 * - Operational payment cycle duration & exception targets are used instead.
 * - PROJECT_DEFINED_OPERATIONAL_THRESHOLD is explicitly declared and never called contractual delinquency.
 */

export type TargetProblemType = "BINARY_CLASSIFICATION" | "REGRESSION";

export interface TargetDefinition {
  targetId: string;
  name: string;
  version: string;
  problemType: TargetProblemType;
  description: string;
  businessDefinition: string;
  predictionPoint: string; // Anchor timestamp t0
  predictionHorizonDays: number;
  labelConstructionRule: string;
  formula: string;
  compatibleSourceTypes: string[];
  thresholdPolicyType?: "PROJECT_DEFINED_OPERATIONAL_THRESHOLD" | "STATUTORY_DUE_DATE" | "CONTINUOUS_DURATION";
  operationalThresholdDays?: number;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  censoringTreatment: {
    handlesRightCensoring: boolean;
    strategy: "EXCLUDE_OPEN_INVOICES" | "SURVIVAL_DURATION_MODEL" | "CENSORED_LIKELIHOOD";
    naiveImputationRule: string;
    censoringWarning: string;
  };
  minimumDataRequirements: {
    minimumSampleObservations: number;
    minimumDistinctBuyers: number;
    minimumPositiveEvents?: number;
    minimumLongitudinalMonths: number;
  };
  leakageReviewStatus: "VERIFIED_SAFE" | "REQUIRES_AUDIT";
  governanceLabel: string;
}

export const TARGET_REGISTRY: Record<string, TargetDefinition> = {
  // TARGET 1: PAYMENT_CYCLE_DURATION (Continuous Process Duration)
  PAYMENT_CYCLE_DURATION: {
    targetId: "PAYMENT_CYCLE_DURATION",
    name: "Observed Payment Cycle Duration (Days)",
    version: "2.0",
    problemType: "REGRESSION",
    description: "Predicts elapsed days between invoice receipt/creation and clearing settlement in purchase-to-pay lifecycles.",
    businessDefinition:
      "Calculated as (Clear Invoice timestamp - Invoice Receipt/Creation timestamp) in fractional calendar days. Based purely on observed ERP event transitions without assuming contractual due dates.",
    predictionPoint: "Invoice receipt / creation timestamp (t0).",
    predictionHorizonDays: 180,
    labelConstructionRule: "duration_days = round((clear_invoice_timestamp - invoice_receipt_timestamp) / 86400000, 2).",
    formula: "y = (t_clear - t_invoice) / 86400",
    compatibleSourceTypes: ["ERP_EVENT_LOG_DATA", "INVOICE_LIFECYCLE_DATA"],
    thresholdPolicyType: "CONTINUOUS_DURATION",
    inclusionCriteria: [
      "Completed P2P lifecycles with both invoice registration and clearing timestamps.",
      "Positive duration (clearing occurs on or after invoice receipt).",
    ],
    exclusionCriteria: [
      "Uncompleted/open vouchers with no observed clearing event.",
      "Canceled, reversed, or credit-memo offset items.",
    ],
    censoringTreatment: {
      handlesRightCensoring: true,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule: "Never zero-impute or arbitrarily cap durations for open un-cleared vouchers.",
      censoringWarning: "Evaluation restricted to completed lifecycles. Open cases must be evaluated with survival censoring.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 50,
      minimumDistinctBuyers: 2,
      minimumLongitudinalMonths: 3,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
    governanceLabel: "OBSERVED_PROCESS_CYCLE_DURATION",
  },

  // TARGET 2: PAYMENT_CYCLE_RISK (Binary Threshold on Observed Duration)
  PAYMENT_CYCLE_RISK: {
    targetId: "PAYMENT_CYCLE_RISK",
    name: "Payment Cycle Risk (Operational Threshold Exceeded)",
    version: "2.0",
    problemType: "BINARY_CLASSIFICATION",
    description: "Predicts probability that observed payment cycle duration will exceed a governed operational threshold.",
    businessDefinition:
      "Binary target (1 = cycle duration > PROJECT_DEFINED_OPERATIONAL_THRESHOLD, 0 = cycle duration <= threshold). This represents operational process extension, NOT contractual delinquency.",
    predictionPoint: "Invoice receipt / creation timestamp (t0).",
    predictionHorizonDays: 90,
    labelConstructionRule: "y = (process_duration_days > operationalThresholdDays) ? 1 : 0.",
    formula: "y = I(process_duration_days > PROJECT_DEFINED_OPERATIONAL_THRESHOLD)",
    compatibleSourceTypes: ["ERP_EVENT_LOG_DATA", "INVOICE_LIFECYCLE_DATA"],
    thresholdPolicyType: "PROJECT_DEFINED_OPERATIONAL_THRESHOLD",
    operationalThresholdDays: 45, // Configurable operational standard (e.g. 45 days)
    inclusionCriteria: [
      "Completed cases with verified invoice receipt and clearing timestamps.",
      "Valid vendor and company assignments.",
    ],
    exclusionCriteria: [
      "Open vouchers within the operational window.",
      "Voided or reversed accounting documents.",
    ],
    censoringTreatment: {
      handlesRightCensoring: true,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule: "Do not assume young open items are low-risk (label 0) before threshold elapses.",
      censoringWarning: "Class balance evaluated over completed cohorts.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 50,
      minimumDistinctBuyers: 2,
      minimumPositiveEvents: 10,
      minimumLongitudinalMonths: 3,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
    governanceLabel: "PROJECT_DEFINED_OPERATIONAL_THRESHOLD",
  },

  // TARGET 3: PAYMENT_CYCLE_SEVERITY (Regression Days)
  PAYMENT_CYCLE_SEVERITY: {
    targetId: "PAYMENT_CYCLE_SEVERITY",
    name: "Payment Cycle Severity (Excess Days Over Baseline)",
    version: "2.0",
    problemType: "REGRESSION",
    description: "Estimates the number of days beyond the baseline operational cycle (45 days) before clearing occurs.",
    businessDefinition:
      "Continuous magnitude of extended processing duration: max(0, duration_days - operational_threshold).",
    predictionPoint: "Invoice receipt / creation timestamp (t0).",
    predictionHorizonDays: 180,
    labelConstructionRule: "y = Math.max(0, process_duration_days - 45).",
    formula: "y = max(0, duration - PROJECT_DEFINED_OPERATIONAL_THRESHOLD)",
    compatibleSourceTypes: ["ERP_EVENT_LOG_DATA", "INVOICE_LIFECYCLE_DATA"],
    thresholdPolicyType: "PROJECT_DEFINED_OPERATIONAL_THRESHOLD",
    operationalThresholdDays: 45,
    inclusionCriteria: ["Completed purchase lifecycles."],
    exclusionCriteria: ["Open un-cleared items."],
    censoringTreatment: {
      handlesRightCensoring: true,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule: "Never zero-impute pending duration.",
      censoringWarning: "Evaluated on completed population.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 50,
      minimumDistinctBuyers: 2,
      minimumLongitudinalMonths: 3,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
    governanceLabel: "OPERATIONAL_CYCLE_SEVERITY",
  },

  // TARGET 4: PROCESS_EXCEPTION_RISK (Binary Process Block / Rework / Anomaly)
  PROCESS_EXCEPTION_RISK: {
    targetId: "PROCESS_EXCEPTION_RISK",
    name: "Process Exception & Payment Block Risk",
    version: "2.0",
    problemType: "BINARY_CLASSIFICATION",
    description: "Predicts probability that a purchase-to-pay workflow will encounter payment blocks, price rework, or approval holds.",
    businessDefinition:
      "A P2P item is marked as exception (1) if it experiences 'Set Payment Block', 'Change Price/Quantity', rework cycles, or manual intervention holds during processing.",
    predictionPoint: "Purchase order item creation / invoice entry (t0).",
    predictionHorizonDays: 90,
    labelConstructionRule: "y = (has_payment_block || has_rework || has_exception) ? 1 : 0.",
    formula: "y = I(payment_block == true || rework_events > 0 || abnormal_path == true)",
    compatibleSourceTypes: ["ERP_EVENT_LOG_DATA"],
    thresholdPolicyType: "PROJECT_DEFINED_OPERATIONAL_THRESHOLD",
    inclusionCriteria: [
      "ERP process cases with verified event logs.",
      "Both standard and service procurement lines.",
    ],
    exclusionCriteria: [
      "Cases with fewer than 2 logged activities.",
    ],
    censoringTreatment: {
      handlesRightCensoring: false,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule: "Cases must have progressed at least to goods receipt or invoice receipt.",
      censoringWarning: "Requires event log activity traceability.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 50,
      minimumDistinctBuyers: 2,
      minimumPositiveEvents: 5,
      minimumLongitudinalMonths: 3,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
    governanceLabel: "PROCESS_EXCEPTION_RISK",
  },

  // TARGET 5: FINANCIAL_STRESS_PROXY (Modelled Process Stress Proxy)
  FINANCIAL_STRESS_PROXY: {
    targetId: "FINANCIAL_STRESS_PROXY",
    name: "Modelled Process Stress Proxy (Vendor Exposure Stress)",
    version: "2.0",
    problemType: "BINARY_CLASSIFICATION",
    description: "Predicts heightened operational stress for a vendor based on prolonged processing duration and recurring payment blocks.",
    businessDefinition:
      "Modelled stress proxy derived strictly from observed transaction cycles. Explicitly labelled MODELLED_PROCESS_STRESS_PROXY, NOT actual SME balance-sheet insolvency.",
    predictionPoint: "Quarterly or monthly observation epoch.",
    predictionHorizonDays: 90,
    labelConstructionRule: "y = (vendor_avg_duration > 60 && vendor_exception_rate > 0.25) ? 1 : 0.",
    formula: "y = I(avg_duration > 60 days && exception_rate > 25%)",
    compatibleSourceTypes: ["ERP_EVENT_LOG_DATA", "INVOICE_LIFECYCLE_DATA"],
    thresholdPolicyType: "PROJECT_DEFINED_OPERATIONAL_THRESHOLD",
    operationalThresholdDays: 60,
    inclusionCriteria: [
      "Vendors with at least 3 transactions in observation window.",
    ],
    exclusionCriteria: [
      "Single-transaction one-off counterparties.",
    ],
    censoringTreatment: {
      handlesRightCensoring: false,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule: "Rolling metric over historical observations.",
      censoringWarning: "Modelled process proxy only. Not audited balance sheet solvency.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 30,
      minimumDistinctBuyers: 2,
      minimumPositiveEvents: 5,
      minimumLongitudinalMonths: 3,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
    governanceLabel: "MODELLED_PROCESS_STRESS_PROXY",
  },

  // EXISTING CONTRACTUAL TARGETS (Supported when source has contractual due date)
  PAYMENT_DELAY_RISK: {
    targetId: "PAYMENT_DELAY_RISK",
    name: "Invoice Payment Delay Risk (Contractual Due Date)",
    version: "1.0",
    problemType: "BINARY_CLASSIFICATION",
    description: "Predicts whether an issued commercial invoice will clear after its contracted due date.",
    businessDefinition:
      "A commercial invoice is classified as delayed (1) if actual clearing occurs > 0 calendar days after contractual due date. On-time or early payments are classified as (0).",
    predictionPoint: "Invoice issuance timestamp (t0).",
    predictionHorizonDays: 90,
    labelConstructionRule:
      "For settled invoices: label = (paymentDate > dueDate) ? 1 : 0. For open invoices where observationDate > dueDate: currently delayed (1), but duration is censored.",
    formula: "y = I(paymentDate > dueDate)",
    compatibleSourceTypes: ["INVOICE_LIFECYCLE_DATA"],
    thresholdPolicyType: "STATUTORY_DUE_DATE",
    inclusionCriteria: [
      "Invoices with verified invoiceDate and dueDate.",
      "Contractual credit period >= 1 day and <= 180 days.",
      "Settled invoices with confirmed paymentDate, OR open invoices past due date.",
    ],
    exclusionCriteria: [
      "Invoices canceled, voided, or refunded prior to due date.",
      "Open invoices within the grace/unexpired credit window (observationDate <= dueDate).",
      "Sources without verified contractual due dates (e.g. ERP event logs).",
    ],
    censoringTreatment: {
      handlesRightCensoring: true,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule:
        "FATAL: Never impute payment_delay = 0 or payment_date = due_date for open invoices. Naive zero-imputation introduces severe survival bias.",
      censoringWarning:
        "Open unexpired invoices must not be used in binary delay classification training without duration adjustment.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 1000,
      minimumDistinctBuyers: 50,
      minimumPositiveEvents: 100,
      minimumLongitudinalMonths: 12,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
    governanceLabel: "CONTRACTUAL_DUE_DATE_DELAY",
  },

  PAYMENT_DELAY_SEVERITY: {
    targetId: "PAYMENT_DELAY_SEVERITY",
    name: "Payment Delay Duration Severity (Contractual Days Past Due)",
    version: "1.0",
    problemType: "REGRESSION",
    description: "Estimates the number of calendar days by which invoice settlement will exceed contractual maturity.",
    businessDefinition:
      "Continuous magnitude of settlement delay in integer calendar days beyond contracted due date.",
    predictionPoint: "Invoice issuance timestamp (t0).",
    predictionHorizonDays: 180,
    labelConstructionRule: "delay_days = round((paymentDate - dueDate) / 86400000).",
    formula: "y = max(0, round((paymentDate - dueDate) / 86400000))",
    compatibleSourceTypes: ["INVOICE_LIFECYCLE_DATA"],
    thresholdPolicyType: "STATUTORY_DUE_DATE",
    inclusionCriteria: [
      "Settled commercial invoices with unambiguous paymentDate and dueDate.",
    ],
    exclusionCriteria: [
      "Open invoices without clearing date.",
      "Sources without verified contractual due dates.",
    ],
    censoringTreatment: {
      handlesRightCensoring: true,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule: "Never impute arbitrary maximum delay.",
      censoringWarning: "Evaluation strictly restricted to completed lifecycles.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 1000,
      minimumDistinctBuyers: 50,
      minimumLongitudinalMonths: 12,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
    governanceLabel: "CONTRACTUAL_DELAY_DAYS",
  },

  SEVERE_DELINQUENCY_RISK: {
    targetId: "SEVERE_DELINQUENCY_RISK",
    name: "Severe Delinquency / Default Risk (>90 Days Past Due)",
    version: "1.0",
    problemType: "BINARY_CLASSIFICATION",
    description: "Predicts whether an invoice will reach statutory delinquency (>= 90 days past due date).",
    businessDefinition:
      "Statutory default proxy under RBI IRAC guidelines and MSMED Act 2006 Section 15.",
    predictionPoint: "Invoice issuance timestamp (t0).",
    predictionHorizonDays: 180,
    labelConstructionRule: "y = I(daysPastDue >= 90 || defaultStatus == true).",
    formula: "y = I(daysPastDue >= 90 || defaultStatus == true)",
    compatibleSourceTypes: ["INVOICE_LIFECYCLE_DATA"],
    thresholdPolicyType: "STATUTORY_DUE_DATE",
    inclusionCriteria: ["Invoices with >= 90 days of observation follow-up."],
    exclusionCriteria: ["Recent invoices (< 90 days elapsed).", "Sources lacking contractual due dates."],
    censoringTreatment: {
      handlesRightCensoring: true,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule: "Do not classify young open invoices as non-defaults.",
      censoringWarning: "Severe class imbalance expected.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 50,
      minimumDistinctBuyers: 2,
      minimumPositiveEvents: 5,
      minimumLongitudinalMonths: 3,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
    governanceLabel: "STATUTORY_DELINQUENCY",
  },

  SME_FINANCIAL_STRESS: {
    targetId: "SME_FINANCIAL_STRESS",
    name: "SME Counterparty Financial Stress Index",
    version: "1.0",
    problemType: "BINARY_CLASSIFICATION",
    description: "Estimates whether an SME supplier is entering liquidity distress based on aggregate overdue exposure.",
    businessDefinition: "Overdue receivables exceeding 40% of billing volume.",
    predictionPoint: "Quarterly observation epoch.",
    predictionHorizonDays: 90,
    labelConstructionRule: "y = I(overdueExposure / trailingVolume > 0.40).",
    formula: "y = I(overdueExposure / trailingVolume > 0.40)",
    compatibleSourceTypes: ["INVOICE_LIFECYCLE_DATA"],
    thresholdPolicyType: "STATUTORY_DUE_DATE",
    inclusionCriteria: ["SME enterprises with >= 6 months history."],
    exclusionCriteria: ["New counterparties without track record."],
    censoringTreatment: {
      handlesRightCensoring: false,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule: "Baseline computed over at least 90 days.",
      censoringWarning: "Subject to seasonal cash cycles.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 30,
      minimumDistinctBuyers: 2,
      minimumPositiveEvents: 5,
      minimumLongitudinalMonths: 3,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
    governanceLabel: "SME_FINANCIAL_STRESS",
  },
};

/**
 * Checks whether a target is defensibly constructable and supported for the given data source type.
 */
export function checkTargetSourceCompatibility(
  targetId: string,
  sourceType: string
): { compatible: boolean; status: "READY" | "UNAVAILABLE_FOR_CURRENT_SOURCE"; reason?: string } {
  const target = TARGET_REGISTRY[targetId];
  if (!target) {
    return {
      compatible: false,
      status: "UNAVAILABLE_FOR_CURRENT_SOURCE",
      reason: `Target '${targetId}' is not registered in the target catalog.`,
    };
  }

  const isCompatible = target.compatibleSourceTypes.includes(sourceType);
  if (!isCompatible) {
    return {
      compatible: false,
      status: "UNAVAILABLE_FOR_CURRENT_SOURCE",
      reason: `Target '${target.name}' requires contractual due dates or specific schema not genuinely observed in source type '${sourceType}'. Mark as UNAVAILABLE_FOR_CURRENT_SOURCE to prevent fabricated delinquency.`,
    };
  }

  return {
    compatible: true,
    status: "READY",
  };
}
