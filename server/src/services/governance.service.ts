import { prisma } from "../config/database";
import { ReferenceService } from "./reference.service";

export interface DatasetInventoryItem {
  id: string;
  name: string;
  sourceOrg: string;
  sourceUrl: string;
  sourceType: string;
  dataStatus: string;
  authenticityClassification: "SIMULATED_BENCHMARK" | "REAL_OBSERVED" | "ADMINISTRATIVE_AGGREGATE" | "DEMO_SCENARIO" | "SYNTHETIC" | "UNVERIFIED";
  version: string;
  license: string;
  granularity: string;
  observationsCount: number;
  entitiesRepresented: string;
  collectionPeriod: string;
  knownLimitations: string[];
}

export interface TargetVariableAudit {
  name: string;
  type: "REGRESSION" | "BINARY_CLASSIFICATION";
  formula: string;
  evaluationScope: string;
  availableObservations: number;
  rightCensoredObservations: number;
  rightCensoringRatePercent: number;
  positiveEventCount?: number;
  negativeEventCount?: number;
  handlingOfOpenInvoices: string;
  naiveImputationRisk: string;
}

export interface FeatureEligibilityItem {
  fieldName: string;
  predictionPointAvailability: "AVAILABLE_AT_T0" | "POST_ISSUANCE_ONLY";
  eligibilityStatus: "ELIGIBLE" | "FORBIDDEN_LEAKAGE" | "CONDITIONAL";
  leakageRiskLevel: "NONE" | "HIGH" | "FATAL";
  description: string;
}

export interface CandidateSourceAuditItem {
  id: string;
  name: string;
  candidateSource: string;
  publisher: string;
  authenticityClassification: "REAL_OBSERVED" | "SURVEY_MICRODATA" | "ADMINISTRATIVE_AGGREGATE" | "PUBLIC_DATASET" | "SIMULATED" | "SYNTHETIC" | "EXTERNAL_REFERENCE" | "UNVERIFIED";
  collectionPeriod: string;
  geography: string;
  granularity: string;
  recordCount: string;
  entityCount: string;
  availableVariables: string[];
  targetVariables: string[];
  license: string;
  accessConditions: string;
  collectionEvidence: string;
  limitations: string;
  integrationStatus: "INTEGRATED_SEPARATE_DOMAIN" | "REJECTED_AS_SIMULATED" | "ARCHITECTURAL_BENCHMARK" | "RESTRICTED_ACCESS";
}

export interface DomainSeparationItem {
  domain: "TRANSACTION_DATA" | "SURVEY_MICRODATA" | "ADMINISTRATIVE_AGGREGATE" | "EXTERNAL_REFERENCE";
  role: string;
  sourceDataset: string;
  authenticityClassification: string;
  joinRule: string;
  limitations: string;
}

export interface GovernanceAuditReport {
  tenant: {
    organizationId: string;
    organizationName: string;
    organizationCode: string;
  };
  auditTimestamp: string;
  mlGateStatus: "LOCKED" | "UNLOCKED";
  mlGateSummary: {
    status: "LOCKED" | "UNLOCKED";
    verdict: string;
    primaryBlocker: string;
    actionableRequirement: string;
  };
  fourDomainArchitecture: DomainSeparationItem[];
  candidateSourceAudits: CandidateSourceAuditItem[];
  datasetInventory: DatasetInventoryItem[];
  statisticalSufficiencyScorecard: {
    totalTransactions: number;
    distinctSMEs: number;
    distinctBuyers: number;
    distinctSuppliers: number;
    totalInvoiceVolumeINR: number;
    totalOutstandingINR: number;
    earliestInvoiceDate: string | null;
    latestInvoiceDate: string | null;
    temporalSpanDays: number;
    thresholds: {
      minimumSampleForTreeModels: number;
      currentSample: number;
      isSampleSufficient: boolean;
      minimumBuyersForGeneralization: number;
      currentBuyers: number;
      isBuyerDiversitySufficient: boolean;
      minimumLongitudinalMonths: number;
      currentSpanMonths: number;
      isLongitudinalSufficient: boolean;
    };
  };
  targetVariableAudits: TargetVariableAudit[];
  featureEligibilityMatrix: FeatureEligibilityItem[];
  temporalValidationProtocol: {
    recommendedMethodology: "OUT_OF_TIME_CHRONOLOGICAL_SPLIT";
    forbiddenMethodology: "RANDOM_K_FOLD_CROSS_VALIDATION";
    rationale: "Random cross-validation causes temporal leakage where future invoices of a buyer leak into historical predictions for the same entity.";
    splittingRules: [
      "Sort invoices strictly by invoiceDate in ascending order.",
      "Partition training window: T <= T_split (e.g. initial 70% of chronological timeline).",
      "Partition holdout testing window: T > T_split (subsequent 30% of chronological timeline).",
      "Evaluate out-of-time performance without shuffling."
    ];
  };
}

export class GovernanceService {
  static async getAuditReport(organizationId: string): Promise<GovernanceAuditReport> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const orgName = org?.name || organizationId;
    const orgCode = org?.code || "TENANT";

    // 1. Fetch batches
    const batches = await prisma.importBatch.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    // 2. Fetch transactions
    const txns = await prisma.transaction.findMany({
      where: { organizationId },
      orderBy: { invoiceDate: "asc" },
    });

    const totalTxns = txns.length;
    const uniqueSMEs = new Set(txns.map((t) => t.smeId));
    const uniqueBuyers = new Set(txns.map((t) => t.buyerId));
    const uniqueSuppliers = new Set(txns.map((t) => t.supplierId).filter(Boolean));

    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;
    let totalVolume = 0;
    let totalOutstanding = 0;

    let paidCount = 0;
    let openCount = 0;
    let delayedPaidCount = 0;
    let onTimePaidCount = 0;
    let delinquent90Plus = 0;

    const referenceNow = new Date("2026-08-13T00:00:00Z");

    for (const t of txns) {
      totalVolume += t.invoiceAmount;
      totalOutstanding += t.outstandingAmount;

      const invDate = new Date(t.invoiceDate);
      if (!earliestDate || invDate < earliestDate) earliestDate = invDate;
      if (!latestDate || invDate > latestDate) latestDate = invDate;

      if (t.paymentStatus === "PAID") {
        paidCount++;
        const delay = t.paymentDelayDays || 0;
        if (delay > 0) {
          delayedPaidCount++;
        } else {
          onTimePaidCount++;
        }
      } else {
        openCount++;
        const dueDate = new Date(t.dueDate);
        const daysPastDue = Math.round((referenceNow.getTime() - dueDate.getTime()) / 86400000);
        if (daysPastDue > 90) {
          delinquent90Plus++;
        }
      }
    }

    const temporalSpanDays =
      earliestDate && latestDate
        ? Math.max(1, Math.round((latestDate.getTime() - earliestDate.getTime()) / 86400000))
        : 0;
    const currentSpanMonths = Math.round((temporalSpanDays / 30.4) * 10) / 10;

    // Build Dataset Inventory
    const inventory: DatasetInventoryItem[] = [];

    // Add Ingested Batches
    for (const b of batches) {
      let authClass: DatasetInventoryItem["authenticityClassification"] = "SIMULATED_BENCHMARK";
      if (b.dataStatus === "VERIFIED" || b.sourceType === "PRIMARY_TRANSACTION") {
        authClass = "REAL_OBSERVED";
      } else if (b.dataStatus === "DEMO" || b.sourceType === "DEMO_ONLY") {
        authClass = "DEMO_SCENARIO";
      } else if (b.dataStatus === "SYNTHETIC") {
        authClass = "SYNTHETIC";
      } else if (b.dataStatus === "ADMINISTRATIVE_AGGREGATE") {
        authClass = "ADMINISTRATIVE_AGGREGATE";
      } else if (b.dataStatus === "UNVERIFIED") {
        authClass = "UNVERIFIED";
      } else {
        authClass = "SIMULATED_BENCHMARK";
      }

      inventory.push({
        id: b.id,
        name: b.sourceName,
        sourceOrg: b.sourceOrg || "Tenant Ingestion",
        sourceUrl: b.sourceUrl || "UNKNOWN / NOT_PUBLISHED",
        sourceType: b.sourceType,
        dataStatus: b.dataStatus,
        authenticityClassification: authClass,
        version: b.datasetVersion || "1.0",
        license: b.license || "Proprietary Organization Data",
        granularity: b.dataGranularity || "TRANSACTION_LEVEL",
        observationsCount: b.acceptedCount,
        entitiesRepresented: `${uniqueSMEs.size} Vendors / ${uniqueBuyers.size} Buyers`,
        collectionPeriod:
          earliestDate && latestDate
            ? `${earliestDate.toISOString().slice(0, 10)} to ${latestDate.toISOString().slice(0, 10)}`
            : "Unknown",
        knownLimitations:
          authClass === "SIMULATED_BENCHMARK"
            ? [
                "Calibrated simulation based on B2B credit distributions, not primary ERP accounting logs.",
                "Sample size constrained for testing pipeline and network flows.",
                "Pseudonymized counterparty identifiers without legal tax registration.",
              ]
            : [
                "Operational records scoped to organization boundaries.",
                "Informal renegotiations outside invoice ledger not observable.",
              ],
      });
    }

    // Add Macro Reference Benchmark
    const macro = ReferenceService.getSectorBenchmarks();
    inventory.push({
      id: "REF-MACRO-BENCHMARKS",
      name: macro.source.datasetName,
      sourceOrg: macro.source.publisher,
      sourceUrl: macro.source.url,
      sourceType: macro.source.classification,
      dataStatus: macro.source.granularity,
      authenticityClassification: "ADMINISTRATIVE_AGGREGATE",
      version: macro.source.version,
      license: macro.source.license,
      granularity: macro.source.granularity,
      observationsCount: macro.sectors.reduce((acc, s) => acc + s.sampleFirmCount, 0),
      entitiesRepresented: `7 Sectors, ~${macro.sectors.reduce((acc, s) => acc + s.sampleFirmCount, 0)} Surveyed MSME Entities`,
      collectionPeriod: macro.source.collectionPeriod,
      knownLimitations: [
        macro.source.knownLimitations,
        "Aggregate administrative statistics; strictly decoupled from individual invoice line items.",
        "Reflects formal dispute filings under Section 18 of the MSMED Act.",
      ],
    });

    // Target audits
    const rightCensoringRate = totalTxns > 0 ? Math.round((openCount / totalTxns) * 1000) / 10 : 0;

    const targets: TargetVariableAudit[] = [
      {
        name: "paymentDelayDays",
        type: "REGRESSION",
        formula: "max(0, round((paymentDate - dueDate) / 86400000))",
        evaluationScope: "Settled Invoices Only (paymentStatus === 'PAID')",
        availableObservations: paidCount,
        rightCensoredObservations: openCount,
        rightCensoringRatePercent: rightCensoringRate,
        handlingOfOpenInvoices:
          "Open invoices (PENDING / OVERDUE) represent right-censored observation intervals. Payment date has not yet occurred. Must be handled via survival analysis or duration models.",
        naiveImputationRisk:
          "FATAL: Imputing delay = 0 for open invoices erroneously treats delinquent invoices as on-time. Imputing an arbitrary upper bound creates synthetic target distortion.",
      },
      {
        name: "isDelayed",
        type: "BINARY_CLASSIFICATION",
        formula: "paymentDelayDays > 0",
        evaluationScope: "Settled Invoices Only",
        availableObservations: paidCount,
        rightCensoredObservations: openCount,
        rightCensoringRatePercent: rightCensoringRate,
        positiveEventCount: delayedPaidCount,
        negativeEventCount: onTimePaidCount,
        handlingOfOpenInvoices:
          "Open invoices past due date are currently experiencing delay, but final settlement duration remains unobserved.",
        naiveImputationRisk:
          "Evaluating binary delay on incomplete lifecycles distorts class balance.",
      },
      {
        name: "isDefault",
        type: "BINARY_CLASSIFICATION",
        formula: "paymentStatus !== 'PAID' && daysPastDue > 90",
        evaluationScope: "Full Observed Corpus with >= 90 Day Follow-up",
        availableObservations: totalTxns,
        rightCensoredObservations: totalTxns - delinquent90Plus,
        rightCensoringRatePercent:
          totalTxns > 0 ? Math.round(((totalTxns - delinquent90Plus) / totalTxns) * 1000) / 10 : 0,
        positiveEventCount: delinquent90Plus,
        negativeEventCount: totalTxns - delinquent90Plus,
        handlingOfOpenInvoices:
          "Invoices overdue by more than 90 days represent statutory delinquency under MSMED Act / RBI Prudential Norms.",
        naiveImputationRisk:
          "Severe class imbalance: Default events are extremely scarce in small samples (N < 500).",
      },
    ];

    // Feature eligibility matrix
    const features: FeatureEligibilityItem[] = [
      {
        fieldName: "invoiceAmount",
        predictionPointAvailability: "AVAILABLE_AT_T0",
        eligibilityStatus: "ELIGIBLE",
        leakageRiskLevel: "NONE",
        description: "Gross invoice billing value known at the moment of invoice issuance.",
      },
      {
        fieldName: "creditPeriodDays",
        predictionPointAvailability: "AVAILABLE_AT_T0",
        eligibilityStatus: "ELIGIBLE",
        leakageRiskLevel: "NONE",
        description: "Contractual payment term negotiated at transaction issuance.",
      },
      {
        fieldName: "invoiceDate",
        predictionPointAvailability: "AVAILABLE_AT_T0",
        eligibilityStatus: "ELIGIBLE",
        leakageRiskLevel: "NONE",
        description: "Transaction issuance timestamp; anchor point for temporal feature derivation.",
      },
      {
        fieldName: "dueDate",
        predictionPointAvailability: "AVAILABLE_AT_T0",
        eligibilityStatus: "ELIGIBLE",
        leakageRiskLevel: "NONE",
        description: "Contracted maturity date computed at issuance as invoiceDate + creditPeriodDays.",
      },
      {
        fieldName: "buyerHistoricalDelayAvg",
        predictionPointAvailability: "AVAILABLE_AT_T0",
        eligibilityStatus: "ELIGIBLE",
        leakageRiskLevel: "NONE",
        description: "Average delay of the buyer across prior settled invoices strictly BEFORE invoiceDate.",
      },
      {
        fieldName: "buyerCentralityScore",
        predictionPointAvailability: "AVAILABLE_AT_T0",
        eligibilityStatus: "ELIGIBLE",
        leakageRiskLevel: "NONE",
        description: "Network graph PageRank / betweenness centrality computed over prior historical graph topology.",
      },
      {
        fieldName: "paymentDate",
        predictionPointAvailability: "POST_ISSUANCE_ONLY",
        eligibilityStatus: "FORBIDDEN_LEAKAGE",
        leakageRiskLevel: "FATAL",
        description: "Timestamp of invoice clearing. Occurs strictly after issuance; fatal target leakage.",
      },
      {
        fieldName: "paymentDelayDays",
        predictionPointAvailability: "POST_ISSUANCE_ONLY",
        eligibilityStatus: "FORBIDDEN_LEAKAGE",
        leakageRiskLevel: "FATAL",
        description: "Derived target label; forbidden as predictive input feature.",
      },
      {
        fieldName: "paymentStatus",
        predictionPointAvailability: "POST_ISSUANCE_ONLY",
        eligibilityStatus: "FORBIDDEN_LEAKAGE",
        leakageRiskLevel: "FATAL",
        description: "Lifecycle status that evolves over time. Tautological leakage if used to predict delay.",
      },
      {
        fieldName: "outstandingAmount",
        predictionPointAvailability: "POST_ISSUANCE_ONLY",
        eligibilityStatus: "CONDITIONAL",
        leakageRiskLevel: "HIGH",
        description: "At t0 equals invoiceAmount. Post-issuance partial payment changes cannot be used in static models.",
      },
    ];

    const isSampleSufficient = totalTxns >= 500;
    const isBuyerDiversitySufficient = uniqueBuyers.size >= 50;
    const isLongitudinalSufficient = currentSpanMonths >= 12;

    const fourDomainArchitecture: DomainSeparationItem[] = [
      {
        domain: "TRANSACTION_DATA",
        role: "Pipeline validation, schema normalization, duplicate detection, and cash-flow network cascade simulation.",
        sourceDataset: "B2B Credit Benchmark Ledger (b2b_invoices_real.csv)",
        authenticityClassification: "SIMULATED_BENCHMARK",
        joinRule: "Primary transaction ledgers remain strictly within their tenant workspace. Cross-domain row-level joining with external aggregates without verified entity tax IDs is strictly prohibited.",
        limitations: "Current sample (N=50, 8 buyers) is a calibrated benchmark, underpowered for multi-buyer predictive ML generalizability.",
      },
      {
        domain: "SURVEY_MICRODATA",
        role: "Structural credit constraint parameters, working capital financing proportions, and subjective delay friction distributions.",
        sourceDataset: "World Bank Enterprise Survey (India Chapter 2014 & 2022)",
        authenticityClassification: "SURVEY_MICRODATA",
        joinRule: "Sectoral and macroeconomic feature conditioning only. Entity-level row joins are prohibited because survey protocols strictly enforce respondent anonymity.",
        limitations: "Cross-sectional self-reported survey responses; lacks continuous longitudinal invoice settlement tracking.",
      },
      {
        domain: "ADMINISTRATIVE_AGGREGATE",
        role: "Statutory delayed payment monitoring statistics, MSEFC dispute disposal rates, and large-enterprise payment practices reporting.",
        sourceDataset: "MSME Samadhaan (MoMSME, Govt of India) & UK DBT Payment Practices (SI 2017/395)",
        authenticityClassification: "ADMINISTRATIVE_AGGREGATE",
        joinRule: "Jurisdiction and sector-level conditioning only. Prohibited from being unpacked into synthetic transaction rows.",
        limitations: "Reflects formal legal disputes or mandatory large-enterprise averages; healthy private SME invoice clearing is unobserved in dispute filings.",
      },
      {
        domain: "EXTERNAL_REFERENCE",
        role: "Statutory ceilings (45-day MSMED Act credit limit), compound interest penalties (3x RBI rate), and sectoral baseline distributions.",
        sourceDataset: "msme_macro_benchmarks.json",
        authenticityClassification: "EXTERNAL_REFERENCE",
        joinRule: "Injected as global reference parameters and contextual baselines for counterparty comparison.",
        limitations: "Regulatory ceilings and institutional reference baselines, not observed firm-specific behavior.",
      },
    ];

    const candidateSourceAudits: CandidateSourceAuditItem[] = [
      {
        id: "CAND-01",
        name: "IBM Watson Analytics Accounts Receivable Sample",
        candidateSource: "WA_Fn-UseC_-Accounts-Receivable.csv (Kaggle / IBM Sample Hub)",
        publisher: "IBM Corporation (Watson Analytics)",
        authenticityClassification: "SYNTHETIC",
        collectionPeriod: "2012-2014 (Simulated)",
        geography: "Global / North America",
        granularity: "Invoice line item",
        recordCount: "2,467 invoices",
        entityCount: "~100 customer IDs",
        availableVariables: ["countryCode", "customerID", "PaperlessDate", "invoiceNumber", "InvoiceDate", "DueDate", "InvoiceAmount", "Disputed", "SettledDate", "DaysLate"],
        targetVariables: ["DaysLate", "SettledDate", "Disputed"],
        license: "Community Sample Data License (IBM)",
        accessConditions: "Public open access",
        collectionEvidence: "Officially documented by IBM as synthetic demonstration sample data engineered for Watson Analytics tutorials.",
        limitations: "Artificially generated sample; lacks real-world banking auditability and Indian SME regulatory context. Cannot be upgraded to REAL_OBSERVED.",
        integrationStatus: "REJECTED_AS_SIMULATED",
      },
      {
        id: "CAND-02",
        name: "HighRadius FinTech B2B Invoice Management Dataset",
        candidateSource: "HighRadius Internship & Hackathon Training Repository",
        publisher: "HighRadius Corporation (Educational Program)",
        authenticityClassification: "SIMULATED",
        collectionPeriod: "2019-2020 (Simulated)",
        geography: "US / Global Enterprise Simulation",
        granularity: "Invoice transaction",
        recordCount: "50,000 invoices",
        entityCount: "~1,000 simulated accounts",
        availableVariables: ["business_code", "cust_number", "clear_date", "buisness_year", "doc_id", "posting_date", "due_in_date", "total_open_amount"],
        targetVariables: ["clear_date", "delay"],
        license: "Educational Course Material",
        accessConditions: "Public student code repositories on GitHub",
        collectionEvidence: "Internship training assignment for students to build AI-enabled invoice management apps. Not production customer data from HighRadius O2C data lake.",
        limitations: "Simulated curriculum data; does not represent genuine commercial liabilities or Indian MSME credit lifecycles.",
        integrationStatus: "REJECTED_AS_SIMULATED",
      },
      {
        id: "CAND-03",
        name: "B2B Credit Benchmark Ledger",
        candidateSource: "b2b_invoices_real.csv (Internal Pipeline Testbed)",
        publisher: "NEXUS-CFR Benchmark Architecture",
        authenticityClassification: "SIMULATED",
        collectionPeriod: "2024-01-15 to 2024-08-28",
        geography: "India (Automotive, Engineering, Food & Beverage)",
        granularity: "Transaction-level invoice",
        recordCount: "50 invoices",
        entityCount: "8 buyers, 3 suppliers",
        availableVariables: ["transaction_id", "sme_id", "buyer_id", "invoice_amount", "invoice_date", "due_date", "payment_date", "payment_status", "outstanding_amount"],
        targetVariables: ["paymentDelayDays", "isDelayed", "isDefault"],
        license: "CC-BY-4.0",
        accessConditions: "Local workspace file",
        collectionEvidence: "Parametrically calibrated benchmark based on empirical credit terms (30/45/60/90 days) to validate ingestion and cash-flow propagation.",
        limitations: "Grade A data quality (100%), but N=50 is statistically undersized for generalizable ML model training.",
        integrationStatus: "ARCHITECTURAL_BENCHMARK",
      },
      {
        id: "CAND-04",
        name: "UK Department for Business and Trade — Payment Practices Reporting",
        candidateSource: "check-payment-practices.service.gov.uk",
        publisher: "UK Department for Business and Trade / Companies House",
        authenticityClassification: "ADMINISTRATIVE_AGGREGATE",
        collectionPeriod: "2017 - Present (Semi-annual statutory filings)",
        geography: "United Kingdom",
        granularity: "Corporate reporting period (semi-annual summary per enterprise)",
        recordCount: "80,000+ reports across 10,000+ enterprises",
        entityCount: "10,000+ registered corporations (e.g. Rolls-Royce, Unilever, Tesco)",
        availableVariables: ["CompanyNumber", "CompanyName", "AverageTimeToPay", "PercentagePaidWithin30Days", "PercentagePaid31To60Days", "PercentagePaidLate", "StandardPaymentTerms"],
        targetVariables: ["AverageTimeToPay", "PercentagePaidLate"],
        license: "Open Government Licence v3.0 (UK OGL)",
        accessConditions: "Public open download via government portal",
        collectionEvidence: "Mandatory statutory legal filings under The Reporting on Payment Practices and Performance Regulations 2017 (SI 2017/395).",
        limitations: "Company-level aggregate reporting; contains no individual transaction line items. Cannot be row-joined to Indian SME ledgers.",
        integrationStatus: "INTEGRATED_SEPARATE_DOMAIN",
      },
      {
        id: "CAND-05",
        name: "Ministry of MSME — MSME Samadhaan Dispute System",
        candidateSource: "samadhaan.msme.gov.in",
        publisher: "Ministry of Micro, Small and Medium Enterprises, Government of India",
        authenticityClassification: "ADMINISTRATIVE_AGGREGATE",
        collectionPeriod: "2017 - Present (Continuous monitoring)",
        geography: "India (All States & UTs)",
        granularity: "State, sector, and buyer-category aggregate statistics",
        recordCount: "180,000+ formal dispute filings",
        entityCount: "Thousands of registered MSEs and defaulting commercial buyers",
        availableVariables: ["Sector", "StatutoryCeilingDays (45)", "MedianPaymentDelayDays", "DelayedTransactionProportion", "FormalDisputeRecoveryRate"],
        targetVariables: ["DelinquencyRate", "RecoveryRate"],
        license: "Government Open Data License - India (GODL)",
        accessConditions: "Public portal summary dashboard",
        collectionEvidence: "Statutory delayed payment monitoring under Section 18 of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006.",
        limitations: "Captures formal legal dispute filings; healthy non-disputed invoice transactions are unobserved.",
        integrationStatus: "INTEGRATED_SEPARATE_DOMAIN",
      },
      {
        id: "CAND-06",
        name: "World Bank Enterprise Survey (WBES) India Chapter",
        candidateSource: "enterprisesurveys.org (World Bank Microdata Library)",
        publisher: "World Bank Group (Enterprise Analysis Unit)",
        authenticityClassification: "SURVEY_MICRODATA",
        collectionPeriod: "2014 & 2022 survey rounds",
        geography: "India (Formal private enterprise cross-section)",
        granularity: "Firm-level survey response microdata",
        recordCount: "9,000+ enterprise interviews in India",
        entityCount: "9,000+ anonymous enterprises",
        availableVariables: ["k3f (Working capital on supplier credit)", "proportion of sales on credit", "days of delay from customers", "access to finance obstacle"],
        targetVariables: ["Credit constraint severity", "delay impact"],
        license: "World Bank Data Access Protocol (Confidential Academic/Research Use)",
        accessConditions: "Restricted access; requires institutional registration and signed confidentiality agreement",
        collectionEvidence: "Multi-stage stratified random sampling conducted by formal field enumerators.",
        limitations: "Survey respondent confidentiality strictly prohibits linking survey responses to specific commercial invoice counterparties.",
        integrationStatus: "RESTRICTED_ACCESS",
      },
      {
        id: "CAND-07",
        name: "Primary Enterprise Accounts Receivable (TReDS / ERP Ledgers)",
        candidateSource: "TReDS Exchanges (RXIL, M1xchange, Invoicemart) & Accounting ERPs (Tally, SAP, Zoho Books)",
        publisher: "Commercial Banks, TReDS Operating Units, Private Enterprises",
        authenticityClassification: "REAL_OBSERVED",
        collectionPeriod: "Live operational transaction streams",
        geography: "India / Global",
        granularity: "Line-item invoice lifecycle with real bank settlement timestamps",
        recordCount: "Scalable (N > 100,000)",
        entityCount: "Verified GSTIN/PAN registered counterparties",
        availableVariables: ["invoiceNumber", "gstin_supplier", "gstin_buyer", "amount", "invoiceDate", "dueDate", "paymentDate", "settlementStatus"],
        targetVariables: ["paymentDelayDays", "isDefault"],
        license: "Commercial Enterprise Agreement / Banking API License",
        accessConditions: "NON-EXISTENT IN OPEN PUBLIC DOMAIN. Protected by banking secrecy laws, commercial NDAs, and India DPDP Act 2023.",
        collectionEvidence: "Primary banking and accounting ledgers.",
        limitations: "Cannot be legitimately obtained from public websites or open repos; requires direct authenticated tenant ERP ingestion in Phase 4.",
        integrationStatus: "ARCHITECTURAL_BENCHMARK",
      },
    ];

    return {
      tenant: {
        organizationId,
        organizationName: orgName,
        organizationCode: orgCode,
      },
      auditTimestamp: new Date().toISOString(),
      mlGateStatus: "LOCKED",
      mlGateSummary: {
        status: "LOCKED",
        verdict: "ML BLOCKED — VERIFIED REAL DATA INSUFFICIENT; PRIMARY DATA NOT YET CONNECTED; STATISTICALLY CONSTRAINED FOR PRODUCTION TRAINING",
        primaryBlocker: `Current sample (${totalTxns} transactions across ${uniqueBuyers.size} buyers) is statistically underpowered for generalizable model training (below minimum thresholds). Furthermore, rigorous research confirms that in the open public domain, real-world corporate accounts receivable ledgers are strictly confidential proprietary assets (protected by banking secrecy, commercial NDAs, and data privacy law). The enterprise ingestion architecture is production-ready, but no authorized enterprise ERP/TReDS primary connector has yet been connected to supply live customer ledgers. Public web datasets remain simulated or synthetic.`,
        actionableRequirement:
          "To unlock Phase 4 ML responsibly, acquire genuine primary transaction microdata via authenticated enterprise ERP ingestion (e.g., Tally, SAP, QuickBooks) or regulatory TReDS platform sandbox feeds (N >= 1,000 across >= 50 buyers over >= 12-24 months). Connect an authorized enterprise data source. Do NOT train models on simulated or unverified data.",
      },
      fourDomainArchitecture,
      candidateSourceAudits,
      datasetInventory: inventory,
      statisticalSufficiencyScorecard: {
        totalTransactions: totalTxns,
        distinctSMEs: uniqueSMEs.size,
        distinctBuyers: uniqueBuyers.size,
        distinctSuppliers: uniqueSuppliers.size,
        totalInvoiceVolumeINR: Math.round(totalVolume),
        totalOutstandingINR: Math.round(totalOutstanding),
        earliestInvoiceDate: earliestDate ? earliestDate.toISOString().slice(0, 10) : null,
        latestInvoiceDate: latestDate ? latestDate.toISOString().slice(0, 10) : null,
        temporalSpanDays,
        thresholds: {
          minimumSampleForTreeModels: 500,
          currentSample: totalTxns,
          isSampleSufficient,
          minimumBuyersForGeneralization: 50,
          currentBuyers: uniqueBuyers.size,
          isBuyerDiversitySufficient,
          minimumLongitudinalMonths: 12,
          currentSpanMonths,
          isLongitudinalSufficient,
        },
      },
      targetVariableAudits: targets,
      featureEligibilityMatrix: features,
      temporalValidationProtocol: {
        recommendedMethodology: "OUT_OF_TIME_CHRONOLOGICAL_SPLIT",
        forbiddenMethodology: "RANDOM_K_FOLD_CROSS_VALIDATION",
        rationale:
          "Random cross-validation causes temporal leakage where future invoices of a buyer leak into historical predictions for the same entity.",
        splittingRules: [
          "Sort invoices strictly by invoiceDate in ascending order.",
          "Partition training window: T <= T_split (e.g. initial 70% of chronological timeline).",
          "Partition holdout testing window: T > T_split (subsequent 30% of chronological timeline).",
          "Evaluate out-of-time performance without shuffling.",
        ],
      },
    };
  }
}
