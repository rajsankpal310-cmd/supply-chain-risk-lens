export interface CleanedTransactionRow {
  transactionId?: string;
  smeId?: string;
  buyerId?: string;
  supplierId?: string | null;
  invoiceAmount?: number;
  outstandingAmount?: number;
  invoiceDate?: Date;
  dueDate?: Date;
  paymentDate?: Date | null;
  creditPeriodDays?: number;
  paymentStatus?: string;
  raw: Record<string, any>;
}

export class DataCleaner {
  static cleanString(val: any): string {
    if (val === undefined || val === null) return "";
    return String(val).trim();
  }

  static cleanNumber(val: any): number | undefined {
    if (val === undefined || val === null) return undefined;
    if (typeof val === "number") {
      return isNaN(val) ? undefined : val;
    }
    const str = String(val).trim();
    if (str === "") return undefined;

    // Remove currency signs, commas, spaces
    const sanitized = str.replace(/[$₹€£,\s]/g, "");
    const num = Number(sanitized);
    return isNaN(num) ? undefined : num;
  }

  static cleanDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }
    const str = String(val).trim();
    if (!str) return null;

    // ISO format or YYYY-MM-DD
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str)) {
      const d = new Date(str.replace(/\./g, "-").replace(/\//g, "-"));
      return isNaN(d.getTime()) ? null : d;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(.*)$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const d = new Date(Date.UTC(year, month, day));
      // Verify valid day in month (e.g. 31/02/2026 is invalid)
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
        return d;
      }
      return null;
    }

    // Direct Date parsing fallback
    const direct = new Date(str);
    return isNaN(direct.getTime()) ? null : direct;
  }

  static normalizeStatus(val: any): string | undefined {
    if (!val) return undefined;
    const str = String(val).trim().toUpperCase();

    // Strong payment-completion statuses (never include ambiguous ISSUED)
    if (["PAID", "SETTLED", "CLEARED", "CLOSED", "DISBURSED", "DISBURSEMENT", "COMPLETED", "PAID_IN_FULL"].includes(str)) return "PAID";

    // Open / document creation / unsettled states
    if (["PENDING", "UNPAID", "OPEN", "DUE", "SUBMITTED", "APPROVED", "IN_PROCESS", "PROCESSING", "ISSUED", "INVOICED", "BILLED"].includes(str)) return "PENDING";
    if (["DELAYED", "LATE"].includes(str)) return "DELAYED";
    if (["OVERDUE", "PAST_DUE", "DEFAULT_RISK"].includes(str)) return "OVERDUE";
    if (["PARTIALLY_PAID", "PARTIAL", "PART"].includes(str)) return "PARTIALLY_PAID";
    if (["CRITICAL"].includes(str)) return "CRITICAL";
    if (["DEFAULTED", "BAD_DEBT", "WRITTEN_OFF"].includes(str)) return "DEFAULTED";
    if (["CANCELLED", "CANCELED", "VOID", "VOIDED"].includes(str)) return "CANCELLED";

    // Substring / fuzzy keyword matches for common lifecycle terms
    if (str.includes("DISBURS") || str.includes("CLEAR") || str.includes("SETTLE") || str.includes("PAID")) return "PAID";
    if (str.includes("PEND") || str.includes("OPEN") || str.includes("UNPAID") || str.includes("ISSUE") || str.includes("INVOIC")) return "PENDING";
    if (str.includes("LATE") || str.includes("DELAY")) return "DELAYED";
    if (str.includes("OVERDUE")) return "OVERDUE";
    if (str.includes("CANCEL") || str.includes("VOID")) return "CANCELLED";

    return str; // keep raw if custom
  }

  static cleanRow(raw: Record<string, any>, mapping: Record<string, string>): CleanedTransactionRow {
    const getRaw = (concept: string): any => {
      // 1. canonicalField -> sourceColumn lookup
      const col = mapping[concept];
      if (col && raw[col] !== undefined) return raw[col];

      // 2. Inverse sourceColumn -> canonicalField lookup support
      for (const [srcCol, canonKey] of Object.entries(mapping)) {
        if (canonKey === concept && raw[srcCol] !== undefined) {
          return raw[srcCol];
        }
      }

      // 3. Fallback to direct concept name on object
      if (raw[concept] !== undefined) return raw[concept];
      const camel = concept.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
      if (raw[camel] !== undefined) return raw[camel];
      if (concept === "transaction_id" && raw["id"] !== undefined) return raw["id"];
      if (concept === "transaction_id" && raw["transactionId"] !== undefined) return raw["transactionId"];
      return undefined;
    };

    const rawTxnId = getRaw("transaction_id") || getRaw("document_id") || getRaw("voucher_no");
    const rawSmeId = getRaw("sme_id");
    const rawSupplierId = getRaw("supplier_id") || getRaw("supplier_name");
    const rawBuyerId = getRaw("buyer_id") || getRaw("buyer_name");
    const rawAmount = getRaw("invoice_amount");
    const rawOutstanding = getRaw("outstanding_amount");
    const rawInvDate = getRaw("invoice_date");
    const rawDueDate = getRaw("due_date");
    const rawPayDate = getRaw("payment_date");
    const rawCredit = getRaw("credit_period");
    const rawStatus = getRaw("payment_status");

    // Party-role resolution:
    // Case 1: Supplier -> Buyer (e.g. Public payment dataset)
    // Both supplier and buyer are external counterparties.
    // Case 2: SME -> Buyer (Sales ledger)
    // Buyer is counterparty; current tenant organization is the SME seller.
    // Case 3: Supplier -> SME (Purchase / AP ledger)
    // Supplier is counterparty; current tenant organization is the purchasing buyer.
    const effectiveSupplierId = rawSupplierId || undefined;
    const effectiveBuyerId = rawBuyerId || (rawSupplierId ? "CURRENT_ORGANIZATION_SME" : undefined);
    const effectiveSmeId = rawSmeId || (rawSupplierId ? rawSupplierId : (rawBuyerId ? "CURRENT_ORGANIZATION_SME" : undefined));

    return {
      transactionId: this.cleanString(rawTxnId) || undefined,
      smeId: this.cleanString(effectiveSmeId) || undefined,
      buyerId: this.cleanString(effectiveBuyerId) || undefined,
      supplierId: this.cleanString(effectiveSupplierId) || null,
      invoiceAmount: this.cleanNumber(rawAmount),
      outstandingAmount: this.cleanNumber(rawOutstanding),
      invoiceDate: this.cleanDate(rawInvDate) || undefined,
      dueDate: this.cleanDate(rawDueDate) || undefined,
      paymentDate: rawPayDate ? this.cleanDate(rawPayDate) : null,
      creditPeriodDays: this.cleanNumber(rawCredit),
      paymentStatus: this.normalizeStatus(rawStatus),
      raw: this.maskDirectIdentifiers(raw),
    };
  }

  /**
   * Anonymization and privacy protection: Masks direct personal identifiers
   * (emails, phone numbers, individual Aadhaar/PAN/SSN, tax IDs) to ensure
   * data minimization and prevent PII leakage into analytics or persistence.
   */
  static maskDirectIdentifiers(raw: Record<string, any>): Record<string, any> {
    if (!raw || typeof raw !== "object") return raw;
    const sanitized: Record<string, any> = { ...raw };
    const piiKeyPatterns = /(email|e_mail|mail|phone|mobile|cell|contact_no|aadhaar|pan|ssn|social_security|passport|personal_name|tax_id)/i;

    for (const [key, val] of Object.entries(sanitized)) {
      if (typeof val === "string" && val.trim()) {
        const str = val.trim();
        if (piiKeyPatterns.test(key)) {
          if (str.includes("@")) {
            const parts = str.split("@");
            sanitized[key] = `${parts[0].slice(0, 2)}***@${parts[1] || "***"}`;
          } else if (str.length > 4) {
            sanitized[key] = `******${str.slice(-4)}`;
          } else {
            sanitized[key] = `****`;
          }
        } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
          const parts = str.split("@");
          sanitized[key] = `${parts[0].slice(0, 2)}***@${parts[1]}`;
        }
      }
    }
    return sanitized;
  }
}
