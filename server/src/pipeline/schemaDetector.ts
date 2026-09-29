export type InferredType = "NUMERIC" | "DATE" | "STRING" | "BOOLEAN" | "EMPTY";

export interface ColumnProfile {
  header: string;
  inferredType: InferredType;
  missingCount: number;
  missingRate: number; // 0 to 1
  sampleValues: string[];
  suggestedConcept?: string;
  confidence?: number;
}

export interface SchemaDetectionResult {
  headers: string[];
  profiles: ColumnProfile[];
  suggestedMapping: Record<string, string>;
  rawRowCount: number;
}

export class SchemaDetector {
  static readonly CANONICAL_CONCEPTS: Record<string, { aliases: string[]; type: InferredType }> = {
    transaction_id: {
      aliases: [
        "transaction_id", "transactionid", "id", "invoice_no", "invoiceno", "inv_no", "inv_num",
        "invoice_number", "bill_no", "bill_number", "doc_no", "tx_id", "reference_id", "ref_no"
      ],
      type: "STRING",
    },
    sme_id: {
      aliases: [
        "sme_id", "smeid", "sme_code", "smecode", "seller_id", "vendor_id", "vendor_code",
        "supplier_code", "issuer_id", "from_firm", "origin_firm"
      ],
      type: "STRING",
    },
    buyer_id: {
      aliases: [
        "buyer_id", "buyerid", "buyer_code", "buyercode", "customer_id", "customer_code",
        "client_id", "client_code", "debtor_id", "target_firm", "dest_firm", "recipient_id"
      ],
      type: "STRING",
    },
    supplier_id: {
      aliases: [
        "supplier_id", "supplierid", "supplier_code", "tier2_supplier", "sub_supplier",
        "upstream_supplier", "vendor"
      ],
      type: "STRING",
    },
    invoice_amount: {
      aliases: [
        "invoice_amount", "invoiceamount", "amount", "total_amount", "gross_amount",
        "inv_amt", "inv_val", "bill_amount", "value", "price"
      ],
      type: "NUMERIC",
    },
    invoice_date: {
      aliases: [
        "invoice_date", "invoicedate", "inv_date", "inv_dt", "bill_date", "issue_date",
        "txn_date", "tx_date", "date"
      ],
      type: "DATE",
    },
    due_date: {
      aliases: [
        "due_date", "duedate", "due_dt", "payment_due", "maturity_date", "expiry_date",
        "expected_date"
      ],
      type: "DATE",
    },
    payment_date: {
      aliases: [
        "payment_date", "paymentdate", "paid_date", "paid_dt", "settlement_date",
        "cleared_date", "actual_payment_date"
      ],
      type: "DATE",
    },
    credit_period: {
      aliases: [
        "credit_period", "creditperiod", "credit_period_days", "credit_days", "creditdays",
        "terms_days", "payment_terms", "credit_terms"
      ],
      type: "NUMERIC",
    },
    outstanding_amount: {
      aliases: [
        "outstanding_amount", "outstandingamount", "outstanding", "balance_due", "balance",
        "due_amount", "unpaid_amount", "remaining_amount", "open_balance"
      ],
      type: "NUMERIC",
    },
    payment_status: {
      aliases: [
        "payment_status", "paymentstatus", "status", "invoice_status", "inv_status",
        "state", "settlement_status"
      ],
      type: "STRING",
    },
  };

  static detectType(values: string[]): InferredType {
    const nonNull = values.filter((v) => v !== undefined && v !== null && v.trim() !== "");
    if (nonNull.length === 0) return "EMPTY";

    let numCount = 0;
    let dateCount = 0;
    let boolCount = 0;

    for (const val of nonNull) {
      const trimmed = val.trim();
      if (/^(true|false|yes|no)$/i.test(trimmed)) {
        boolCount++;
        continue;
      }

      // Check numeric (allowing currency signs and commas)
      const cleanNum = trimmed.replace(/[$₹€£,\s]/g, "");
      if (cleanNum !== "" && !isNaN(Number(cleanNum))) {
        numCount++;
        continue;
      }

      // Check date formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, ISO
      if (this.isValidDateString(trimmed)) {
        dateCount++;
        continue;
      }
    }

    const total = nonNull.length;
    if (dateCount / total >= 0.7) return "DATE";
    if (numCount / total >= 0.7) return "NUMERIC";
    if (boolCount / total >= 0.8) return "BOOLEAN";
    return "STRING";
  }

  static isValidDateString(str: string): boolean {
    if (!str || typeof str !== "string") return false;
    const clean = str.trim();
    if (!/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(clean) && !/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(clean)) {
      return false;
    }
    const d = new Date(clean);
    return !isNaN(d.getTime());
  }

  static inspect(headers: string[], rows: Record<string, any>[]): SchemaDetectionResult {
    const rawRowCount = rows.length;
    const profiles: ColumnProfile[] = [];
    const suggestedMapping: Record<string, string> = {};
    const usedHeaders = new Set<string>();

    for (const header of headers) {
      const values = rows.map((r) => (r[header] !== undefined && r[header] !== null ? String(r[header]) : ""));
      const missingCount = values.filter((v) => v.trim() === "").length;
      const missingRate = rawRowCount > 0 ? missingCount / rawRowCount : 1;
      const sampleValues = values.filter((v) => v.trim() !== "").slice(0, 5);
      const inferredType = this.detectType(values);

      profiles.push({
        header,
        inferredType,
        missingCount,
        missingRate: Math.round(missingRate * 100) / 100,
        sampleValues,
      });
    }

    // Match canonical concepts to best header
    for (const [concept, config] of Object.entries(this.CANONICAL_CONCEPTS)) {
      let bestMatch: { header: string; score: number } | null = null;

      for (const profile of profiles) {
        if (usedHeaders.has(profile.header)) continue;
        const normHeader = profile.header.toLowerCase().replace(/[^a-z0-9]/g, "");

        let score = 0;
        for (const alias of config.aliases) {
          const normAlias = alias.replace(/[^a-z0-9]/g, "");
          if (normHeader === normAlias) {
            score = 1.0;
            break;
          } else if (normHeader.includes(normAlias) || normAlias.includes(normHeader)) {
            const currentScore = 0.7 + (Math.min(normHeader.length, normAlias.length) / Math.max(normHeader.length, normAlias.length)) * 0.2;
            if (currentScore > score) score = currentScore;
          }
        }

        // Type match boost
        if (score > 0 && profile.inferredType === config.type) {
          score = Math.min(1.0, score + 0.1);
        }

        if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { header: profile.header, score };
        }
      }

      if (bestMatch) {
        suggestedMapping[concept] = bestMatch.header;
        usedHeaders.add(bestMatch.header);

        const profile = profiles.find((p) => p.header === bestMatch!.header);
        if (profile) {
          profile.suggestedConcept = concept;
          profile.confidence = Math.round(bestMatch.score * 100);
        }
      }
    }

    return {
      headers,
      profiles,
      suggestedMapping,
      rawRowCount,
    };
  }
}
