/**
 * NEXUS-CFR Canonical Transaction Contract & Provider Mapping Registry
 * Phase 3.9: Primary Data Access & Enterprise Ingestion Architecture
 *
 * Enforces a strict, provider-agnostic data contract for all incoming
 * transaction records. Individual providers (Tally, SAP, Zoho Books,
 * QuickBooks, TReDS, CSV/Excel) map into this canonical schema before
 * entering the business validation, quality analysis, and import pipeline.
 */

export type GovernedDataSourceType =
  | "INVOICE_LIFECYCLE_DATA"
  | "ERP_EVENT_LOG_DATA"
  | "SURVEY_MICRODATA"
  | "ADMINISTRATIVE_REFERENCE_DATA";

export interface CanonicalInvoiceContract {
  transaction_id: string; // Unique transaction identifier
  sme_id: string; // Vendor / SME supplier identifier
  buyer_id: string; // Customer / Buyer enterprise identifier
  supplier_id?: string; // Optional parent supplier identifier
  invoice_amount: number; // Gross invoice billing value (> 0)
  invoice_date: string; // ISO 8601 date string (YYYY-MM-DD)
  due_date: string; // ISO 8601 maturity date (>= invoice_date)
  payment_date?: string | null; // ISO 8601 actual clearing date (nullable)
  credit_period: number; // Negotiated credit days (due_date - invoice_date)
  outstanding_amount: number; // Current unpaid balance
  payment_status: "PAID" | "PENDING" | "OVERDUE" | "DISPUTED";
  currency: string; // ISO 4217 Currency code (e.g. INR, USD)
  source_system: string; // e.g. "TALLY_PRIME", "ZOHO_BOOKS", "SAP_S4HANA", "TREDS_RXIL", "FILE_EXPORT"
  source_record_id: string; // Raw system voucher ID / document number
  extracted_at: string; // ISO 8601 timestamp of extraction
  raw_payload?: Record<string, any>; // Preserved original unmutated payload for auditability

  // Indian MSME Specific Identifiers (Present ONLY when legitimately observed)
  gstin?: string; // 15-character Goods and Services Tax Identification Number
  pan_hash?: string; // SHA-256 cryptographic hash of PAN (never stored in plaintext)
  udyam_id?: string; // Udyam Registration Number (e.g., UDYAM-XX-00-0000000)
  state?: string; // Indian State/UT code (e.g., "MH", "KA", "DL", "TN")
  industry?: string; // Industry classification (e.g., "AUTOMOTIVE_COMPONENTS", "TEXTILES")
  msme_category?: "MICRO" | "SMALL" | "MEDIUM"; // Statutory MSMED Act classification
}

/**
 * Validates 15-character Indian Goods and Services Tax Identification Number (GSTIN)
 * Format: 2 digits (state code) + 10 chars (PAN) + 1 digit (entity number) + 'Z' + 1 checksum char
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin || typeof gstin !== "string") return false;
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.trim().toUpperCase());
}

/**
 * Validates statutory Udyam Registration Number format: UDYAM-XX-00-0000000
 */
export function isValidUdyamId(udyamId: string): boolean {
  if (!udyamId || typeof udyamId !== "string") return false;
  const udyamRegex = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
  return udyamRegex.test(udyamId.trim().toUpperCase());
}

/**
 * Hashes Indian Permanent Account Number (PAN) using SHA-256 for privacy compliance.
 * Never stores or exposes plaintext PAN in analytics or logs.
 */
export function hashPAN(pan: string): string {
  if (!pan || typeof pan !== "string") return "";
  const cleaned = pan.trim().toUpperCase();
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(cleaned).digest("hex");
}

export interface CanonicalERPEventContract {
  case_id: string;
  purchase_document_id: string | null;
  purchase_item_id: string | null;
  vendor_id: string;
  company_id: string;
  event_type: string;
  event_timestamp: string; // ISO 8601
  monetary_value: number | null;
  item_type: string | null;
  spend_category: string | null;
  invoice_event: string | null;
  clearing_event: string | null;
  goods_receipt_event: string | null;
  process_duration: number | null; // elapsed days between defined invoice and clearing lifecycle events
  has_payment_block: boolean;
  has_rework: boolean;
  has_exception: boolean;
  source_system: string;
  source_record_id: string;
  extracted_at: string;
  raw_payload?: Record<string, any>;
}

export interface CanonicalSurveyMicrodataContract {
  survey_id: string;
  firm_id: string;
  country: string;
  survey_year: number;
  sector: string;
  firm_size: "MICRO" | "SMALL" | "MEDIUM" | "LARGE";
  annual_sales_range: string | null;
  working_capital_financing_source: string | null;
  delayed_payment_experience: boolean | null;
  percent_sales_delayed: number | null;
  access_to_credit_constraint: string | null;
  source_publisher: string;
  extracted_at: string;
  raw_payload?: Record<string, any>;
}

export interface CanonicalAdministrativeReferenceContract {
  benchmark_id: string;
  sector_code: string;
  sector_name: string;
  statutory_credit_period_days: number;
  average_actual_payment_days: number;
  average_delay_days: number;
  delinquency_rate: number;
  cascade_vulnerability: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  sample_firm_count: number;
  source_publisher: string;
}

export interface ProviderSchemaDefinition {
  providerId: string;
  providerName: string;
  sourceType: GovernedDataSourceType;
  version: string;
  rawKeyFields: {
    rawField: string;
    canonicalTarget: string;
    description: string;
    transformationNote?: string;
  }[];
}

export const PROVIDER_MAPPING_REGISTRY: Record<string, ProviderSchemaDefinition> = {
  BPI_CHALLENGE_2019: {
    providerId: "BPI_CHALLENGE_2019",
    providerName: "BPI Challenge 2019 (SAP P2P Real Enterprise Event Log)",
    sourceType: "ERP_EVENT_LOG_DATA",
    version: "2019.1",
    rawKeyFields: [
      { rawField: "case:concept:name", canonicalTarget: "case_id", description: "Case item identifier" },
      { rawField: "case:Purchasing Document", canonicalTarget: "purchase_document_id", description: "SAP PO document number" },
      { rawField: "case:Item", canonicalTarget: "purchase_item_id", description: "SAP PO line item" },
      { rawField: "case:Vendor", canonicalTarget: "vendor_id", description: "Anonymized vendor identifier" },
      { rawField: "case:Company", canonicalTarget: "company_id", description: "Operating company code" },
      { rawField: "concept:name", canonicalTarget: "event_type", description: "P2P lifecycle activity name" },
      { rawField: "time:timestamp", canonicalTarget: "event_timestamp", description: "Event execution timestamp" },
      { rawField: "case:Gross order value", canonicalTarget: "monetary_value", description: "Gross PO monetary value" },
      { rawField: "case:Item Type", canonicalTarget: "item_type", description: "Standard, Service, Consignment, 3rd Party" },
      { rawField: "case:Spend area text", canonicalTarget: "spend_category", description: "Procurement category" },
    ],
  },
  TALLY_PRIME: {
    providerId: "TALLY_PRIME",
    providerName: "TallyPrime / Tally.ERP 9 (XML / ODBC)",
    sourceType: "INVOICE_LIFECYCLE_DATA",
    version: "2024.1",
    rawKeyFields: [
      { rawField: "VOUCHERNUMBER", canonicalTarget: "transaction_id", description: "Tally voucher voucher number" },
      { rawField: "PARTYNAME", canonicalTarget: "buyer_id", description: "Customer / Debtor ledger name" },
      { rawField: "COMPANYNAME", canonicalTarget: "sme_id", description: "Operating SME company name" },
      { rawField: "AMOUNT", canonicalTarget: "invoice_amount", description: "Voucher debit amount", transformationNote: "Convert absolute debit value to positive float" },
      { rawField: "DATE", canonicalTarget: "invoice_date", description: "Voucher date (YYYYMMDD)", transformationNote: "Normalize YYYYMMDD to YYYY-MM-DD" },
      { rawField: "BILLDUEDATE", canonicalTarget: "due_date", description: "Bill-by-bill maturity date" },
      { rawField: "CLEARINGDATE", canonicalTarget: "payment_date", description: "Bank reconciliation date (if cleared)" },
      { rawField: "CLOSINGBALANCE", canonicalTarget: "outstanding_amount", description: "Pending bill balance" },
    ],
  },
  ZOHO_BOOKS: {
    providerId: "ZOHO_BOOKS",
    providerName: "Zoho Books REST API v3",
    sourceType: "INVOICE_LIFECYCLE_DATA",
    version: "v3",
    rawKeyFields: [
      { rawField: "invoice_id", canonicalTarget: "transaction_id", description: "Zoho unique invoice identifier" },
      { rawField: "customer_id", canonicalTarget: "buyer_id", description: "Zoho contact/customer identifier" },
      { rawField: "organization_id", canonicalTarget: "sme_id", description: "Tenant Zoho organization ID" },
      { rawField: "total", canonicalTarget: "invoice_amount", description: "Gross invoice total" },
      { rawField: "date", canonicalTarget: "invoice_date", description: "Invoice issuance date (YYYY-MM-DD)" },
      { rawField: "due_date", canonicalTarget: "due_date", description: "Invoice due date (YYYY-MM-DD)" },
      { rawField: "last_payment_date", canonicalTarget: "payment_date", description: "Latest applied payment date" },
      { rawField: "balance", canonicalTarget: "outstanding_amount", description: "Current unpaid balance" },
      { rawField: "status", canonicalTarget: "payment_status", description: "paid, unpaid, overdue, void" },
    ],
  },
  QUICKBOOKS_ONLINE: {
    providerId: "QUICKBOOKS_ONLINE",
    providerName: "Intuit QuickBooks Online Accounting API",
    sourceType: "INVOICE_LIFECYCLE_DATA",
    version: "v3",
    rawKeyFields: [
      { rawField: "DocNumber", canonicalTarget: "transaction_id", description: "QuickBooks invoice document number" },
      { rawField: "CustomerRef.value", canonicalTarget: "buyer_id", description: "Intuit customer reference ID" },
      { rawField: "TotalAmt", canonicalTarget: "invoice_amount", description: "Invoice total monetary amount" },
      { rawField: "TxnDate", canonicalTarget: "invoice_date", description: "Transaction date (YYYY-MM-DD)" },
      { rawField: "DueDate", canonicalTarget: "due_date", description: "Contractual due date (YYYY-MM-DD)" },
      { rawField: "Balance", canonicalTarget: "outstanding_amount", description: "Unpaid open balance" },
    ],
  },
  SAP_S4HANA: {
    providerId: "SAP_S4HANA",
    providerName: "SAP S/4HANA Cloud (OData Financial API)",
    sourceType: "INVOICE_LIFECYCLE_DATA",
    version: "API_OP_JOURNALENTRY_SRV",
    rawKeyFields: [
      { rawField: "AccountingDocument", canonicalTarget: "transaction_id", description: "FI Journal entry document number" },
      { rawField: "Customer", canonicalTarget: "buyer_id", description: "Customer account master number" },
      { rawField: "CompanyCode", canonicalTarget: "sme_id", description: "FI Company code" },
      { rawField: "AmountInCompanyCodeCurrency", canonicalTarget: "invoice_amount", description: "Gross debit transaction amount" },
      { rawField: "PostingDate", canonicalTarget: "invoice_date", description: "Financial posting date" },
      { rawField: "NetDueDate", canonicalTarget: "due_date", description: "Calculated net due date" },
      { rawField: "ClearingDate", canonicalTarget: "payment_date", description: "Augmented clearing date" },
    ],
  },
  TREDS_SANDBOX: {
    providerId: "TREDS_SANDBOX",
    providerName: "TReDS Factoring Exchange Sandbox (RXIL / M1xchange / Invoicemart)",
    sourceType: "INVOICE_LIFECYCLE_DATA",
    version: "v1.2",
    rawKeyFields: [
      { rawField: "FactoringUnitId", canonicalTarget: "transaction_id", description: "Factoring unit unique registration number" },
      { rawField: "BuyerGstin", canonicalTarget: "buyer_id", description: "Verified GSTIN of the corporate buyer" },
      { rawField: "SellerGstin", canonicalTarget: "sme_id", description: "Verified GSTIN of the SME supplier" },
      { rawField: "FactoredAmount", canonicalTarget: "invoice_amount", description: "Accepted invoice face value" },
      { rawField: "InvoiceDate", canonicalTarget: "invoice_date", description: "Invoice issuance date" },
      { rawField: "MaturityDate", canonicalTarget: "due_date", description: "TReDS bill maturity date" },
      { rawField: "SettlementDate", canonicalTarget: "payment_date", description: "Clearing corporation settlement date" },
      { rawField: "SettlementStatus", canonicalTarget: "payment_status", description: "SETTLED, PENDING, DEFAULTED" },
    ],
  },
  CONTROLLED_FILE_EXPORT: {
    providerId: "CONTROLLED_FILE_EXPORT",
    providerName: "Controlled Enterprise File Export (CSV / Excel / JSON)",
    sourceType: "INVOICE_LIFECYCLE_DATA",
    version: "1.0",
    rawKeyFields: [
      { rawField: "transaction_id", canonicalTarget: "transaction_id", description: "Unique invoice or transaction ID" },
      { rawField: "sme_id", canonicalTarget: "sme_id", description: "Vendor identifier" },
      { rawField: "buyer_id", canonicalTarget: "buyer_id", description: "Buyer enterprise identifier" },
      { rawField: "invoice_amount", canonicalTarget: "invoice_amount", description: "Invoice monetary value" },
      { rawField: "invoice_date", canonicalTarget: "invoice_date", description: "Invoice date (YYYY-MM-DD)" },
      { rawField: "due_date", canonicalTarget: "due_date", description: "Invoice due date (YYYY-MM-DD)" },
      { rawField: "payment_date", canonicalTarget: "payment_date", description: "Payment settlement date (optional)" },
    ],
  },
};

