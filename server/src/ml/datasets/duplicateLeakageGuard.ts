/**
 * NEXUS-CFR Duplicate & Near-Duplicate Leakage Guard
 * Phase 4.5: ML Production Hardening & Data-Arrival Readiness
 *
 * Detects:
 * 1. Exact transaction ID duplicates
 * 2. Repeated voucher numbers (buyerId + invoiceNumber)
 * 3. Near-duplicate combinations (buyerId + supplierId + amount + invoiceDate)
 * 4. Duplicate -> Dataset Split Contamination (same invoice appearing in train AND test).
 */

import crypto from "crypto";

export interface DuplicateVoucherInfo {
  voucherHash: string;
  count: number;
  sampleIds: string[];
  type: "EXACT_ID_DUPLICATE" | "REPEATED_VOUCHER_NUMBER" | "NEAR_DUPLICATE_SEMANTIC_TUPLE";
}

export interface DuplicateAuditResult {
  hasDuplicates: boolean;
  totalVouchersAudited: number;
  uniqueVouchersCount: number;
  duplicateVouchersCount: number;
  duplicateGroups: DuplicateVoucherInfo[];
  splitContaminationCount: number;
  splitContaminationViolations: string[];
  isContaminationFree: boolean;
}

export class DuplicateLeakageGuard {
  /**
   * Generates a deterministic semantic fingerprint for an invoice voucher.
   */
  public static computeSemanticTupleHash(
    supplierId: string,
    buyerId: string,
    invoiceAmount: number,
    invoiceDate: Date | string
  ): string {
    const dStr = new Date(invoiceDate).toISOString().split("T")[0];
    const raw = `${supplierId}|${buyerId}|${Math.round(invoiceAmount)}|${dStr}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Audits an invoice array for internal duplicates.
   */
  public static auditDuplicates(
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      supplierId: string;
      buyerId: string;
      invoiceAmount: number;
      invoiceDate: Date | string;
    }>
  ): DuplicateAuditResult {
    const idMap = new Map<string, string[]>();
    const voucherKeyMap = new Map<string, string[]>();
    const tupleMap = new Map<string, string[]>();

    for (const inv of invoices) {
      // 1. Exact ID
      const ids = idMap.get(inv.id) || [];
      ids.push(inv.id);
      idMap.set(inv.id, ids);

      // 2. Buyer + InvoiceNumber
      const vKey = `${inv.buyerId}::${inv.invoiceNumber}`;
      const vIds = voucherKeyMap.get(vKey) || [];
      vIds.push(inv.id);
      voucherKeyMap.set(vKey, vIds);

      // 3. Semantic tuple
      const tupleHash = this.computeSemanticTupleHash(
        inv.supplierId,
        inv.buyerId,
        inv.invoiceAmount,
        inv.invoiceDate
      );
      const tIds = tupleMap.get(tupleHash) || [];
      tIds.push(inv.id);
      tupleMap.set(tupleHash, tIds);
    }

    const duplicateGroups: DuplicateVoucherInfo[] = [];
    const duplicateIds = new Set<string>();

    // Collect duplicates
    for (const [id, list] of idMap.entries()) {
      if (list.length > 1) {
        duplicateGroups.push({
          voucherHash: id,
          count: list.length,
          sampleIds: list,
          type: "EXACT_ID_DUPLICATE",
        });
        list.slice(1).forEach((item) => duplicateIds.add(item));
      }
    }

    for (const [vKey, list] of voucherKeyMap.entries()) {
      if (list.length > 1 && !duplicateGroups.some((g) => g.voucherHash === vKey)) {
        duplicateGroups.push({
          voucherHash: vKey,
          count: list.length,
          sampleIds: list,
          type: "REPEATED_VOUCHER_NUMBER",
        });
        list.slice(1).forEach((item) => duplicateIds.add(item));
      }
    }

    for (const [tHash, list] of tupleMap.entries()) {
      if (list.length > 1 && !duplicateGroups.some((g) => g.voucherHash === tHash)) {
        duplicateGroups.push({
          voucherHash: tHash,
          count: list.length,
          sampleIds: list,
          type: "NEAR_DUPLICATE_SEMANTIC_TUPLE",
        });
        list.slice(1).forEach((item) => duplicateIds.add(item));
      }
    }

    const totalDups = duplicateIds.size;

    return {
      hasDuplicates: duplicateGroups.length > 0,
      totalVouchersAudited: invoices.length,
      uniqueVouchersCount: invoices.length - totalDups,
      duplicateVouchersCount: totalDups,
      duplicateGroups,
      splitContaminationCount: 0,
      splitContaminationViolations: [],
      isContaminationFree: true,
    };
  }

  /**
   * DUPLICATE -> DATASET SPLIT CONTAMINATION CHECK
   * Asserts that no invoice in the train set has an identical ID, voucher number,
   * or semantic tuple in the validation or test sets.
   */
  public static auditSplitContamination(
    trainInvoices: Array<{
      id: string;
      invoiceNumber: string;
      supplierId: string;
      buyerId: string;
      invoiceAmount: number;
      invoiceDate: Date | string;
    }>,
    testInvoices: Array<{
      id: string;
      invoiceNumber: string;
      supplierId: string;
      buyerId: string;
      invoiceAmount: number;
      invoiceDate: Date | string;
    }>
  ): { isContaminationFree: boolean; violations: string[] } {
    const trainIds = new Set(trainInvoices.map((i) => i.id));
    const trainVouchers = new Set(trainInvoices.map((i) => `${i.buyerId}::${i.invoiceNumber}`));
    const trainTuples = new Set(
      trainInvoices.map((i) => this.computeSemanticTupleHash(i.supplierId, i.buyerId, i.invoiceAmount, i.invoiceDate))
    );

    const violations: string[] = [];

    for (const testInv of testInvoices) {
      if (trainIds.has(testInv.id)) {
        violations.push(
          `FATAL SPLIT CONTAMINATION: Exact transaction ID '${testInv.id}' is present in both training and test cohorts.`
        );
      }
      const vKey = `${testInv.buyerId}::${testInv.invoiceNumber}`;
      if (trainVouchers.has(vKey)) {
        violations.push(
          `FATAL SPLIT CONTAMINATION: Voucher number '${testInv.invoiceNumber}' for buyer '${testInv.buyerId}' is present in both training and test cohorts.`
        );
      }
      const tHash = this.computeSemanticTupleHash(
        testInv.supplierId,
        testInv.buyerId,
        testInv.invoiceAmount,
        testInv.invoiceDate
      );
      if (trainTuples.has(tHash)) {
        violations.push(
          `FATAL SPLIT CONTAMINATION: Semantic tuple (supplier '${testInv.supplierId}', buyer '${testInv.buyerId}', amount ₹${testInv.invoiceAmount}) exists in both training and test cohorts.`
        );
      }
    }

    return {
      isContaminationFree: violations.length === 0,
      violations,
    };
  }
}
