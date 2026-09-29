export type SourceType =
  | "PRIMARY_TRANSACTION"
  | "PUBLIC_DATASET"
  | "EXTERNAL_REFERENCE"
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
  | "VERIFIED"
  | "EXTERNAL"
  | "UNVERIFIED"
  | "REJECTED";

export type BatchStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "REQUIRES_REVIEW"
  | "APPROVED"
  | "IMPORTED"
  | "FAILED";

export type RowClassification = "VALID" | "DUPLICATE" | "POTENTIAL_DUPLICATE" | "INVALID";

export const CANONICAL_FIELDS = [
  "transaction_id",
  "sme_id",
  "buyer_id",
  "supplier_id",
  "invoice_amount",
  "invoice_date",
  "due_date",
  "payment_date",
  "payment_status",
  "credit_period",
  "outstanding_amount",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const REQUIRED_CANONICAL_FIELDS: CanonicalField[] = [
  "sme_id",
  "buyer_id",
  "invoice_amount",
  "invoice_date",
  "due_date",
  "payment_status",
];

export const OPTIONAL_CANONICAL_FIELDS: CanonicalField[] = [
  "transaction_id",
  "supplier_id",
  "payment_date",
  "credit_period",
  "outstanding_amount",
];

export interface ColumnProfile {
  columnName: string;
  detectedType: "DATE" | "NUMERIC" | "STRING" | "BOOLEAN";
  sampleValues: string[];
  totalValues: number;
  nonEmptyValues: number;
  missingnessPercent: number;
  suggestedCanonical?: CanonicalField;
  matchConfidence: number; // 0 to 1
}

export interface SchemaInspectionResult {
  totalRows: number;
  columns: ColumnProfile[];
  suggestedMapping: Record<string, string>; // CanonicalField -> FileColumn
  unmappedRequired: CanonicalField[];
}

export interface RowError {
  field: string;
  problem: string;
  expectedFormat: string;
  remediation: string;
}

export interface RowWarning {
  field: string;
  message: string;
}

export interface CleanedTransaction {
  transactionId?: string;
  smeId: string;
  buyerId: string;
  supplierId?: string;
  invoiceAmount: number;
  outstandingAmount: number;
  invoiceDate: Date;
  dueDate: Date;
  paymentDate?: Date | null;
  creditPeriodDays: number;
  paymentDelayDays?: number | null;
  paymentStatus: string;
  riskLevel?: string;
}

export interface ProcessedRow {
  rowNumber: number;
  raw: Record<string, any>;
  cleaned?: CleanedTransaction;
  classification: RowClassification;
  valid: boolean;
  errors: RowError[];
  warnings: RowWarning[];
}

export interface DataQualityReport {
  totalRecords: number;
  acceptedRecords: number;
  rejectedRecords: number;
  exactDuplicates: number;
  potentialDuplicates: number;
  missingValuesByField: Record<string, number>;
  invalidDates: number;
  invalidAmounts: number;
  businessRuleViolations: number;
  completenessRate: number; // 0 - 100%
  validityRate: number;     // 0 - 100%
  duplicateRate: number;    // 0 - 100%
  qualityScore: number;     // 0 - 100% transparent formula
  summaryExplanation: string;
  importStatus: BatchStatus;
}

export interface ProvenanceMetadata {
  sourceType: SourceType;
  sourceName: string;
  sourceOrg?: string;
  sourceUrl?: string;
  datasetVersion?: string;
  sourceDate?: Date | string;
  license?: string;
  dataGranularity?: string;
  importedBy?: string;
}

export interface ValidationPipelineResult {
  schema: SchemaInspectionResult;
  provenance: ProvenanceMetadata;
  qualityReport: DataQualityReport;
  rows: ProcessedRow[];
  canImport: boolean;
}

export interface ImportExecutionResult {
  batchId: string;
  importedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  status: BatchStatus;
  qualityReport: DataQualityReport;
  errors: RowError[];
}
