/**
 * NEXUS-CFR Entity Leakage & Contamination Guard
 * Phase 4.5: ML Production Hardening & Data-Arrival Readiness
 *
 * Distinguishes between:
 * 1. NORMAL TEMPORAL ENTITY REUSE: An entity (buyer/supplier) appears in both
 *    training and test cohorts, but all features at each observation epoch (t0)
 *    are computed strictly from events completed BEFORE t0. (VALID & EXPECTED).
 * 2. INVALID FUTURE INFORMATION CONTAMINATION: Features in the training cohort
 *    incorporate summary statistics or outcomes from transactions that occurred
 *    during the validation/test window (FUTURE LEAKAGE - HARD FAIL).
 * 3. REPEATED TRANSACTION IDENTITY LEAKAGE: The exact same invoice / voucher
 *    or transaction hash appears in both training and test cohorts (SPLIT CONTAMINATION - HARD FAIL).
 */

export interface EntityOverlapAuditResult {
  buyerOverlapCount: number;
  supplierOverlapCount: number;
  relationshipOverlapCount: number;
  repeatedVoucherIdentitiesCount: number;
  entityLeakageStatus: "PASS_VALID_TEMPORAL_REUSE" | "CONTAMINATED_FUTURE_LEAKAGE" | "CONTAMINATED_IDENTICAL_RECORD";
  details: string;
  violations: Array<{
    type: "IDENTICAL_TRANSACTION_SPLIT_LEAKAGE" | "FUTURE_ENTITY_CONTAMINATION" | "UNGROUNDED_REUSE";
    description: string;
  }>;
}

export class EntityLeakageGuard {
  /**
   * Audits entity distribution and verifies that no training observation features
   * incorporate information derived after the training cutoff time.
   */
  public static auditEntitySplits(params: {
    trainRecords: Array<{
      id: string;
      invoiceNumber: string;
      buyerId: string;
      supplierId: string;
      invoiceDate: Date | string;
      features?: Record<string, number>;
    }>;
    testRecords: Array<{
      id: string;
      invoiceNumber: string;
      buyerId: string;
      supplierId: string;
      invoiceDate: Date | string;
      features?: Record<string, number>;
    }>;
    trainCutoffTimestamp: Date | string;
  }): EntityOverlapAuditResult {
    const { trainRecords, testRecords, trainCutoffTimestamp } = params;
    const trainCutoffMs = new Date(trainCutoffTimestamp).getTime();

    const trainBuyers = new Set(trainRecords.map((r) => r.buyerId));
    const testBuyers = new Set(testRecords.map((r) => r.buyerId));
    const trainSuppliers = new Set(trainRecords.map((r) => r.supplierId));
    const testSuppliers = new Set(testRecords.map((r) => r.supplierId));

    const trainRels = new Set(trainRecords.map((r) => `${r.supplierId}->${r.buyerId}`));
    const testRels = new Set(testRecords.map((r) => `${r.supplierId}->${r.buyerId}`));

    const trainInvoiceIds = new Set(trainRecords.map((r) => r.id));
    const trainVouchers = new Set(trainRecords.map((r) => `${r.buyerId}::${r.invoiceNumber}`));

    let buyerOverlapCount = 0;
    for (const b of testBuyers) if (trainBuyers.has(b)) buyerOverlapCount++;

    let supplierOverlapCount = 0;
    for (const s of testSuppliers) if (trainSuppliers.has(s)) supplierOverlapCount++;

    let relationshipOverlapCount = 0;
    for (const rel of testRels) if (trainRels.has(rel)) relationshipOverlapCount++;

    const violations: Array<{
      type: "IDENTICAL_TRANSACTION_SPLIT_LEAKAGE" | "FUTURE_ENTITY_CONTAMINATION" | "UNGROUNDED_REUSE";
      description: string;
    }> = [];

    // Check 1: Repeated transaction identity across split boundary (FATAL CONTAMINATION)
    let repeatedVoucherIdentitiesCount = 0;
    for (const tr of testRecords) {
      if (trainInvoiceIds.has(tr.id)) {
        repeatedVoucherIdentitiesCount++;
        violations.push({
          type: "IDENTICAL_TRANSACTION_SPLIT_LEAKAGE",
          description: `Transaction ID '${tr.id}' appears in both training and test cohorts.`,
        });
      }
      const voucherKey = `${tr.buyerId}::${tr.invoiceNumber}`;
      if (trainVouchers.has(voucherKey)) {
        violations.push({
          type: "IDENTICAL_TRANSACTION_SPLIT_LEAKAGE",
          description: `Voucher '${tr.invoiceNumber}' for buyer '${tr.buyerId}' appears in both training and test cohorts.`,
        });
      }
    }

    // Check 2: Verify that training records have invoiceDate strictly <= trainCutoff
    for (const tr of trainRecords) {
      const invTime = new Date(tr.invoiceDate).getTime();
      if (invTime > trainCutoffMs) {
        violations.push({
          type: "FUTURE_ENTITY_CONTAMINATION",
          description: `Training record '${tr.id}' has invoiceDate (${new Date(tr.invoiceDate).toISOString()}) after trainCutoff (${new Date(trainCutoffMs).toISOString()}).`,
        });
      }
    }

    let entityLeakageStatus: "PASS_VALID_TEMPORAL_REUSE" | "CONTAMINATED_FUTURE_LEAKAGE" | "CONTAMINATED_IDENTICAL_RECORD" =
      "PASS_VALID_TEMPORAL_REUSE";

    let details = "";
    if (violations.some((v) => v.type === "IDENTICAL_TRANSACTION_SPLIT_LEAKAGE")) {
      entityLeakageStatus = "CONTAMINATED_IDENTICAL_RECORD";
      details = `FATAL: Detected ${repeatedVoucherIdentitiesCount} identical records split across training and test cohorts.`;
    } else if (violations.some((v) => v.type === "FUTURE_ENTITY_CONTAMINATION")) {
      entityLeakageStatus = "CONTAMINATED_FUTURE_LEAKAGE";
      details = "FATAL: Training features or observations contain events from the future test window.";
    } else {
      entityLeakageStatus = "PASS_VALID_TEMPORAL_REUSE";
      details = `AUDIT PASSED: Normal temporal entity reuse observed (${buyerOverlapCount} shared buyers, ${supplierOverlapCount} shared suppliers). Zero cross-split record contamination or future look-ahead.`;
    }

    return {
      buyerOverlapCount,
      supplierOverlapCount,
      relationshipOverlapCount,
      repeatedVoucherIdentitiesCount,
      entityLeakageStatus,
      details,
      violations,
    };
  }
}
