/**
 * NEXUS-CFR Dataset-Specific Model Registry
 * Phase 11: Real Multi-Dataset Intelligence
 *
 * Implements formal registry mapping:
 * DATASET -> TARGET -> FEATURES -> MODEL -> VALIDATION -> METRICS -> STATUS -> PRODUCTION BOUNDARY
 *
 * Enforces strict semantic integrity:
 * - Fulton: Transaction-level Payment Cycle Duration & Risk
 * - BPI: Process Mining Clearing Duration & Exception
 * - UK DBT: Corporate-level Payment Practice Analytics
 * - Mendeley: Simulated Accounts Receivable Benchmark
 */

export interface DatasetRegistryEntry {
  datasetId: string;
  datasetName: string;
  provenanceStatus: "VERIFIED_REAL" | "VERIFIED_REAL_STREAMING" | "BENCHMARK_FIXTURE_SIMULATED" | "AGGREGATE_REFERENCE" | "DEMO_FIXTURE";
  semanticNature: string;
  supportedTargets: Array<{
    targetId: string;
    targetName: string;
    targetType: "CONTINUOUS_REGRESSION" | "BINARY_CLASSIFICATION" | "STATISTICAL_BENCHMARK";
    formula: string;
    operationalThreshold?: string;
  }>;
  activeFeatures: string[];
  candidateModels: Array<{
    modelArchitecture: string;
    targetId: string;
    validationStrategy: string;
    keyMetricsReported: string[];
    lifecycleStatus: "VALIDATED" | "EXPERIMENTAL" | "REFERENCE_BENCHMARK" | "DEMO_ONLY";
    productionBoundary: string;
  }>;
  strictNegativeConstraints: string[];
}

export class DatasetModelRegistry {
  private static readonly REGISTRY: Record<string, DatasetRegistryEntry> = {
    FULTON_COUNTY: {
      datasetId: "FULTON_COUNTY",
      datasetName: "Fulton County Georgia Vendor Payments",
      provenanceStatus: "VERIFIED_REAL",
      semanticNature: "Observed Municipal Transaction Payments (10,000 authentic records)",
      supportedTargets: [
        {
          targetId: "PAYMENT_CYCLE_DURATION",
          targetName: "Invoice to Physical Check/ACH Disbursement Duration",
          targetType: "CONTINUOUS_REGRESSION",
          formula: "disbursement_date - invoice_date (days)"
        },
        {
          targetId: "PAYMENT_CYCLE_RISK",
          targetName: "Extended Payment Latency Risk",
          targetType: "BINARY_CLASSIFICATION",
          formula: "payment_cycle_duration > 14 days",
          operationalThreshold: "14 calendar days"
        }
      ],
      activeFeatures: [
        "invoiceAmount",
        "vendorHistoricalVolumePreT0",
        "vendorHistoricalMeanCyclePreT0",
        "departmentConcentrationPreT0",
        "invoiceMonthOfYear",
        "invoiceDayOfWeek",
        "isCheckDisbursement"
      ],
      candidateModels: [
        {
          modelArchitecture: "Ridge Regression (L2 Regularized)",
          targetId: "PAYMENT_CYCLE_DURATION",
          validationStrategy: "Chronological Out-of-Time Test (70/15/15)",
          keyMetricsReported: ["MAE", "RMSE", "R2", "Median Absolute Error"],
          lifecycleStatus: "VALIDATED",
          productionBoundary: "Validated on Fulton County municipal procurement data. Prohibited from unadjusted cross-border SME lending."
        },
        {
          modelArchitecture: "Regularized Logistic Regression (L2)",
          targetId: "PAYMENT_CYCLE_RISK",
          validationStrategy: "Chronological Out-of-Time Test (70/15/15)",
          keyMetricsReported: ["ROC-AUC", "PR-AUC", "F1", "Precision", "Recall", "Brier Score", "ECE"],
          lifecycleStatus: "VALIDATED",
          productionBoundary: "Validated on US municipal procurement. Strictly not valid for Indian MSME direct credit underwriting."
        }
      ],
      strictNegativeConstraints: [
        "Do not predict post-issuance disbursement mechanisms.",
        "Do not use disbursement date in pre-t0 feature extraction.",
        "Do not claim suitability for Indian SME lending."
      ]
    },

    BPI_CHALLENGE_2019: {
      datasetId: "BPI_CHALLENGE_2019",
      datasetName: "BPI Challenge 2019 Purchase-to-Pay Event Log",
      provenanceStatus: "VERIFIED_REAL_STREAMING",
      semanticNature: "Observed European Enterprise SAP ERP Process Event Stream (~299.5MB acquired)",
      supportedTargets: [
        {
          targetId: "PROCESS_PAYMENT_CYCLE_DURATION",
          targetName: "Invoice Receipt to ERP Clearing Duration",
          targetType: "CONTINUOUS_REGRESSION",
          formula: "clearing_event_timestamp - invoice_receipt_timestamp (days)"
        },
        {
          targetId: "PROCESS_CLEARING_RISK",
          targetName: "ERP Process Clearing Delay Risk",
          targetType: "BINARY_CLASSIFICATION",
          formula: "process_clearing_duration > 45 days",
          operationalThreshold: "45 calendar days"
        }
      ],
      activeFeatures: [
        "priorEventsCount",
        "hasGoodsReceiptPreInvoice",
        "hasPreInvoiceBlock",
        "hasPreInvoiceRework",
        "poToReceiptLatencyDays",
        "logMonetaryValue",
        "vendorHistoricalCasesPreT0",
        "vendorHistoricalCycleMeanPreT0",
        "receiptMonthOfYear",
        "receiptDayOfWeek"
      ],
      candidateModels: [
        {
          modelArchitecture: "Ridge Regression (L2 Regularized)",
          targetId: "PROCESS_PAYMENT_CYCLE_DURATION",
          validationStrategy: "Chronological Out-of-Time Test (70/15/15)",
          keyMetricsReported: ["MAE", "RMSE", "R2", "Median Absolute Error"],
          lifecycleStatus: "VALIDATED",
          productionBoundary: "Validated exclusively on enterprise SAP ERP Purchase-to-Pay clearing workflows."
        },
        {
          modelArchitecture: "Regularized Logistic Regression (L2)",
          targetId: "PROCESS_CLEARING_RISK",
          validationStrategy: "Chronological Out-of-Time Test (70/15/15)",
          keyMetricsReported: ["ROC-AUC", "PR-AUC", "F1", "Precision", "Recall", "Brier Score", "ECE"],
          lifecycleStatus: "VALIDATED",
          productionBoundary: "Validated for ERP process bottlenecks. Does not predict bank credit insolvency."
        }
      ],
      strictNegativeConstraints: [
        "Do not load full 666k+ events into browser client memory.",
        "Do not use Clear Invoice timestamp in pre-t0 features.",
        "Do not claim complete 728MB archive when partial 299.5MB stream was acquired.",
        "Do not conflate internal ERP approval latency with supplier default risk."
      ]
    },

    UK_DBT: {
      datasetId: "UK_DBT",
      datasetName: "UK Department for Business & Trade Payment Practices",
      provenanceStatus: "VERIFIED_REAL",
      semanticNature: "Empirical Corporate-Level Statutory Payment Filings (348,806 records, 11,900 companies)",
      supportedTargets: [
        {
          targetId: "PAYMENT_PRACTICE_BENCHMARK",
          targetName: "Average Corporate Payment Days Benchmark",
          targetType: "STATISTICAL_BENCHMARK",
          formula: "statutory_average_time_to_pay"
        },
        {
          targetId: "LATE_PAYMENT_BEHAVIOR",
          targetName: "Percent Invoices Paid Beyond Agreed Terms",
          targetType: "STATISTICAL_BENCHMARK",
          formula: "statutory_percent_not_paid_within_agreed_terms"
        },
        {
          targetId: "SUPPLY_CHAIN_FINANCE_ADOPTION",
          targetName: "Corporate Supply Chain Financing Facility Availability",
          targetType: "STATISTICAL_BENCHMARK",
          formula: "statutory_supply_chain_financing_offered"
        }
      ],
      activeFeatures: [
        "companySector",
        "filingHistoryCount",
        "reportedAverageDaysToPay",
        "reportedLatePercent",
        "offersSupplyChainFinancing",
        "offersEInvoicing"
      ],
      candidateModels: [
        {
          modelArchitecture: "Corporate Payment Practice Risk Profiler (Sector & Entity)",
          targetId: "PAYMENT_PRACTICE_BENCHMARK",
          validationStrategy: "Empirical Cross-Sector Distributional Benchmarking",
          keyMetricsReported: ["Median Payment Days", "Late Payment Share", "SCF Adoption %", "Risk Distribution"],
          lifecycleStatus: "REFERENCE_BENCHMARK",
          productionBoundary: "Used for corporate counterparty profiling. Explicitly NOT an invoice-level predictive ML model."
        }
      ],
      strictNegativeConstraints: [
        "Do NOT convert aggregate/company-level fields into fake invoice-level transaction rows.",
        "Do NOT claim learned invoice prediction on UK DBT reporting."
      ]
    },

    MENDELEY_RECEIVABLES: {
      datasetId: "MENDELEY_RECEIVABLES",
      datasetName: "Mendeley Accounts Receivable Payment Delay Dataset",
      provenanceStatus: "BENCHMARK_FIXTURE_SIMULATED",
      semanticNature: "Simulated Accounts Receivable Benchmark Fixture (1,000 synthetic rows)",
      supportedTargets: [
        {
          targetId: "SIMULATED_RECEIVABLE_RISK",
          targetName: "Simulated Payment Delay Risk",
          targetType: "BINARY_CLASSIFICATION",
          formula: "simulated_delay_days > 0"
        }
      ],
      activeFeatures: ["invoiceAmount", "creditPeriodDays", "buyerHistoricalDelayMean30d"],
      candidateModels: [
        {
          modelArchitecture: "Logistic Regression Baseline",
          targetId: "SIMULATED_RECEIVABLE_RISK",
          validationStrategy: "Cross-Validation on Fixture",
          keyMetricsReported: ["ROC-AUC", "F1", "Precision", "Recall"],
          lifecycleStatus: "DEMO_ONLY",
          productionBoundary: "Confined strictly to local software testing and pipeline verification. NEVER deployable to production."
        }
      ],
      strictNegativeConstraints: [
        "Never reclassify as verified real empirical data.",
        "Never serve production risk scores to paying financial institutions."
      ]
    }
  };

  public static getRegistry(): Record<string, DatasetRegistryEntry> {
    return this.REGISTRY;
  }

  public static getEntry(datasetId: string): DatasetRegistryEntry | null {
    return this.REGISTRY[datasetId] || null;
  }

  public static getSupportedTargetsForDataset(datasetId: string) {
    const entry = this.getEntry(datasetId);
    return entry ? entry.supportedTargets : [];
  }
}
