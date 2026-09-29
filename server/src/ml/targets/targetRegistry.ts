/**
 * NEXUS-CFR Machine Learning Target Registry
 * Phase 4: Authorized Primary Data -> ML Readiness
 *
 * Defines formal mathematical and business prediction targets.
 * Enforces explicit observation windows, inclusion/exclusion criteria,
 * and strict censoring treatments. Naive zero-imputation is strictly prohibited.
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
}

export const TARGET_REGISTRY: Record<string, TargetDefinition> = {
  PAYMENT_DELAY_RISK: {
    targetId: "PAYMENT_DELAY_RISK",
    name: "Invoice Payment Delay Risk (Binary)",
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
    inclusionCriteria: [
      "Invoices with verified invoiceDate and dueDate.",
      "Contractual credit period >= 1 day and <= 180 days.",
      "Settled invoices with confirmed paymentDate, OR open invoices past due date.",
    ],
    exclusionCriteria: [
      "Invoices canceled, voided, or refunded prior to due date.",
      "Open invoices within the grace/unexpired credit window (observationDate <= dueDate).",
      "Invoices with severe formal commercial disputes under arbitration prior to issuance.",
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
  },

  PAYMENT_DELAY_SEVERITY: {
    targetId: "PAYMENT_DELAY_SEVERITY",
    name: "Payment Delay Duration Severity (Continuous Days)",
    version: "1.0",
    problemType: "REGRESSION",
    description: "Estimates the number of calendar days by which invoice settlement will exceed contractual maturity.",
    businessDefinition:
      "Continuous magnitude of settlement delay in integer calendar days. Negative numbers indicate early settlement discounts; zero indicates exact due date clearing.",
    predictionPoint: "Invoice issuance timestamp (t0).",
    predictionHorizonDays: 180,
    labelConstructionRule: "delay_days = round((paymentDate - dueDate) / 86400000).",
    formula: "y = max(0, round((paymentDate - dueDate) / 86400000))",
    inclusionCriteria: [
      "Settled commercial invoices with unambiguous paymentDate recorded in primary bank or ERP ledger.",
      "Vouchers with positive invoiceAmount and verified counterparty tax IDs.",
    ],
    exclusionCriteria: [
      "Open, unsettled invoices (unobserved clearing duration).",
      "Transactions with missing or invalid clearing timestamps.",
    ],
    censoringTreatment: {
      handlesRightCensoring: true,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule:
        "Never impute an arbitrary maximum delay (e.g. 999 days) or zero delay for open invoices in continuous regression.",
      censoringWarning:
        "Evaluation strictly restricted to completed lifecycles. Censoring-aware survival modeling required for open portfolios.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 1000,
      minimumDistinctBuyers: 50,
      minimumLongitudinalMonths: 12,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
  },

  SEVERE_DELINQUENCY_RISK: {
    targetId: "SEVERE_DELINQUENCY_RISK",
    name: "Severe Delinquency / Default Risk (>90 Days Past Due)",
    version: "1.0",
    problemType: "BINARY_CLASSIFICATION",
    description: "Predicts whether an invoice will reach statutory delinquency (>= 90 days past due date or MSMED statutory default).",
    businessDefinition:
      "Statutory default proxy under RBI Prudential Guidelines on Income Recognition and Asset Classification (IRAC) and MSMED Act 2006 Section 15.",
    predictionPoint: "Invoice issuance timestamp (t0).",
    predictionHorizonDays: 180,
    labelConstructionRule:
      "y = 1 if invoice remains unpaid >= 90 days past dueDate or resulted in an irrecoverable write-off; y = 0 if settled prior to 90 days past due.",
    formula: "y = I(daysPastDue >= 90 || defaultStatus == true)",
    inclusionCriteria: [
      "Invoices with at least 90 days of post-due-date observation follow-up.",
      "Corporate counterparties operating within formal credit terms.",
    ],
    exclusionCriteria: [
      "Recently issued invoices with less than 90 days elapsed since due date.",
      "Disputed invoices where payment is legally frozen by court order.",
    ],
    censoringTreatment: {
      handlesRightCensoring: true,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule:
        "Do not classify young open invoices as non-defaults. Only invoices with full follow-up window are eligible.",
      censoringWarning:
        "Severe class imbalance expected (delinquency typically < 5% in prime portfolios). Requires PR-AUC and cost-sensitive evaluation.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 2500,
      minimumDistinctBuyers: 100,
      minimumPositiveEvents: 50,
      minimumLongitudinalMonths: 24,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
  },

  SME_FINANCIAL_STRESS: {
    targetId: "SME_FINANCIAL_STRESS",
    name: "SME Counterparty Financial Stress Index",
    version: "1.0",
    problemType: "BINARY_CLASSIFICATION",
    description: "Estimates whether an SME supplier is entering liquidity distress based on aggregate overdue exposure and cash conversion degradation.",
    businessDefinition:
      "A supplier enterprise enters financial stress when its total overdue receivables exceed 40% of its trailing quarterly billing volume or average days sales outstanding (DSO) deteriorates by > 50%.",
    predictionPoint: "Quarterly or monthly observation epoch.",
    predictionHorizonDays: 90,
    labelConstructionRule:
      "y = 1 if (overdueExposure / trailingQuarterlyVolume > 0.40) || (dsoDeteriorationRatio > 1.50) in horizon window.",
    formula: "y = I(overdueExposure / trailingVolume > 0.40 || deltaDSO > 0.50)",
    inclusionCriteria: [
      "SME enterprises with at least 6 months of continuous active transaction history.",
      "At least 5 transactions across the observation window.",
    ],
    exclusionCriteria: [
      "New counterparties without historical baseline track record.",
    ],
    censoringTreatment: {
      handlesRightCensoring: false,
      strategy: "EXCLUDE_OPEN_INVOICES",
      naiveImputationRule: "Baseline DSO must be computed over at least 90 days of prior observations.",
      censoringWarning: "Firm-level distress indicators are rolling and subject to seasonal cash cycles.",
    },
    minimumDataRequirements: {
      minimumSampleObservations: 500,
      minimumDistinctBuyers: 30,
      minimumPositiveEvents: 40,
      minimumLongitudinalMonths: 18,
    },
    leakageReviewStatus: "VERIFIED_SAFE",
  },
};
