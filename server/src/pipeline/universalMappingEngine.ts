/**
 * NEXUS-CFR UNIVERSAL DATA MAPPING ENGINE
 *
 * Implements a universal, semantic, data-aware, multi-signal column mapping engine
 * for CSV, XLSX, accounting, ERP, and public datasets.
 *
 * CORE PRINCIPLE:
 * Column names alone must NEVER determine the mapping.
 * Combines 10+ signals:
 * - Normalized header tokenization & abbreviation expansion
 * - Extensible alias dictionary
 * - Inferred data types (NUMERIC, DATE, STRING, BOOLEAN)
 * - Sample value inspection & regex pattern matching (currency, ID, date, status)
 * - Cardinality & uniqueness ratios
 * - Party-role disambiguation (BUYER vs SUPPLIER vs SME)
 * - Relationship direction inference
 * - Dynamic confidence scoring (HIGH, MEDIUM, LOW, UNCERTAIN)
 * - Strong negative semantic penalties (e.g. Check Number ≠ Outstanding Amount)
 * - Optional fields left unmapped when low confidence (<70%)
 * - User override support with 100% confidence
 * - Never fabricates missing fields (SME ID, due date, outstanding amount)
 */

export type InferredDataType = "NUMERIC" | "DATE" | "STRING" | "BOOLEAN" | "EMPTY";
export type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW" | "UNCERTAIN";
export type CanonicalCategory = "IDENTITY" | "PARTIES" | "FINANCIAL" | "DATES" | "STATUS" | "BUSINESS";

export interface CanonicalFieldDef {
  key: string;
  label: string;
  category: CanonicalCategory;
  isRequired: boolean;
  expectedType: InferredDataType;
  description: string;
  aliases: string[];
  role: "TRANSACTION_ID" | "SME" | "BUYER" | "SUPPLIER" | "AMOUNT" | "DATE" | "STATUS" | "GENERAL";
}

export interface ColumnSampleProfile {
  header: string;
  normalizedHeader: string;
  tokens: string[];
  inferredType: InferredDataType;
  totalCount: number;
  nonNullCount: number;
  nullRate: number;
  distinctCount: number;
  uniquenessRatio: number;
  sampleValues: string[];
  isLikelyId: boolean;
  isLikelyCurrency: boolean;
  isLikelyDate: boolean;
  isLikelyStatus: boolean;
  isLikelyCompanyName: boolean;
}

export interface CandidateMapping {
  canonicalField: string;
  sourceColumn: string | null;
  confidence: number;
  tier: ConfidenceTier;
  reason: string;
  signals: string[];
  needsReview: boolean;
  isRequired: boolean;
}

export interface DatasetProfile {
  totalRows: number;
  totalColumns: number;
  dateColumns: string[];
  amountColumns: string[];
  identifierColumns: string[];
  partyColumns: string[];
  statusColumns: string[];
  candidateTransactionId: string | null;
  candidateBuyer: string | null;
  candidateSupplier: string | null;
  candidateInvoiceDate: string | null;
  candidateDueDate: string | null;
  candidatePaymentDate: string | null;
  detectedRelationshipDirection: "SME_TO_BUYER" | "SUPPLIER_TO_SME" | "SUPPLIER_TO_BUYER" | "SUPPLIER_TO_SME_TO_BUYER" | "AMBIGUOUS";
  warnings: string[];
}

export interface UniversalMappingResult {
  headers: string[];
  columnProfiles: Record<string, ColumnSampleProfile>;
  datasetProfile: DatasetProfile;
  suggestedMapping: Record<string, string>;
  mappingCandidates: CandidateMapping[];
  requiredFieldsStatus: {
    totalRequired: number;
    mappedRequired: number;
    needsReviewCount: number;
    isReadyForValidation: boolean;
  };
  optionalFieldsStatus: {
    totalOptional: number;
    mappedOptional: number;
  };
}

export class UniversalMappingEngine {
  // --------------------------------------------------------------------------
  // CANONICAL FIELD DEFINITIONS
  // --------------------------------------------------------------------------
  static readonly CANONICAL_FIELDS: CanonicalFieldDef[] = [
    // Identity
    {
      key: "transaction_id",
      label: "Transaction / Invoice ID",
      category: "IDENTITY",
      isRequired: true,
      expectedType: "STRING",
      description: "Unique transaction, invoice, voucher, or document reference number.",
      role: "TRANSACTION_ID",
      aliases: [
        "transaction_id", "transactionid", "invoice_id", "invoiceid", "invoice_no", "invoiceno",
        "invoice_num", "invoice_number", "inv_no", "inv_num", "inv_number", "inv_id",
        "bill_no", "bill_number", "bill_num", "bill_id", "voucher_no", "voucher_number",
        "doc_no", "document_no", "document_number", "doc_id", "tx_id", "txn_id",
        "reference_no", "reference_id", "ref_no", "ref_id", "receipt_no", "entry_no",
        "vendor_invoice_no", "vendor_invoice_number", "vendor_inv_no", "vendor_invoice_num",
        "doc_reference", "document_reference", "id_col", "invoice"
      ],
    },

    // Parties: Separate SME, Buyer, and Supplier
    {
      key: "sme_id",
      label: "SME / Primary Company ID",
      category: "PARTIES",
      isRequired: false, // Determined dynamically; never guessed
      expectedType: "STRING",
      description: "Explicit identifier for the primary organization / SME.",
      role: "SME",
      aliases: [
        "sme_id", "smeid", "sme_code", "smecode", "my_company", "our_company",
        "internal_company_id", "our_company_id", "seller_company_id",
        "organization_id", "org_id", "origin_firm", "our_firm"
      ],
    },
    {
      key: "supplier_id",
      label: "Supplier / Vendor ID",
      category: "PARTIES",
      isRequired: false, // Determined dynamically
      expectedType: "STRING",
      description: "Counterparty supplying goods or receiving disbursement (vendor code, supplier ID).",
      role: "SUPPLIER",
      aliases: [
        "supplier_id", "supplierid", "supplier_code", "suppliercode", "supplier_no", "supplier_number",
        "vendor_id", "vendorid", "vendor_code", "vendorcode", "vendor_no", "vendor_num", "vendor_number",
        "seller_id", "seller_code", "payee_id", "payee_code", "creditor_id", "tier2_supplier",
        "upstream_supplier", "vendor", "supplier"
      ],
    },
    {
      key: "supplier_name",
      label: "Supplier / Vendor Name",
      category: "PARTIES",
      isRequired: false,
      expectedType: "STRING",
      description: "Legal or registered name of the vendor or supplier firm.",
      role: "SUPPLIER",
      aliases: [
        "supplier_name", "suppliername", "supplier", "vendor_name", "vendorname", "vendor_legal_name",
        "supplier_legal_name", "legal_name", "vendor", "payee_name", "seller_name", "seller",
        "beneficiary_name", "beneficiary", "payee", "party_legal_name"
      ],
    },
    {
      key: "buyer_id",
      label: "Buyer / Customer / Department ID",
      category: "PARTIES",
      isRequired: false, // Determined dynamically
      expectedType: "STRING",
      description: "Counterparty purchasing goods/services (customer, buyer, department code).",
      role: "BUYER",
      aliases: [
        "buyer_id", "buyerid", "buyer_code", "buyercode", "customer_id", "customerid", "customer_code",
        "customercode", "customer_no", "customer_num", "customer_number", "client_id", "client_code",
        "department_code", "department_id", "department_no", "dept_code", "dept_id", "dept_no", "dept",
        "purchaser_id", "purchaser_code", "debtor_id", "debtor_code", "dest_firm", "target_firm",
        "purchasing_unit_id", "purchasing_code", "client_number"
      ],
    },
    {
      key: "buyer_name",
      label: "Buyer / Customer / Department Name",
      category: "PARTIES",
      isRequired: false,
      expectedType: "STRING",
      description: "Legal or display name of the purchasing customer or department.",
      role: "BUYER",
      aliases: [
        "buyer_name", "buyername", "buyer", "customer_name", "customername", "customer", "client_name",
        "client", "department_name", "departmentname", "dept_name", "department", "purchasing_company",
        "purchasing_unit", "purchasing_dept", "purchasing_department", "purchaser_name", "purchaser",
        "billed_to", "bill_to_name", "debtor_name"
      ],
    },

    // Financial
    {
      key: "invoice_amount",
      label: "Invoice / Transaction Amount",
      category: "FINANCIAL",
      isRequired: true,
      expectedType: "NUMERIC",
      description: "Gross or net monetary amount of the invoice, bill, or voucher.",
      role: "AMOUNT",
      aliases: [
        "invoice_amount", "invoiceamount", "amount", "total_amount", "gross_amount", "net_amount",
        "inv_amt", "inv_val", "bill_amount", "invoice_value", "total_open_amount", "disb_amount",
        "disbursement_amount", "transaction_amount", "line_amount", "value", "price",
        "invoice_total", "total_invoiced", "invoiced_amount", "bill_total", "total_val"
      ],
    },
    {
      key: "outstanding_amount",
      label: "Outstanding / Open Amount",
      category: "FINANCIAL",
      isRequired: false, // OPTIONAL: never fabricated
      expectedType: "NUMERIC",
      description: "Remaining unpaid balance on this invoice or line item.",
      role: "AMOUNT",
      aliases: [
        "outstanding_amount", "outstandingamount", "outstanding", "open_amount", "balance_due",
        "due_amount", "unpaid_amount", "balance", "remaining_amount", "open_balance", "balance_amount",
        "unpaid_balance", "open_item_amount"
      ],
    },
    {
      key: "payment_amount",
      label: "Payment / Settled Amount",
      category: "FINANCIAL",
      isRequired: false,
      expectedType: "NUMERIC",
      description: "Amount paid, disbursed, or cleared.",
      role: "AMOUNT",
      aliases: [
        "payment_amount", "paid_amount", "settlement_amount", "cleared_amount", "disbursed_amount",
        "check_amount", "actual_payment_amount", "disb_amt"
      ],
    },
    {
      key: "currency",
      label: "Currency",
      category: "FINANCIAL",
      isRequired: false,
      expectedType: "STRING",
      description: "Three-letter ISO currency code or symbol (INR, USD, EUR, GBP).",
      role: "GENERAL",
      aliases: ["currency", "currency_code", "curr", "curr_code", "iso_currency", "doc_currency"],
    },

    // Dates
    {
      key: "invoice_date",
      label: "Invoice / Document Date",
      category: "DATES",
      isRequired: true,
      expectedType: "DATE",
      description: "Date the invoice, bill, or transaction document was issued.",
      role: "DATE",
      aliases: [
        "invoice_date", "invoicedate", "inv_date", "inv_dt", "bill_date", "vendor_invoice_date",
        "document_date", "doc_date", "issue_date", "posting_date", "txn_date", "tx_date", "date", "posting_dt"
      ],
    },
    {
      key: "due_date",
      label: "Due Date",
      category: "DATES",
      isRequired: false, // OPTIONAL: never fabricated
      expectedType: "DATE",
      description: "Contractual payment due date or maturity date.",
      role: "DATE",
      aliases: [
        "due_date", "duedate", "due_dt", "due_in_date", "payment_due_date", "maturity_date",
        "net_due_date", "expiry_date", "expected_date", "pay_due", "pay_due_date"
      ],
    },
    {
      key: "payment_date",
      label: "Payment / Settlement Date",
      category: "DATES",
      isRequired: false, // OPTIONAL
      expectedType: "DATE",
      description: "Actual clearance, settlement, or disbursement date.",
      role: "DATE",
      aliases: [
        "payment_date", "paymentdate", "paid_date", "paid_dt", "clear_date", "clearing_date",
        "cleared_date", "disbursement_date", "disb_date", "settlement_date", "check_date",
        "check_clearance_date", "actual_payment_date", "clear_dt", "settlement_dt"
      ],
    },

    // Status
    {
      key: "payment_status",
      label: "Payment Status",
      category: "STATUS",
      isRequired: false,
      expectedType: "STRING",
      description: "Payment lifecycle status (PAID, PENDING, OVERDUE, OPEN, CANCELLED).",
      role: "STATUS",
      aliases: [
        "payment_status", "paymentstatus", "status", "check_status", "invoice_status", "inv_status",
        "state", "settlement_status", "doc_status", "transaction_status"
      ],
    },
    {
      key: "is_open",
      label: "Is Open Flag",
      category: "STATUS",
      isRequired: false,
      expectedType: "BOOLEAN",
      description: "Boolean indicator whether the invoice is open or closed.",
      role: "STATUS",
      aliases: ["is_open", "isopen", "open_flag", "unpaid_flag", "open_item"],
    },

    // Optional Business Context
    {
      key: "purchase_order_id",
      label: "Purchase Order (PO) Number",
      category: "BUSINESS",
      isRequired: false,
      expectedType: "STRING",
      description: "Associated Purchase Order or Work Order identifier.",
      role: "GENERAL",
      aliases: ["purchase_order_id", "purchase_order", "po_number", "po_no", "po_num", "order_no", "order_number"],
    },
    {
      key: "document_id",
      label: "Document Reference / Check ID",
      category: "BUSINESS",
      isRequired: false,
      expectedType: "STRING",
      description: "Secondary accounting document, check, or voucher identifier.",
      role: "GENERAL",
      aliases: [
        "document_id", "doc_id", "dis_doc_id", "voucher_id", "voucher_no",
        "check_no", "check_number", "check_num", "check"
      ],
    },
    {
      key: "document_type",
      label: "Document Type",
      category: "BUSINESS",
      isRequired: false,
      expectedType: "STRING",
      description: "Type of financial document (e.g. INVOICE, CREDIT_NOTE, VOUCHER).",
      role: "GENERAL",
      aliases: ["document_type", "doc_type", "voucher_type", "invoice_type", "record_type"],
    },
    {
      key: "credit_period",
      label: "Credit Period / Terms (Days)",
      category: "BUSINESS",
      isRequired: false,
      expectedType: "NUMERIC",
      description: "Contractual credit period duration in days.",
      role: "GENERAL",
      aliases: [
        "credit_period", "creditperiod", "credit_period_days", "credit_days", "terms_days",
        "payment_terms", "credit_terms", "terms"
      ],
    },
    {
      key: "business_unit",
      label: "Business Unit / Division",
      category: "BUSINESS",
      isRequired: false,
      expectedType: "STRING",
      description: "Operating unit, plant, or branch.",
      role: "GENERAL",
      aliases: ["business_unit", "bu", "division", "branch", "operating_unit", "entity"],
    },
    {
      key: "industry",
      label: "Industry / Sector",
      category: "BUSINESS",
      isRequired: false,
      expectedType: "STRING",
      description: "Industrial classification or commerce category.",
      role: "GENERAL",
      aliases: ["industry", "sector", "business_category", "segment"],
    },
    {
      key: "region",
      label: "Region / Territory",
      category: "BUSINESS",
      isRequired: false,
      expectedType: "STRING",
      description: "Geographic territory, state, or location.",
      role: "GENERAL",
      aliases: ["region", "state", "zone", "territory", "city", "location", "geo"],
    },
  ];

  // --------------------------------------------------------------------------
  // HEADER NORMALIZATION
  // --------------------------------------------------------------------------
  static normalizeHeader(header: string): { normalized: string; tokens: string[] } {
    if (!header) return { normalized: "", tokens: [] };

    const cleaned = header.trim().toLowerCase();

    // Comprehensive abbreviation dictionary
    const abbrevMap: Record<string, string> = {
      "inv": "invoice",
      "no": "number",
      "num": "number",
      "nbr": "number",
      "dt": "date",
      "amt": "amount",
      "val": "value",
      "tot": "total",
      "dept": "department",
      "disb": "disbursement",
      "cust": "customer",
      "supp": "supplier",
      "vend": "vendor",
      "org": "organization",
      "tx": "transaction",
      "txn": "transaction",
      "doc": "document",
      "ref": "reference",
      "bal": "balance",
      "out": "outstanding",
      "po": "purchase_order",
      "curr": "currency",
      "cd": "code",
      "chk": "check",
      "clr": "clear",
      "pay": "payment",
      "fisc": "fiscal",
      "yr": "year",
      "vch": "voucher",
      "seq": "sequence",
    };

    const spaceSeparated = cleaned.replace(/[^a-z0-9]+/g, " ").trim();
    const rawTokens = spaceSeparated.split(/\s+/).filter(Boolean);

    const expandedTokens = rawTokens.map((t) => abbrevMap[t] || t);
    const normalized = expandedTokens.join("_");

    return { normalized, tokens: expandedTokens };
  }

  // --------------------------------------------------------------------------
  // DATA TYPE & VALUE PATTERN ANALYSIS (BOUNDED REPRESENTATIVE SAMPLE)
  // --------------------------------------------------------------------------
  static profileColumn(header: string, rawValues: any[]): ColumnSampleProfile {
    const { normalized, tokens } = this.normalizeHeader(header);
    const totalCount = rawValues.length;

    const stringValues: string[] = rawValues
      .map((v) => (v !== undefined && v !== null ? String(v).trim() : ""))
      .filter((v) => v !== "");

    const nonNullCount = stringValues.length;
    const nullRate = totalCount > 0 ? (totalCount - nonNullCount) / totalCount : 1;

    const distinctSet = new Set(stringValues);
    const distinctCount = distinctSet.size;
    const uniquenessRatio = nonNullCount > 0 ? distinctCount / nonNullCount : 0;

    const sampleValues = stringValues.slice(0, 8);

    let numMatches = 0;
    let dateMatches = 0;
    let boolMatches = 0;
    let currencyMatches = 0;
    let idPatternMatches = 0;
    let statusMatches = 0;
    let companyNameMatches = 0;

    const statusKeywords = new Set([
      "paid", "unpaid", "pending", "overdue", "cleared", "settled", "open", "closed",
      "cancelled", "delayed", "late", "partial", "partially_paid", "approved", "disbursed"
    ]);

    const companySuffixes = /(inc|llc|corp|corporation|ltd|limited|pvt|private|co|company|services|technologies|department|enterprises|solutions|industries|agency|authority)/i;

    for (const val of stringValues) {
      const lower = val.toLowerCase();

      // Boolean check
      if (/^(true|false|yes|no|y|n|0|1)$/i.test(val)) {
        boolMatches++;
      }

      // Currency check
      if (/[$₹€£]/.test(val) || (/^\d+(\.\d{2})$/.test(val) && !isNaN(Number(val)))) {
        currencyMatches++;
      }

      // Numeric check (stripping currency & comma)
      const cleanNum = val.replace(/[$₹€£,\s]/g, "");
      if (cleanNum !== "" && !isNaN(Number(cleanNum))) {
        numMatches++;
      }

      // Date check
      if (this.isValidDate(val)) {
        dateMatches++;
      }

      // ID-like pattern: alphanumeric code
      if (/^[a-zA-Z0-9_\-\/]{2,40}$/.test(val) && (/\d/.test(val) || val.includes("-") || val.includes("_"))) {
        idPatternMatches++;
      }

      // Status check
      if (statusKeywords.has(lower)) {
        statusMatches++;
      }

      // Company name check
      if (companySuffixes.test(val) || (val.includes(" ") && val.length > 5 && !/\d{4}/.test(val))) {
        companyNameMatches++;
      }
    }

    let inferredType: InferredDataType = "STRING";
    if (nonNullCount === 0) {
      inferredType = "EMPTY";
    } else if (dateMatches / nonNullCount >= 0.7) {
      inferredType = "DATE";
    } else if (numMatches / nonNullCount >= 0.7) {
      inferredType = "NUMERIC";
    } else if (boolMatches / nonNullCount >= 0.8) {
      inferredType = "BOOLEAN";
    }

    return {
      header,
      normalizedHeader: normalized,
      tokens,
      inferredType,
      totalCount,
      nonNullCount,
      nullRate: Math.round(nullRate * 100) / 100,
      distinctCount,
      uniquenessRatio: Math.round(uniquenessRatio * 100) / 100,
      sampleValues,
      isLikelyId: nonNullCount > 0 && idPatternMatches / nonNullCount >= 0.6,
      isLikelyCurrency: nonNullCount > 0 && currencyMatches / nonNullCount >= 0.5,
      isLikelyDate: nonNullCount > 0 && dateMatches / nonNullCount >= 0.6,
      isLikelyStatus: nonNullCount > 0 && statusMatches > 0 && (statusMatches / nonNullCount >= 0.5 || distinctCount <= 8),
      isLikelyCompanyName: nonNullCount > 0 && companyNameMatches / nonNullCount >= 0.4,
    };
  }

  static isValidDate(val: string): boolean {
    if (!val || typeof val !== "string") return false;
    const clean = val.trim();

    // Pure short numbers are not dates
    if (/^\d{1,5}$/.test(clean)) return false;

    // Alphanumeric invoice/code patterns e.g. INV-2026-001, BILL-01 are not dates
    if (/^[a-zA-Z]{1,10}[-_/]\d+/.test(clean)) return false;

    // ISO YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(clean)) {
      const d = new Date(clean.replace(/\./g, "-").replace(/\//g, "-"));
      return !isNaN(d.getTime()) && d.getFullYear() >= 1990 && d.getFullYear() <= 2045;
    }

    // DD/MM/YYYY or MM/DD/YYYY
    const dmy = clean.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (dmy) {
      const year = parseInt(dmy[3], 10);
      return year >= 1990 && year <= 2045;
    }

    // Named month e.g. 15-May-2026 or May 15, 2026
    if (/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(clean)) {
      const d = new Date(clean);
      return !isNaN(d.getTime()) && d.getFullYear() >= 1990 && d.getFullYear() <= 2045;
    }

    return false;
  }

  // --------------------------------------------------------------------------
  // SEMANTIC & MULTI-SIGNAL SCORING
  // --------------------------------------------------------------------------
  static scoreCandidate(
    fieldDef: CanonicalFieldDef,
    profile: ColumnSampleProfile,
    allProfiles: ColumnSampleProfile[]
  ): { score: number; signals: string[]; reason: string } {
    let score = 0;
    const signals: string[] = [];

    const norm = profile.normalizedHeader;
    const tokens = profile.tokens;

    // ------------------------------------------------------------------------
    // NEGATIVE SEMANTIC FILTERS & HARD DISQUALIFICATIONS
    // (Business semantics must strictly dominate data type compatibility)
    // ------------------------------------------------------------------------

    // A. Financial Amount Disqualifications:
    // Check Number, Invoice Number, Vendor Code, Dept Code, Fiscal Year, Object Code, Fund Code
    // must NEVER be mapped to financial amounts merely because they are numeric or ID-like!
    if (fieldDef.role === "AMOUNT") {
      const amountPositiveTokens = new Set([
        "amount", "amt", "val", "value", "total", "gross", "net", "balance",
        "outstanding", "disbursement", "disb", "price", "fee", "cost", "charge"
      ]);

      const amountNegativeTokens = new Set([
        "check", "chk", "voucher", "vch", "vendor", "vend", "supplier", "supp",
        "customer", "cust", "buyer", "department", "dept", "fiscal", "fisc",
        "year", "yr", "object", "obj", "fund", "fnd", "account", "acct", "acc",
        "document", "doc", "ref", "reference", "id", "code", "number", "num",
        "no", "zip", "phone", "mobile", "tax", "pan", "gstin", "order", "po", "item"
      ]);

      const hasPositiveAmountToken = tokens.some((t) => amountPositiveTokens.has(t));
      const hasNegativeAmountToken = tokens.some((t) => amountNegativeTokens.has(t));

      // Disqualify if header indicates code, reference, check, id, or year WITHOUT any positive amount keyword
      if (hasNegativeAmountToken && !hasPositiveAmountToken) {
        return {
          score: 0,
          signals: ["Disqualified: Header indicates identifier, check, code, or reference, not a monetary amount."],
          reason: "Non-monetary identifier/reference cannot be mapped to a financial amount."
        };
      }

      // OUTSTANDING AMOUNT SPECIFIC RULE:
      // Must have explicit balance/outstanding tokens. Generic 'amount' is primary invoice amount, not outstanding.
      if (fieldDef.key === "outstanding_amount") {
        const hasBalanceToken = tokens.some((t) =>
          ["outstanding", "open", "balance", "unpaid", "remaining"].includes(t)
        );
        if (!hasBalanceToken) {
          return {
            score: 0,
            signals: ["Disqualified: Header does not indicate open balance or outstanding amount."],
            reason: "No reliable outstanding/open amount detected in header."
          };
        }
      }

      // PAYMENT AMOUNT SPECIFIC RULE:
      if (fieldDef.key === "payment_amount") {
        const hasPaymentToken = tokens.some((t) =>
          ["payment", "paid", "settle", "settlement", "clear", "cleared", "disb", "disbursement"].includes(t)
        );
        if (!hasPaymentToken) {
          return {
            score: 0,
            signals: ["Disqualified: Header does not indicate disbursement or paid amount."],
            reason: "No payment/disbursement amount indicated in header."
          };
        }
      }
    }

    // B. SME ID Hard Disqualifications:
    // SME ID must NEVER be guessed from vendor_code, department_code, customer_code, account_no
    if (fieldDef.role === "SME") {
      const smeNegativeTokens = [
        "vendor", "supplier", "buyer", "customer", "client", "department",
        "dept", "payee", "seller", "beneficiary", "account", "dest", "target"
      ];
      if (tokens.some((t) => smeNegativeTokens.includes(t))) {
        return {
          score: 0,
          signals: ["Disqualified: Header indicates counterparty, not primary SME."],
          reason: "Counterparty code/name cannot be mapped to primary SME ID."
        };
      }

      // Must have strong positive SME signal
      const hasStrongSmeSignal = tokens.some((t) =>
        ["sme", "our", "internal", "my", "organization_id", "org_id", "seller_company_id"].includes(t)
      );
      if (!hasStrongSmeSignal) {
        return {
          score: 0,
          signals: ["Unmapped: No explicit primary SME identifier found in header."],
          reason: "SME ID left unmapped; no explicit primary company identifier detected."
        };
      }
    }

    // C. Party Disambiguation:
    // Supplier cannot have Buyer tokens; Buyer cannot have Supplier tokens
    if (fieldDef.role === "SUPPLIER") {
      if (tokens.some((t) => ["buyer", "customer", "client", "department", "dept", "purchaser", "purchasing", "sme", "our"].includes(t))) {
        return {
          score: 0,
          signals: ["Disqualified: Header indicates purchasing buyer/department, not supplier."],
          reason: "Purchasing party cannot be mapped to supplier role."
        };
      }
    }

    if (fieldDef.role === "BUYER") {
      if (tokens.some((t) => ["supplier", "vendor", "seller", "payee", "beneficiary", "sme", "our"].includes(t))) {
        return {
          score: 0,
          signals: ["Disqualified: Header indicates vendor/supplier, not purchasing buyer."],
          reason: "Vendor/supplier party cannot be mapped to buyer role."
        };
      }
    }

    // D. Date Disambiguation:
    // Payment/disbursement date vs Due date vs Invoice date
    if (fieldDef.key === "due_date") {
      if (tokens.some((t) => ["disbursement", "disb", "clear", "clearing", "settle", "settlement", "paid", "check_date", "invoice", "inv", "bill", "issue", "posting"].includes(t))) {
        return {
          score: 0,
          signals: ["Disqualified: Header indicates settlement or invoice issuance, not due date."],
          reason: "Disbursement or invoice date cannot be confused with due date."
        };
      }
      const hasDueToken = tokens.some((t) => ["due", "maturity", "expiry", "expected"].includes(t));
      if (!hasDueToken) {
        return {
          score: 0,
          signals: ["Unmapped: Header does not indicate contractual maturity or due date."],
          reason: "Due date not detected in source; not fabricated."
        };
      }
    }

    if (fieldDef.key === "payment_date") {
      if (tokens.some((t) => ["due", "maturity", "expiry", "invoice", "inv", "bill", "issue"].includes(t))) {
        return {
          score: 0,
          signals: ["Disqualified: Header indicates invoice issue or due date, not payment clearance."],
          reason: "Due date or invoice date cannot be mapped to payment date."
        };
      }
      const hasPayToken = tokens.some((t) =>
        ["pay", "paid", "payment", "clear", "cleared", "clearing", "disb", "disbursement", "settle", "settlement", "check_date"].includes(t)
      );
      if (!hasPayToken) {
        return {
          score: 0,
          signals: ["Unmapped: Header does not indicate actual payment/settlement."],
          reason: "Settlement date not detected in header."
        };
      }
    }

    if (fieldDef.key === "invoice_date") {
      if (tokens.some((t) => ["due", "disb", "disbursement", "clear", "cleared", "settle", "settlement"].includes(t))) {
        return {
          score: 0,
          signals: ["Disqualified: Header indicates settlement or maturity date, not invoice issue date."],
          reason: "Settlement/due date cannot be mapped to invoice issue date."
        };
      }
    }

    // E. Transaction ID Disambiguation:
    // A date, amount, or purely counterparty identifier is NEVER a transaction ID
    if (fieldDef.key === "transaction_id") {
      if (
        tokens.some((t) => ["date", "dt", "day", "month", "year", "time", "timestamp"].includes(t)) ||
        profile.inferredType === "DATE"
      ) {
        return {
          score: 0,
          signals: ["Disqualified: Header or data profile indicates a date, not a transaction identifier."],
          reason: "Date column cannot be mapped to transaction ID."
        };
      }
      if (
        tokens.some((t) => ["amount", "amt", "price", "balance", "gross", "net"].includes(t)) ||
        (profile.inferredType === "NUMERIC" && tokens.some((t) => ["total", "val", "value"].includes(t)))
      ) {
        return {
          score: 0,
          signals: ["Disqualified: Header indicates a financial amount, not a transaction identifier."],
          reason: "Amount column cannot be mapped to transaction ID."
        };
      }
      if (
        tokens.some((t) => ["sme", "buyer", "customer", "client", "vendor", "supplier", "payee", "seller", "department", "dept"].includes(t)) &&
        !tokens.some((t) => ["invoice", "inv", "bill", "voucher", "doc", "document", "receipt", "tx", "txn", "transaction"].includes(t))
      ) {
        return {
          score: 0,
          signals: ["Disqualified: Header indicates counterparty/department, not transaction reference."],
          reason: "Party identifier cannot be mapped to transaction ID."
        };
      }
    }

    // F. Party ID vs Name Disambiguation:
    // Party ID columns (supplier_id, buyer_id) should not steal pure name columns (Vendor Legal Name)
    // and Name columns should not steal pure ID/Code columns (Vendor Code)
    const isPartyIdField =
      fieldDef.key === "supplier_id" ||
      fieldDef.key === "buyer_id" ||
      fieldDef.key === "department_id" ||
      fieldDef.key === "customer_id" ||
      fieldDef.key === "vendor_id";
    const isPartyNameField =
      fieldDef.key === "supplier_name" ||
      fieldDef.key === "buyer_name" ||
      fieldDef.key === "department_name" ||
      fieldDef.key === "customer_name" ||
      fieldDef.key === "vendor_name";

    const hasNameToken = tokens.some((t) => ["name", "legal_name", "title"].includes(t));
    const hasIdToken = tokens.some((t) => ["id", "code", "no", "num", "number"].includes(t));

    if (isPartyIdField && hasNameToken && !hasIdToken) {
      return {
        score: 0,
        signals: ["Disqualified: Column header indicates party name/title, not identifier code."],
        reason: "Party name column cannot be mapped to party ID."
      };
    }

    if (isPartyNameField && hasIdToken && !hasNameToken) {
      return {
        score: 0,
        signals: ["Disqualified: Column header indicates party identifier code, not party name."],
        reason: "Party ID/code column cannot be mapped to party name."
      };
    }

    // ------------------------------------------------------------------------
    // POSITIVE SCORING
    // ------------------------------------------------------------------------

    // 1. HEADER ALIAS MATCHING
    let bestAliasMatch = 0;
    let matchedAlias = "";

    for (const alias of fieldDef.aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanNorm = norm.replace(/[^a-z0-9]/g, "");

      if (cleanNorm === cleanAlias) {
        bestAliasMatch = 1.0;
        matchedAlias = alias;
        break;
      }

      // Token exact match
      const aliasTokens = alias.split(/[_ ]/);
      const tokenIntersection = aliasTokens.filter((at) => tokens.includes(at));
      if (tokenIntersection.length === aliasTokens.length && aliasTokens.length > 1) {
        if (bestAliasMatch < 0.9) {
          bestAliasMatch = 0.9;
          matchedAlias = alias;
        }
      } else if (
        cleanNorm.includes(cleanAlias) ||
        (cleanAlias.includes(cleanNorm) &&
          !["amount", "date", "name", "id", "code", "unit", "col", "num", "no"].includes(cleanNorm) &&
          cleanNorm.length >= 4)
      ) {
        const ratio = Math.min(cleanNorm.length, cleanAlias.length) / Math.max(cleanNorm.length, cleanAlias.length);
        const currentScore = 0.65 + ratio * 0.2;
        if (currentScore > bestAliasMatch) {
          bestAliasMatch = currentScore;
          matchedAlias = alias;
        }
      }
    }

    if (bestAliasMatch >= 0.95) {
      score += 55;
      signals.push(`Exact header match with known alias '${matchedAlias}'`);
    } else if (bestAliasMatch >= 0.75) {
      score += 40;
      signals.push(`Strong header token similarity with alias '${matchedAlias}'`);
    } else if (bestAliasMatch > 0.5) {
      score += 25;
      signals.push(`Partial header match with '${matchedAlias}'`);
    }

    // 2. DATA TYPE COMPATIBILITY & PENALTIES
    if (fieldDef.expectedType === profile.inferredType) {
      score += 20;
      signals.push(`Data type matches expected (${fieldDef.expectedType})`);
    } else if (fieldDef.expectedType === "STRING" && profile.inferredType !== "EMPTY") {
      // String can accept identifiers/codes that are numeric
      score += 20;
    } else if (fieldDef.expectedType === "NUMERIC" && profile.inferredType !== "NUMERIC") {
      score -= 40;
      signals.push(`Type mismatch: expected NUMERIC, received ${profile.inferredType}`);
    } else if (fieldDef.expectedType === "DATE" && profile.inferredType !== "DATE") {
      score -= 40;
      signals.push(`Type mismatch: expected DATE, received ${profile.inferredType}`);
    }

    // 3. VALUE PATTERN & CARDINALITY SIGNALS
    if (fieldDef.role === "TRANSACTION_ID") {
      if (profile.uniquenessRatio >= 0.85) {
        score += 20;
        signals.push("High uniqueness ratio (>85%) characteristic of transaction IDs");
      }
      if (profile.isLikelyId) {
        score += 10;
        signals.push("Values follow structured alphanumeric code pattern");
      }
    } else if (fieldDef.role === "AMOUNT") {
      if (profile.isLikelyCurrency) {
        score += 15;
        signals.push("Values match positive monetary currency format");
      }
      if (tokens.some((t) => ["total", "gross", "net", "amount", "value", "amt", "val"].includes(t))) {
        score += 15;
      }
    } else if (fieldDef.role === "DATE") {
      if (profile.isLikelyDate) {
        score += 15;
        signals.push("Sample values verified as valid calendar dates");
      }
    } else if (fieldDef.role === "STATUS") {
      if (profile.isLikelyStatus) {
        score += 20;
        signals.push("Values match known invoice/payment lifecycle statuses");
      }
    } else if (fieldDef.role === "SUPPLIER") {
      if (tokens.some((t) => ["vendor", "supplier", "payee", "seller"].includes(t))) {
        score += 25;
        signals.push("Header explicitly indicates vendor/supplier counterparty");
      }
      if (profile.isLikelyCompanyName && fieldDef.key === "supplier_name") {
        score += 15;
        signals.push("Values resemble commercial enterprise names");
      }
    } else if (fieldDef.role === "BUYER") {
      if (tokens.some((t) => ["buyer", "customer", "client", "department", "dept", "purchaser"].includes(t))) {
        score += 25;
        signals.push("Header explicitly indicates customer or department counterparty");
      }
      if (profile.isLikelyCompanyName && fieldDef.key === "buyer_name") {
        score += 15;
        signals.push("Values resemble buyer/client/department names");
      }
    } else if (fieldDef.role === "SME") {
      if (tokens.some((t) => ["sme", "our", "internal", "my"].includes(t))) {
        score += 30;
        signals.push("Header explicitly denotes primary tenant organization");
      }
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    let reason = "Inferred from column headers and data characteristics.";
    if (finalScore >= 90) {
      reason = `Strong match: ${signals.slice(0, 2).join(", ")}.`;
    } else if (finalScore >= 70) {
      reason = `Good candidate: ${signals.slice(0, 2).join(", ")}.`;
    } else if (finalScore >= 50) {
      reason = `Possible match: ${signals[0] || "Partial match with canonical format"}.`;
    } else {
      reason = "Low confidence: values and header do not strongly indicate this business role.";
    }

    return { score: finalScore, signals, reason };
  }

  // --------------------------------------------------------------------------
  // INFER RELATIONSHIP DIRECTION & DATASET PROFILE
  // --------------------------------------------------------------------------
  static buildDatasetProfile(
    headers: string[],
    profiles: Record<string, ColumnSampleProfile>,
    rawRowCount: number
  ): DatasetProfile {
    const dateColumns: string[] = [];
    const amountColumns: string[] = [];
    const identifierColumns: string[] = [];
    const partyColumns: string[] = [];
    const statusColumns: string[] = [];

    for (const h of headers) {
      const p = profiles[h];
      if (!p) continue;
      if (p.isLikelyDate || p.inferredType === "DATE") dateColumns.push(h);
      if (p.inferredType === "NUMERIC" || p.isLikelyCurrency) amountColumns.push(h);
      if (p.isLikelyId || p.uniquenessRatio > 0.8) identifierColumns.push(h);
      if (p.isLikelyStatus) statusColumns.push(h);
      if (p.tokens.some((t) => ["vendor", "supplier", "customer", "buyer", "client", "dept", "department", "firm", "company", "payee", "seller"].includes(t))) {
        partyColumns.push(h);
      }
    }

    const warnings: string[] = [];
    if (dateColumns.length === 0) warnings.push("No date columns detected. Invoice dates are required for timeline evaluation.");
    if (amountColumns.length === 0) warnings.push("No financial amount columns detected.");

    // Detect relationship direction
    const hasSupplierHeader = headers.some((h) =>
      profiles[h]?.tokens.some((t) => ["vendor", "supplier", "seller", "payee"].includes(t))
    );
    const hasBuyerHeader = headers.some((h) =>
      profiles[h]?.tokens.some((t) => ["customer", "buyer", "client", "dept", "department"].includes(t))
    );
    const hasSmeHeader = headers.some((h) =>
      profiles[h]?.tokens.some((t) => ["sme", "our", "internal", "my"].includes(t))
    );

    let direction: DatasetProfile["detectedRelationshipDirection"] = "AMBIGUOUS";
    if (hasSupplierHeader && hasBuyerHeader && hasSmeHeader) {
      direction = "SUPPLIER_TO_SME_TO_BUYER";
    } else if (hasSupplierHeader && hasBuyerHeader) {
      direction = "SUPPLIER_TO_BUYER";
    } else if (hasSupplierHeader && (hasSmeHeader || !hasBuyerHeader)) {
      direction = "SUPPLIER_TO_SME";
    } else if (hasBuyerHeader) {
      direction = "SME_TO_BUYER";
    }

    return {
      totalRows: rawRowCount,
      totalColumns: headers.length,
      dateColumns,
      amountColumns,
      identifierColumns,
      partyColumns,
      statusColumns,
      candidateTransactionId: null,
      candidateBuyer: null,
      candidateSupplier: null,
      candidateInvoiceDate: null,
      candidateDueDate: null,
      candidatePaymentDate: null,
      detectedRelationshipDirection: direction,
      warnings,
    };
  }

  // --------------------------------------------------------------------------
  // PRIMARY INSPECT / MAPPING ENGINE EXECUTION
  // --------------------------------------------------------------------------
  static inspectAndMap(
    headers: string[],
    sampleRows: Record<string, any>[],
    userOverrides: Record<string, string> = {}
  ): UniversalMappingResult {
    // 1. Profile all columns
    const columnProfiles: Record<string, ColumnSampleProfile> = {};
    for (const h of headers) {
      const values = sampleRows.map((r) => r[h]);
      columnProfiles[h] = this.profileColumn(h, values);
    }

    // 2. Build dataset profile
    const datasetProfile = this.buildDatasetProfile(headers, columnProfiles, sampleRows.length);
    const direction = datasetProfile.detectedRelationshipDirection;

    const candidateMappings: CandidateMapping[] = [];
    const suggestedMapping: Record<string, string> = {};
    const assignedColumns = new Set<string>();

    // Process user overrides first (confidence = 100%)
    for (const [canonicalKey, sourceCol] of Object.entries(userOverrides)) {
      if (sourceCol && headers.includes(sourceCol)) {
        suggestedMapping[canonicalKey] = sourceCol;
        assignedColumns.add(sourceCol);
      }
    }

    // Fixed deterministic processing order to avoid race conditions
    const fieldOrder = [
      "transaction_id",
      "invoice_amount",
      "invoice_date",
      "supplier_id",
      "buyer_id",
      "sme_id",
      "supplier_name",
      "buyer_name",
      "payment_date",
      "due_date",
      "outstanding_amount",
      "payment_amount",
      "payment_status",
      "is_open",
      "currency",
      "credit_period",
      "purchase_order_id",
      "document_id",
      "document_type",
      "business_unit",
      "industry",
      "region",
    ];

    const fieldMap = new Map(this.CANONICAL_FIELDS.map((f) => [f.key, f]));
    const orderedFields = fieldOrder
      .map((k) => fieldMap.get(k))
      .filter((f): f is CanonicalFieldDef => Boolean(f));

    for (const field of orderedFields) {
      // If already specified by user override
      if (suggestedMapping[field.key]) {
        const sourceCol = suggestedMapping[field.key];
        candidateMappings.push({
          canonicalField: field.key,
          sourceColumn: sourceCol,
          confidence: 100,
          tier: "HIGH",
          reason: "Selected by user override.",
          signals: ["User override applied with maximum confidence"],
          needsReview: false,
          isRequired: false, // Calculated dynamically below
        });

        if (field.key === "transaction_id") datasetProfile.candidateTransactionId = sourceCol;
        if (field.key === "buyer_id" || field.key === "buyer_name") datasetProfile.candidateBuyer = sourceCol;
        if (field.key === "supplier_id" || field.key === "supplier_name") datasetProfile.candidateSupplier = sourceCol;
        if (field.key === "invoice_date") datasetProfile.candidateInvoiceDate = sourceCol;
        if (field.key === "due_date") datasetProfile.candidateDueDate = sourceCol;
        if (field.key === "payment_date") datasetProfile.candidatePaymentDate = sourceCol;
        continue;
      }

      // Find best candidate from unassigned columns
      let bestMatch: { header: string; score: number; signals: string[]; reason: string } | null = null;

      for (const h of headers) {
        if (assignedColumns.has(h)) continue;
        const profile = columnProfiles[h];
        if (!profile) continue;

        const candidateScore = this.scoreCandidate(field, profile, Object.values(columnProfiles));

        // Threshold check: Must have at least 50% confidence to even be considered
        if (candidateScore.score >= 50 && (!bestMatch || candidateScore.score > bestMatch.score)) {
          bestMatch = { header: h, ...candidateScore };
        }
      }

      // ASSIGNMENT RULES:
      // High / Medium confidence (>= 70%): Auto-map into suggested mapping
      // Low confidence (50-69%):
      //   - If core field: can suggest, but requires review
      //   - If optional: LEAVE UNMAPPED! (Fixes Check Number -> Outstanding Amount bug universally)
      if (bestMatch && bestMatch.score >= 70) {
        const tier: ConfidenceTier = bestMatch.score >= 90 ? "HIGH" : "MEDIUM";
        suggestedMapping[field.key] = bestMatch.header;
        assignedColumns.add(bestMatch.header);

        candidateMappings.push({
          canonicalField: field.key,
          sourceColumn: bestMatch.header,
          confidence: bestMatch.score,
          tier,
          reason: bestMatch.reason,
          signals: bestMatch.signals,
          needsReview: false,
          isRequired: false, // Calculated dynamically below
        });

        if (field.key === "transaction_id") datasetProfile.candidateTransactionId = bestMatch.header;
        if (field.key === "buyer_id" || field.key === "buyer_name") datasetProfile.candidateBuyer = bestMatch.header;
        if (field.key === "supplier_id" || field.key === "supplier_name") datasetProfile.candidateSupplier = bestMatch.header;
        if (field.key === "invoice_date") datasetProfile.candidateInvoiceDate = bestMatch.header;
        if (field.key === "due_date") datasetProfile.candidateDueDate = bestMatch.header;
        if (field.key === "payment_date") datasetProfile.candidatePaymentDate = bestMatch.header;
      } else if (bestMatch && bestMatch.score >= 50 && (field.key === "transaction_id" || field.key === "invoice_amount" || field.key === "invoice_date")) {
        // Core field with low confidence: suggest but FLAG FOR USER REVIEW
        suggestedMapping[field.key] = bestMatch.header;
        assignedColumns.add(bestMatch.header);

        candidateMappings.push({
          canonicalField: field.key,
          sourceColumn: bestMatch.header,
          confidence: bestMatch.score,
          tier: "LOW",
          reason: `${bestMatch.reason} Required field requires user review before validation.`,
          signals: bestMatch.signals,
          needsReview: true,
          isRequired: true,
        });

        if (field.key === "transaction_id") datasetProfile.candidateTransactionId = bestMatch.header;
        if (field.key === "invoice_date") datasetProfile.candidateInvoiceDate = bestMatch.header;
      } else {
        // Field remains UNMAPPED
        const reason =
          field.role === "BUYER"
            ? "Buyer information was not reliably detected in this source."
            : field.role === "SUPPLIER"
            ? "Supplier information was not reliably detected in this source."
            : field.role === "SME"
            ? "SME ID left unmapped; no explicit primary company identifier detected."
            : field.key === "due_date"
            ? "Due date not detected in this file; not fabricated."
            : field.key === "outstanding_amount"
            ? "No reliable outstanding/open amount detected in this file."
            : bestMatch && bestMatch.score < 70
            ? `Optional column match confidence is low (${bestMatch.score}%); left unmapped to avoid false inferences.`
            : `No matching column found for ${field.label}.`;

        candidateMappings.push({
          canonicalField: field.key,
          sourceColumn: null,
          confidence: bestMatch ? bestMatch.score : 0,
          tier: bestMatch ? "LOW" : "UNCERTAIN",
          reason,
          signals: bestMatch ? bestMatch.signals : ["No compatible column detected"],
          needsReview: false, // Calculated dynamically below
          isRequired: false,
        });
      }
    }

    // ------------------------------------------------------------------------
    // DYNAMIC REQUIRED SCHEMA & VALIDATION STATUS DETERMINATION
    // ------------------------------------------------------------------------
    const hasTxn = Boolean(suggestedMapping["transaction_id"]);
    const hasAmt = Boolean(suggestedMapping["invoice_amount"]);
    const hasDate = Boolean(suggestedMapping["invoice_date"]);
    const hasSupplierId = Boolean(suggestedMapping["supplier_id"]);
    const hasSupplierName = Boolean(suggestedMapping["supplier_name"]);
    const hasSupplier = hasSupplierId || hasSupplierName;
    const hasBuyerId = Boolean(suggestedMapping["buyer_id"]);
    const hasBuyerName = Boolean(suggestedMapping["buyer_name"]);
    const hasBuyer = hasBuyerId || hasBuyerName;
    const hasSme = Boolean(suggestedMapping["sme_id"]);

    let isSupplierRequired = false;
    let isBuyerRequired = false;
    let totalRequired = 4;

    if (direction === "SUPPLIER_TO_BUYER" || (hasSupplier && hasBuyer && !hasSme)) {
      totalRequired = 5;
      isSupplierRequired = true;
      isBuyerRequired = true;
    } else if (direction === "SUPPLIER_TO_SME" || (hasSupplier && (hasSme || !hasBuyer))) {
      totalRequired = 4;
      isSupplierRequired = true;
      isBuyerRequired = false;
    } else if (direction === "SME_TO_BUYER" || hasBuyer) {
      totalRequired = 4;
      isSupplierRequired = false;
      isBuyerRequired = true;
    } else {
      totalRequired = 4;
      isSupplierRequired = hasSupplier;
      isBuyerRequired = !hasSupplier;
    }

    // Update isRequired and needsReview on each candidate based on dynamic relationship
    for (const c of candidateMappings) {
      if (c.canonicalField === "transaction_id" || c.canonicalField === "invoice_amount" || c.canonicalField === "invoice_date") {
        c.isRequired = true;
        c.needsReview = !c.sourceColumn || c.confidence < 70;
      } else if (c.canonicalField === "supplier_id") {
        if (isSupplierRequired) {
          c.isRequired = hasSupplierId || !hasSupplierName;
          c.needsReview = c.isRequired && (!c.sourceColumn || c.confidence < 70);
        } else {
          c.isRequired = false;
          c.needsReview = false;
        }
      } else if (c.canonicalField === "supplier_name") {
        if (isSupplierRequired && !hasSupplierId && hasSupplierName) {
          c.isRequired = true;
          c.needsReview = false;
        } else {
          c.isRequired = false;
          c.needsReview = false;
        }
      } else if (c.canonicalField === "buyer_id") {
        if (isBuyerRequired) {
          c.isRequired = hasBuyerId || !hasBuyerName;
          c.needsReview = c.isRequired && (!c.sourceColumn || c.confidence < 70);
        } else {
          c.isRequired = false;
          c.needsReview = false;
        }
      } else if (c.canonicalField === "buyer_name") {
        if (isBuyerRequired && !hasBuyerId && hasBuyerName) {
          c.isRequired = true;
          c.needsReview = false;
        } else {
          c.isRequired = false;
          c.needsReview = false;
        }
      } else {
        c.isRequired = false;
        c.needsReview = false;
      }
    }

    // Calculate mapped required count (strictly bounded by totalRequired)
    let mappedRequired = 0;
    if (hasTxn) mappedRequired++;
    if (isSupplierRequired && hasSupplier) mappedRequired++;
    if (isBuyerRequired && (hasBuyer || hasSme)) mappedRequired++;
    if (hasAmt) mappedRequired++;
    if (hasDate) mappedRequired++;

    mappedRequired = Math.min(mappedRequired, totalRequired);

    const requiredNeedsReview = candidateMappings.filter((c) => c.isRequired && (c.needsReview || !c.sourceColumn)).length;
    const isReadyForValidation = mappedRequired >= totalRequired && requiredNeedsReview === 0;

    const optionalCandidates = candidateMappings.filter((c) => !c.isRequired);
    const mappedOptional = optionalCandidates.filter((c) => Boolean(c.sourceColumn)).length;

    return {
      headers,
      columnProfiles,
      datasetProfile,
      suggestedMapping,
      mappingCandidates: candidateMappings,
      requiredFieldsStatus: {
        totalRequired,
        mappedRequired,
        needsReviewCount: requiredNeedsReview,
        isReadyForValidation,
      },
      optionalFieldsStatus: {
        totalOptional: optionalCandidates.length,
        mappedOptional,
      },
    };
  }
}
