/**
 * NEXUS-CFR Canonical Transformer & Normalization Engine
 * Phase 5: Real Authorized Data Acquisition & First Evidence Run
 *
 * Enforces strict, auditable RAW -> CANONICAL transformations
 * using the provider mapping registry. Records transformation errors,
 * unmapped fields, and rejects invalid records without silent financial inferences.
 */

import {
  CanonicalInvoiceContract,
  CanonicalERPEventContract,
  PROVIDER_MAPPING_REGISTRY,
} from "./canonicalContract";

export interface RecordTransformationResult {
  sourceRecordIndex: number;
  sourceRecordId: string;
  canonicalTransactionId?: string;
  mappingVersion: string;
  mappingResult: "SUCCESS" | "WARNING" | "FAILED";
  canonicalRecord?: CanonicalInvoiceContract | CanonicalERPEventContract;
  unmappedFields: string[];
  transformationWarnings: string[];
  transformationErrors: string[];
}

export interface CanonicalNormalizationBatchResult {
  totalRawRecords: number;
  successfulCount: number;
  warningCount: number;
  failedCount: number;
  canonicalRecords: CanonicalInvoiceContract[];
  results: RecordTransformationResult[];
}

export interface ERPEventNormalizationBatchResult {
  totalRawRecords: number;
  successfulCount: number;
  warningCount: number;
  failedCount: number;
  canonicalEvents: CanonicalERPEventContract[];
  results: RecordTransformationResult[];
}

export class CanonicalTransformer {
  /**
   * Normalizes an array of raw enterprise records into CanonicalInvoiceContracts.
   */
  public static normalizeRawBatch(
    rawRecords: Record<string, any>[],
    providerId: string,
    organizationId: string
  ): CanonicalNormalizationBatchResult {
    const providerDef = PROVIDER_MAPPING_REGISTRY[providerId] || PROVIDER_MAPPING_REGISTRY.CONTROLLED_FILE_EXPORT;
    const mappingVersion = providerDef.version;

    const results: RecordTransformationResult[] = [];
    const canonicalRecords: CanonicalInvoiceContract[] = [];

    rawRecords.forEach((raw, idx) => {
      const warnings: string[] = [];
      const errors: string[] = [];

      // Identify mapped targets
      const mappedTargets: Partial<CanonicalInvoiceContract> = {};
      const mappedRawKeys = new Set<string>();

      for (const fieldSpec of providerDef.rawKeyFields) {
        let val = raw[fieldSpec.rawField];

        // Support nested keys like CustomerRef.value
        if (val === undefined && fieldSpec.rawField.includes(".")) {
          const parts = fieldSpec.rawField.split(".");
          let curr: any = raw;
          for (const p of parts) {
            if (curr && typeof curr === "object") {
              curr = curr[p];
            } else {
              curr = undefined;
              break;
            }
          }
          val = curr;
        }

        if (val !== undefined && val !== null && val !== "") {
          mappedRawKeys.add(fieldSpec.rawField);
          (mappedTargets as any)[fieldSpec.canonicalTarget] = val;
        }
      }

      // Check fallback standard keys if provider-specific keys weren't present
      const standardKeys: Array<{ key: keyof CanonicalInvoiceContract; fallbacks: string[] }> = [
        { key: "transaction_id", fallbacks: ["transaction_id", "invoice_number", "id", "voucher_no"] },
        { key: "sme_id", fallbacks: ["sme_id", "supplier_id", "vendor_id"] },
        { key: "buyer_id", fallbacks: ["buyer_id", "customer_id", "debtor_id"] },
        { key: "invoice_amount", fallbacks: ["invoice_amount", "amount", "total", "net_amount"] },
        { key: "invoice_date", fallbacks: ["invoice_date", "date", "bill_date", "txn_date"] },
        { key: "due_date", fallbacks: ["due_date", "payment_due_date", "maturity_date"] },
        { key: "payment_date", fallbacks: ["payment_date", "clearing_date", "settlement_date"] },
        { key: "outstanding_amount", fallbacks: ["outstanding_amount", "balance", "open_balance"] },
        { key: "payment_status", fallbacks: ["payment_status", "status"] },
      ];

      for (const std of standardKeys) {
        if ((mappedTargets as any)[std.key] === undefined) {
          for (const fb of std.fallbacks) {
            if (raw[fb] !== undefined && raw[fb] !== null && raw[fb] !== "") {
              (mappedTargets as any)[std.key] = raw[fb];
              mappedRawKeys.add(fb);
              break;
            }
          }
        }
      }

      // Unmapped fields audit
      const unmappedFields = Object.keys(raw).filter((k) => !mappedRawKeys.has(k));

      // Extract raw record identifier
      const sourceRecordId = String(
        mappedTargets.transaction_id || raw.id || raw.VOUCHERNUMBER || raw.invoice_id || `RAW-${idx + 1}`
      );

      // Mandatory Field Validation
      if (!mappedTargets.transaction_id) {
        errors.push("Missing mandatory field: transaction_id cannot be resolved from raw record.");
      }
      if (!mappedTargets.sme_id) {
        errors.push("Missing mandatory field: sme_id / supplier cannot be resolved from raw record.");
      }
      if (!mappedTargets.buyer_id) {
        errors.push("Missing mandatory field: buyer_id cannot be resolved from raw record.");
      }

      // Amount Validation
      const parsedAmount = Number(mappedTargets.invoice_amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        errors.push(`Invalid invoice_amount: '${mappedTargets.invoice_amount}'. Amount must be a positive numeric value.`);
      }

      // Date Parsing & Validation
      let invDateIso = "";
      if (mappedTargets.invoice_date) {
        const d = new Date(mappedTargets.invoice_date);
        if (isNaN(d.getTime())) {
          errors.push(`Invalid invoice_date: '${mappedTargets.invoice_date}'. Expected valid date format.`);
        } else {
          invDateIso = d.toISOString().split("T")[0];
        }
      } else {
        errors.push("Missing mandatory field: invoice_date is required.");
      }

      let dueDateIso = "";
      if (mappedTargets.due_date) {
        const d = new Date(mappedTargets.due_date);
        if (isNaN(d.getTime())) {
          errors.push(`Invalid due_date: '${mappedTargets.due_date}'. Expected valid date format.`);
        } else {
          dueDateIso = d.toISOString().split("T")[0];
        }
      } else {
        errors.push("Missing mandatory field: due_date is required.");
      }

      // Payment Date handling (optional)
      let payDateIso: string | null = null;
      if (mappedTargets.payment_date) {
        const d = new Date(mappedTargets.payment_date);
        if (!isNaN(d.getTime())) {
          payDateIso = d.toISOString().split("T")[0];
        } else {
          warnings.push(`Unparsable payment_date '${mappedTargets.payment_date}' ignored.`);
        }
      }

      // Credit period calculation
      let creditPeriod = 30;
      if (invDateIso && dueDateIso) {
        const diffMs = new Date(dueDateIso).getTime() - new Date(invDateIso).getTime();
        creditPeriod = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }

      // Outstanding amount
      let outstanding = Number(mappedTargets.outstanding_amount);
      if (isNaN(outstanding)) {
        outstanding = payDateIso ? 0 : parsedAmount;
      }

      // Status determination
      let status: CanonicalInvoiceContract["payment_status"] = "PENDING";
      if (payDateIso) {
        status = "PAID";
      } else if (dueDateIso && new Date(dueDateIso).getTime() < Date.now()) {
        status = "OVERDUE";
      }

      if (errors.length > 0) {
        results.push({
          sourceRecordIndex: idx,
          sourceRecordId,
          mappingVersion,
          mappingResult: "FAILED",
          unmappedFields,
          transformationWarnings: warnings,
          transformationErrors: errors,
        });
        return;
      }

      const canonical: CanonicalInvoiceContract = {
        transaction_id: String(mappedTargets.transaction_id),
        sme_id: String(mappedTargets.sme_id),
        buyer_id: String(mappedTargets.buyer_id),
        supplier_id: mappedTargets.supplier_id ? String(mappedTargets.supplier_id) : undefined,
        invoice_amount: parsedAmount,
        invoice_date: invDateIso,
        due_date: dueDateIso,
        payment_date: payDateIso,
        credit_period: creditPeriod,
        outstanding_amount: outstanding,
        payment_status: status,
        currency: String(mappedTargets.currency || "INR").toUpperCase(),
        source_system: providerId,
        source_record_id: sourceRecordId,
        extracted_at: new Date().toISOString(),
        raw_payload: raw,
      };

      const resultStatus = warnings.length > 0 ? "WARNING" : "SUCCESS";
      results.push({
        sourceRecordIndex: idx,
        sourceRecordId,
        canonicalTransactionId: canonical.transaction_id,
        mappingVersion,
        mappingResult: resultStatus,
        canonicalRecord: canonical,
        unmappedFields,
        transformationWarnings: warnings,
        transformationErrors: [],
      });

      canonicalRecords.push(canonical);
    });

    const successfulCount = results.filter((r) => r.mappingResult === "SUCCESS").length;
    const warningCount = results.filter((r) => r.mappingResult === "WARNING").length;
    const failedCount = results.filter((r) => r.mappingResult === "FAILED").length;

    return {
      totalRawRecords: rawRecords.length,
      successfulCount,
      warningCount,
      failedCount,
      canonicalRecords,
      results,
    };
  }

  /**
   * Normalizes an array of raw ERP event log records (e.g. BPI Challenge 2019)
   * into CanonicalERPEventContracts with strict zero-fabrication rules.
   */
  public static normalizeERPEventLogBatch(
    rawEvents: Record<string, any>[],
    providerId = "BPI_CHALLENGE_2019"
  ): ERPEventNormalizationBatchResult {
    const providerDef = PROVIDER_MAPPING_REGISTRY[providerId] || PROVIDER_MAPPING_REGISTRY.BPI_CHALLENGE_2019;
    const mappingVersion = providerDef.version;

    const results: RecordTransformationResult[] = [];
    const canonicalEvents: CanonicalERPEventContract[] = [];

    rawEvents.forEach((raw, idx) => {
      const warnings: string[] = [];
      const errors: string[] = [];

      const caseId = String(
        raw["case:concept:name"] || raw.case_id || raw.caseId || raw.CaseId || raw.CASE_ID || ""
      );
      const vendorId = String(
        raw["case:Vendor"] || raw.vendor_id || raw.vendorId || raw.Vendor || raw.VENDOR_ID || ""
      );
      const companyId = String(
        raw["case:Company"] || raw.company_id || raw.companyId || raw.Company || raw.COMPANY_ID || "COMP-DEFAULT"
      );
      const eventType = String(
        raw["concept:name"] ||
        raw.event_type ||
        raw.eventType ||
        raw.activity ||
        raw.ACTIVITY ||
        (raw.events && raw.events[0]?.activity) ||
        "Process Lifecycle"
      );

      if (!caseId) {
        errors.push("Missing mandatory ERP event field: case_id cannot be resolved.");
      }
      if (!vendorId) {
        errors.push("Missing mandatory ERP event field: vendor_id cannot be resolved.");
      }
      if (!eventType) {
        errors.push("Missing mandatory ERP event field: event_type cannot be resolved.");
      }

      // Event timestamp parsing
      let timestampIso = "";
      const rawTimestamp =
        raw["time:timestamp"] ||
        raw.event_timestamp ||
        raw.timestamp ||
        raw.Timestamp ||
        raw.created_at ||
        raw.invoice_event;
      if (rawTimestamp) {
        const d = new Date(rawTimestamp);
        if (!isNaN(d.getTime())) {
          timestampIso = d.toISOString();
        } else {
          errors.push(`Invalid event timestamp: '${rawTimestamp}'.`);
        }
      } else {
        errors.push("Missing mandatory ERP event field: event_timestamp is required.");
      }

      const grossValue = raw["case:Gross order value"] ?? raw.monetary_value ?? raw.amount ?? null;
      const parsedGrossValue = grossValue !== null && grossValue !== undefined && !isNaN(Number(grossValue))
        ? Number(grossValue)
        : null;

      const purchaseDoc = raw["case:Purchasing Document"] ? String(raw["case:Purchasing Document"]) : (raw.purchase_document_id || null);
      const purchaseItem = raw["case:Item"] ? String(raw["case:Item"]) : (raw.purchase_item_id || null);
      const itemType = raw["case:Item Type"] ? String(raw["case:Item Type"]) : (raw.item_type || null);
      const spendCategory = raw["case:Spend area text"] ? String(raw["case:Spend area text"]) : (raw.spend_category || null);

      const invoiceEvent = raw.invoice_event ?? (eventType.toLowerCase().includes("invoice") ? timestampIso : null);
      const clearingEvent = raw.clearing_event ?? (eventType.toLowerCase().includes("clear") ? timestampIso : null);
      const goodsReceiptEvent = raw.goods_receipt_event ?? (eventType.toLowerCase().includes("goods receipt") ? timestampIso : null);

      const processDuration = raw.process_duration !== undefined && raw.process_duration !== null && !isNaN(Number(raw.process_duration))
        ? Number(raw.process_duration)
        : null;

      const hasPaymentBlock = Boolean(
        raw.has_payment_block ||
        eventType.toLowerCase().includes("block") ||
        eventType.toLowerCase().includes("hold")
      );
      const hasRework = Boolean(
        raw.has_rework ||
        eventType.toLowerCase().includes("change") ||
        eventType.toLowerCase().includes("cancel") ||
        eventType.toLowerCase().includes("reopen")
      );
      const hasException = Boolean(
        raw.has_exception ||
        hasPaymentBlock ||
        hasRework ||
        eventType.toLowerCase().includes("reject")
      );

      const sourceRecordId = String(raw.id || raw.event_id || `${caseId}-${idx + 1}`);

      if (errors.length > 0) {
        results.push({
          sourceRecordIndex: idx,
          sourceRecordId,
          mappingVersion,
          mappingResult: "FAILED",
          unmappedFields: [],
          transformationWarnings: warnings,
          transformationErrors: errors,
        });
        return;
      }

      const canonical: CanonicalERPEventContract = {
        case_id: caseId,
        purchase_document_id: purchaseDoc,
        purchase_item_id: purchaseItem,
        vendor_id: vendorId,
        company_id: companyId,
        event_type: eventType,
        event_timestamp: timestampIso,
        monetary_value: parsedGrossValue,
        item_type: itemType,
        spend_category: spendCategory,
        invoice_event: invoiceEvent,
        clearing_event: clearingEvent,
        goods_receipt_event: goodsReceiptEvent,
        process_duration: processDuration,
        has_payment_block: hasPaymentBlock,
        has_rework: hasRework,
        has_exception: hasException,
        source_system: providerId,
        source_record_id: sourceRecordId,
        extracted_at: new Date().toISOString(),
        raw_payload: raw,
      };

      const resultStatus = warnings.length > 0 ? "WARNING" : "SUCCESS";
      results.push({
        sourceRecordIndex: idx,
        sourceRecordId,
        canonicalTransactionId: canonical.case_id,
        mappingVersion,
        mappingResult: resultStatus,
        canonicalRecord: canonical,
        unmappedFields: [],
        transformationWarnings: warnings,
        transformationErrors: [],
      });

      canonicalEvents.push(canonical);
    });

    const successfulCount = results.filter((r) => r.mappingResult === "SUCCESS").length;
    const warningCount = results.filter((r) => r.mappingResult === "WARNING").length;
    const failedCount = results.filter((r) => r.mappingResult === "FAILED").length;

    return {
      totalRawRecords: rawEvents.length,
      successfulCount,
      warningCount,
      failedCount,
      canonicalEvents,
      results,
    };
  }
}

export function normalizeERPEventLogBatch(
  rawEvents: Record<string, any>[],
  organizationId = "DEFAULT_ORG"
): CanonicalERPEventContract[] {
  const result = CanonicalTransformer.normalizeERPEventLogBatch(rawEvents);
  return result.canonicalEvents.map((e) => ({
    ...e,
    organization_id: organizationId,
  }));
}

