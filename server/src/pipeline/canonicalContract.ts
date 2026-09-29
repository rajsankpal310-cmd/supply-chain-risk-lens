/**
 * NEXUS-CFR Canonical Transaction Contract & Provider Mapping Registry
 * Phase 3.9: Primary Data Access & Enterprise Ingestion Architecture
 *
 * Enforces a strict, provider-agnostic data contract for all incoming
 * transaction records. Individual providers (Tally, SAP, Zoho Books,
 * QuickBooks, TReDS, CSV/Excel) map into this canonical schema before
 * entering the business validation, quality analysis, and import pipeline.
 */

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
}

export interface ProviderSchemaDefinition {
  providerId: string;
  providerName: string;
  version: string;
  rawKeyFields: {
    rawField: string;
    canonicalTarget: keyof CanonicalInvoiceContract;
    description: string;
    transformationNote?: string;
  }[];
}

export const PROVIDER_MAPPING_REGISTRY: Record<string, ProviderSchemaDefinition> = {
  TALLY_PRIME: {
    providerId: "TALLY_PRIME",
    providerName: "TallyPrime / Tally.ERP 9 (XML / ODBC)",
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
