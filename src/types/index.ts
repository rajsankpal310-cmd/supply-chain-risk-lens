// Centralized domain types for NEXUS-CFR.
// These mirror the future backend contracts (see src/api/contracts.ts).

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PaymentStatus = "PAID" | "PENDING" | "DELAYED" | "CRITICAL";
export type UserRole = "SME_ADMIN" | "ANALYST" | "VIEWER";
export type FirmRole = "SME" | "BUYER" | "SUPPLIER" | "BUYER_SUPPLIER";

export interface User {
  id: string;
  fullName: string;
  email: string;
  companyName: string;
  industry: string;
  companySize: string;
  role: UserRole;
  avatarInitials: string;
  organizationId?: string;
  organizationName?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  fullName: string;
  companyName: string;
  email: string;
  password: string;
  industry: string;
  companySize: string;
}

export interface Firm {
  id: string;
  name: string;
  industry: string;
  role: FirmRole;
  city: string;
  transactionCount: number;
  buyersCount: number;
  suppliersCount: number;
  avgPaymentDelayDays: number;
  outstandingAmount: number;
  annualTurnover: number;
  cashBufferDays: number;
  riskScore: number;
  riskLevel: RiskLevel;
  financialStress: number;
  isDemo: true;
}

export type DataSourceType =
  | "PRIMARY_TRANSACTION"
  | "PUBLIC_DATASET"
  | "EXTERNAL_REFERENCE"
  | "DERIVED"
  | "DEMO_ONLY"
  | "SIMULATED"
  | "SYNTHETIC"
  | "SURVEY"
  | "ADMINISTRATIVE";

export type DataStatus =
  | "REAL_OBSERVED"
  | "PUBLIC_DATASET"
  | "EXTERNAL_REFERENCE"
  | "ADMINISTRATIVE_AGGREGATE"
  | "SURVEY_MICRODATA"
  | "SIMULATED"
  | "PUBLIC_SIMULATED_DATA"
  | "SYNTHETIC"
  | "DEMO"
  | "VALIDATED"
  | "ACTIVE"
  | "ARCHIVED"
  | "SAMPLE"
  | "UNVERIFIED";

export interface Transaction {
  id: string;
  smeId: string;
  buyerId: string;
  supplierId?: string | undefined;
  invoiceAmount: number;
  invoiceDate: string;
  dueDate: string;
  paymentDate?: string | undefined;
  paymentDelayDays?: number | undefined;
  creditPeriodDays?: number | undefined;
  outstandingAmount: number;
  paymentStatus: PaymentStatus;
  riskLevel: RiskLevel;
  sourceType?: DataSourceType;
  sourceName?: string;
  sourceUrl?: string;
  dataStatus?: DataStatus;
  batchId?: string;
}

export interface Relationship {
  id: string;
  sourceFirmId: string;
  targetFirmId: string;
  type: "SUPPLIES_TO" | "BUYS_FROM" | "SUBCONTRACTS";
  avgTransactionValue: number;
  creditPeriodDays: number;
  dependencyLevel: number; // 0-100
  criticality: RiskLevel;
}

export interface RiskFactor {
  label: string;
  description: string;
  weight: number; // 0-100 contribution
  direction: "INCREASES" | "DECREASES";
}

export interface RiskScore {
  firmId?: string | undefined;
  isEmpty?: boolean;
  overall: number;
  level: RiskLevel;
  categories: { key: string; label: string; description: string; score: number }[];
  drivers: RiskFactor[];
  trend: { date: string; score: number }[];
}

export interface Prediction {
  id: string;
  firmId: string;
  firmName: string;
  type: "PAYMENT_DELAY" | "FINANCIAL_STRESS";
  probability: number; // 0-100
  expectedDelayDays?: number | undefined;
  riskLevel: RiskLevel;
  predictedDate?: string | undefined;
  confidence: number; // 0-100
  factors: RiskFactor[];
  horizon: { days: 7 | 30 | 60 | 90; risk: number }[];
  isModelPrediction?: boolean;
  inferenceType?: "APPROVED_ML_MODEL" | "NON_ML_FALLBACK" | string;
  governanceNotice?: string;
  disclaimer?: string;
}

export type ScenarioType =
  | "BUYER_PAYMENT_DELAY"
  | "SUPPLIER_FAILURE"
  | "MAJOR_BUYER_LOSS"
  | "CASH_FLOW_SHOCK"
  | "NATURAL_DISASTER"
  | "CUSTOM";

export interface Scenario {
  id: string;
  name: string;
  type: ScenarioType;
  affectedFirmId: string;
  delayDays: number;
  amount: number;
  severity: RiskLevel;
  durationDays: number;
  recoveryRate: number; // 0-100
  createdAt: string;
}

export type ScenarioInput = Omit<Scenario, "id" | "createdAt">;

export interface SimulationResult {
  affectedFirms: { firmId: string; firmName: string; riskBefore: number; riskAfter: number; loss: number; step: number }[];
  potentialDefaults: number;
  cascadeProbability: number;
  expectedLoss: number;
  maximumImpact: number;
  recoveryDays: number;
  propagationPath: string[];
  timeline: { day: number; stressedFirms: number; loss: number }[];
  distribution: { bucket: string; probability: number }[];
  recommendationIds: string[];
}

export interface SimulationRun {
  id: string;
  scenario: Scenario;
  startedAt: string;
  status: "COMPLETED" | "RUNNING" | "FAILED";
  result: SimulationResult;
}

export interface Deadlock {
  id: string;
  rootFirmId: string;
  rootFirmName: string;
  severity: RiskLevel;
  deadlockRisk: number;
  chain: { firmId: string; firmName: string; owesAmount: number; stress: number }[];
  totalExposure: number;
  estimatedImpact: number;
  detectedAt: string;
  resolved: boolean;
}

export type RecommendationKind =
  | "INVOICE_FINANCING"
  | "TREDS"
  | "CREDIT_LINE"
  | "PAYMENT_RESCHEDULING"
  | "ALTERNATE_SUPPLIER"
  | "ALTERNATE_BUYER"
  | "CASH_BUFFER"
  | "DEPENDENCY_REDUCTION";

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  firmId: string;
  firmName: string;
  riskAddressed: string;
  reason: string;
  expectedImpact: string;
  estimatedRequirement: number;
  priority: RiskLevel;
  confidence: number;
  status: "OPEN" | "ACCEPTED" | "DISMISSED";
}

export interface OptimizationAllocation {
  firmId: string;
  firmName: string;
  risk: number;
  requiredSupport: number;
  allocated: number;
  impactReduction: number;
  priority: RiskLevel;
}

export interface OptimizationRun {
  id: string;
  budget: number;
  allocations: OptimizationAllocation[];
  cascadeRiskBefore: number;
  cascadeRiskAfter: number;
  expectedLossBefore: number;
  expectedLossAfter: number;
  createdAt: string;
}

export type AlertCategory =
  | "PAYMENT_DELAY"
  | "FINANCIAL_STRESS"
  | "SUPPLY_CHAIN"
  | "CASCADE_RISK"
  | "DEADLOCK"
  | "CRITICAL_RISK";

export interface Alert {
  id: string;
  category: AlertCategory;
  severity: RiskLevel;
  firmId: string;
  firmName: string;
  date: string;
  title: string;
  reason: string;
  impact: string;
  recommendedAction: string;
  read: boolean;
  archived: boolean;
}

export interface Report {
  id: string;
  key: string;
  name: string;
  description: string;
  lastGeneratedAt?: string | undefined;
  status: "READY" | "NOT_GENERATED" | "GENERATING";
}

export interface DashboardSummary {
  userRole?: UserRole;
  kpis: {
    key: string;
    label: string;
    value: string;
    rawValue: number;
    unit?: string | undefined;
    trend: number;
    trendLabel: string;
    status: RiskLevel;
    tooltip: string;
  }[];
  paymentDelayTrend: { date: string; delay: number }[];
  outstandingTrend: { date: string; amount: number }[];
  riskDistribution: { level: RiskLevel; count: number }[];
  stressTrend: { date: string; stress: number }[];
  topRiskyBuyers: TopFirmRow[];
  topRiskySuppliers: TopFirmRow[];
  dataProvenanceSummary?: {
    totalBatches: number;
    lastBatch: {
      id: string;
      sourceType: string;
      sourceName: string;
      importedAt: string;
      recordCount: number;
      dataStatus: string;
    } | null;
  };
  overdueTransactions?: {
    id: string;
    buyerId: string;
    buyerName: string;
    smeId: string;
    smeName: string;
    invoiceAmount: number;
    outstandingAmount: number;
    dueDate: string;
    delayDays: number;
    status: PaymentStatus;
    riskLevel: RiskLevel;
  }[];
  analyticalSummary?: {
    activeDeadlocksCount: number;
    totalLockedExposure: number;
    simulationsCount: number;
    latestSimulation: {
      id: string;
      scenarioName: string;
      cascadeRisk: number;
      expectedLoss: number;
      status: string;
      startedAt: string;
    } | null;
  };
  executiveSummary?: {
    portfolioHealthStatus: "RESILIENT" | "MODERATE_RISK" | "CRITICAL_ATTENTION";
    criticalFirmsCount: number;
    atRiskFirmsCount: number;
    reportsCount: number;
    totalFirmsCount: number;
    resilienceIndex: number;
  };
  mlIntelligence?: any;
}

export interface TopFirmRow {
  firmId: string;
  name: string;
  transactions: number;
  avgDelay: number;
  outstanding: number;
  riskLevel: RiskLevel;
  riskScore: number;
}

export interface NetworkNode {
  id: string;
  name: string;
  industry: string;
  role: FirmRole;
  volume: number;
  riskScore: number;
  riskLevel: RiskLevel;
  exposure: number;
  impact: number;
  x: number;
  y: number;
  avgPaymentDelayDays?: number;
  outstandingAmount?: number;
  activeRelationshipsCount?: number;
  activeTransactionsCount?: number;
  completedTransactionsCount?: number;
  activeAlertsCount?: number;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  exposure: number;
  dependency: number;
  criticality: RiskLevel;
  activeExposure?: number;
  activeTransactionCount?: number;
  completedTransactionCount?: number;
  hasActiveTransactions?: boolean;
  status?: "ACTIVE" | "COMPLETED";
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionQuery {
  search?: string | undefined;
  status?: PaymentStatus | "ALL" | undefined;
  risk?: RiskLevel | "ALL" | undefined;
  buyerId?: string | "ALL" | undefined;
  supplierId?: string | "ALL" | undefined;
  from?: string | undefined;
  to?: string | undefined;
  sortBy?: keyof Transaction | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface ImportRow {
  raw: Record<string, string>;
  errors: string[];
  valid: boolean;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  invalidDates: number;
  invalidAmounts: number;
  missingFields: number;
  rows: ImportRow[];
}

export interface QualityScorecard {
  totalRecords: number;
  acceptedCount: number;
  rejectedCount: number;
  exactDuplicateCount: number;
  potentialDuplicateCount: number;
  completenessRate: number;
  validityRate: number;
  duplicateRate: number;
  consistencyRate: number;
  overallQualityScore: number;
  qualityGrade: "A" | "B" | "C" | "D";
  fieldMissingness: Record<string, number>;
  rejectionReasons: {
    row: number;
    field: string;
    rule: string;
    problem: string;
    expectedFormat: string;
    example: string;
  }[];
  summaryMessage: string;
}

export interface ImportBatchRecord {
  id: string;
  organizationId: string;
  sourceType: DataSourceType;
  sourceName: string;
  sourceOrg?: string | null;
  sourceUrl?: string | null;
  sourceDate?: string | null;
  datasetVersion?: string | null;
  license?: string | null;
  dataGranularity?: string | null;
  status: string;
  importedAt: string;
  importedBy?: string | null;
  recordCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  dataStatus: string;
  qualityReport?: string | null;
  rawSample?: string | null;
  createdAt: string;
}

export * from "./decisionNetwork";

