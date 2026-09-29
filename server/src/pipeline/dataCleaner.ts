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

    if (["PAID", "SETTLED", "CLEARED", "CLOSED"].includes(str)) return "PAID";
    if (["PENDING", "UNPAID", "OPEN", "DUE"].includes(str)) return "PENDING";
    if (["DELAYED", "LATE"].includes(str)) return "DELAYED";
    if (["OVERDUE", "PAST_DUE", "DEFAULT_RISK"].includes(str)) return "OVERDUE";
    if (["PARTIALLY_PAID", "PARTIAL", "PART"].includes(str)) return "PARTIALLY_PAID";
    if (["CRITICAL"].includes(str)) return "CRITICAL";
    if (["DEFAULTED", "BAD_DEBT", "WRITTEN_OFF"].includes(str)) return "DEFAULTED";

    return str; // keep raw if custom
  }

  static cleanRow(raw: Record<string, any>, mapping: Record<string, string>): CleanedTransactionRow {
    const getRaw = (concept: string): any => {
      const col = mapping[concept];
      if (col && raw[col] !== undefined) return raw[col];
      // fallback to direct concept name on object
      if (raw[concept] !== undefined) return raw[concept];
      const camel = concept.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
      if (raw[camel] !== undefined) return raw[camel];
      if (concept === "transaction_id" && raw["id"] !== undefined) return raw["id"];
      if (concept === "transaction_id" && raw["transactionId"] !== undefined) return raw["transactionId"];
      return undefined;
    };

    const rawTxnId = getRaw("transaction_id");
    const rawSmeId = getRaw("sme_id");
    const rawBuyerId = getRaw("buyer_id");
    const rawSupplierId = getRaw("supplier_id");
    const rawAmount = getRaw("invoice_amount");
    const rawOutstanding = getRaw("outstanding_amount");
    const rawInvDate = getRaw("invoice_date");
    const rawDueDate = getRaw("due_date");
    const rawPayDate = getRaw("payment_date");
    const rawCredit = getRaw("credit_period");
    const rawStatus = getRaw("payment_status");

    return {
      transactionId: this.cleanString(rawTxnId) || undefined,
      smeId: this.cleanString(rawSmeId) || undefined,
      buyerId: this.cleanString(rawBuyerId) || undefined,
      supplierId: this.cleanString(rawSupplierId) || null,
      invoiceAmount: this.cleanNumber(rawAmount),
      outstandingAmount: this.cleanNumber(rawOutstanding),
      invoiceDate: this.cleanDate(rawInvDate) || undefined,
      dueDate: this.cleanDate(rawDueDate) || undefined,
      paymentDate: rawPayDate ? this.cleanDate(rawPayDate) : null,
      creditPeriodDays: this.cleanNumber(rawCredit),
      paymentStatus: this.normalizeStatus(rawStatus),
      raw,
    };
  }
}
