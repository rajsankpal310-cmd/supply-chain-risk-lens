/**
 * NEXUS-CFR Feature Engineering Engine
 * Phase 4: Production ML Foundation
 *
 * Extracts leakage-safe pre-t0 features for invoices.
 * Guarantees that historical aggregates use ONLY transactions settled or observed
 * strictly BEFORE the prediction anchor date (t0).
 */

import crypto from "crypto";
import { AntiLeakageAuditor, FEATURE_SPECIFICATIONS } from "./featureEligibility";

export interface RawInvoiceRecord {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  supplierId: string;
  buyerId: string;
  invoiceDate: Date;
  dueDate: Date;
  invoiceAmount: number;
  paymentDate?: Date | null;
  paymentDelayDays?: number | null;
  status: string;
}

export interface ExtractedFeatureSnapshot {
  invoiceId: string;
  organizationId: string;
  predictionTimestamp: string;
  featureVersion: string;
  features: Record<string, number>;
  featureVector: number[];
  featureNames: string[];
  snapshotHash: string;
}

export class FeatureEngine {
  public static readonly FEATURE_VERSION = "2.0-LEAKAGE_SAFE";

  public static readonly ACTIVE_NUMERIC_FEATURES = [
    "invoiceAmount",
    "creditPeriodDays",
    "invoiceDayOfWeek",
    "invoiceMonthOfYear",
    "buyerHistoricalDelayMean30d",
    "buyerHistoricalDelayMean90d",
    "buyerOverdueRatioPreT0",
    "buyerSettledCountPreT0",
    "supplierTrailingVolume90d",
    "supplierOverdueReceivableExposurePreT0",
    "amountRelativeToBuyerAvg",
    "networkBuyerInDegreePreT0",
    "networkSupplierConcentrationPreT0",
  ];

  /**
   * Validates that the active feature set is completely leakage-free.
   */
  public static validateActiveFeatures(): void {
    const audit = AntiLeakageAuditor.auditFeatureCandidateList(this.ACTIVE_NUMERIC_FEATURES);
    if (!audit.isLeakageFree) {
      throw new Error(`Fatal ML Leakage: Active feature set contains forbidden features: ${audit.forbiddenFeaturesDetected.join(", ")}`);
    }
  }

  /**
   * Computes pre-t0 features for a single invoice against the historical transaction corpus.
   *
   * @param targetInvoice The invoice for which we are predicting at issuance t0 (targetInvoice.invoiceDate)
   * @param historicalTransactions All transactions known in the organization
   */
  public static extractFeaturesForInvoice(
    targetInvoice: RawInvoiceRecord,
    historicalTransactions: RawInvoiceRecord[]
  ): ExtractedFeatureSnapshot {
    this.validateActiveFeatures();

    const t0 = new Date(targetInvoice.invoiceDate).getTime();
    const t0Date = new Date(targetInvoice.invoiceDate);

    // 1. Basic Invoice Safe Features (Known at t0)
    const invoiceAmount = Number(targetInvoice.invoiceAmount) || 0;
    const dueDateEpoch = new Date(targetInvoice.dueDate).getTime();
    const creditPeriodDays = Math.max(0, Math.round((dueDateEpoch - t0) / (1000 * 60 * 60 * 24)));
    const invoiceDayOfWeek = t0Date.getDay();
    const invoiceMonthOfYear = t0Date.getMonth() + 1;

    // 2. Strict Pre-t0 Historical Filter: Only transactions completed/recorded strictly before t0
    const preT0Completed = historicalTransactions.filter((tx) => {
      if (tx.id === targetInvoice.id) return false;
      if (!tx.paymentDate) return false;
      const payTime = new Date(tx.paymentDate).getTime();
      return payTime < t0;
    });

    // 3. Buyer Historical Behavior (Pre-t0)
    const buyerPreT0 = preT0Completed.filter((tx) => tx.buyerId === targetInvoice.buyerId);
    const buyerSettledCountPreT0 = buyerPreT0.length;

    // Trailing 30 days pre-t0
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const buyer30d = buyerPreT0.filter((tx) => (t0 - new Date(tx.paymentDate!).getTime()) <= thirtyDaysMs);
    const buyerHistoricalDelayMean30d = buyer30d.length > 0
      ? buyer30d.reduce((acc, tx) => acc + (tx.paymentDelayDays || 0), 0) / buyer30d.length
      : 0;

    // Trailing 90 days pre-t0
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const buyer90d = buyerPreT0.filter((tx) => (t0 - new Date(tx.paymentDate!).getTime()) <= ninetyDaysMs);
    const buyerHistoricalDelayMean90d = buyer90d.length > 0
      ? buyer90d.reduce((acc, tx) => acc + (tx.paymentDelayDays || 0), 0) / buyer90d.length
      : 0;

    // Buyer Overdue Ratio pre-t0
    const delayedCountPreT0 = buyerPreT0.filter((tx) => (tx.paymentDelayDays || 0) > 0).length;
    const buyerOverdueRatioPreT0 = buyerSettledCountPreT0 > 0 ? delayedCountPreT0 / buyerSettledCountPreT0 : 0;

    // Buyer average ticket size pre-t0
    const buyerAvgTicket = buyerSettledCountPreT0 > 0
      ? buyerPreT0.reduce((acc, tx) => acc + (Number(tx.invoiceAmount) || 0), 0) / buyerSettledCountPreT0
      : invoiceAmount;
    const amountRelativeToBuyerAvg = buyerAvgTicket > 0 ? invoiceAmount / buyerAvgTicket : 1.0;

    // 4. Supplier Historical Behavior (Pre-t0)
    const supplierPreT0 = preT0Completed.filter((tx) => tx.supplierId === targetInvoice.supplierId);
    const supplier90d = supplierPreT0.filter((tx) => (t0 - new Date(tx.invoiceDate).getTime()) <= ninetyDaysMs);
    const supplierTrailingVolume90d = supplier90d.reduce((acc, tx) => acc + (Number(tx.invoiceAmount) || 0), 0);

    // Open overdue receivables for supplier as of t0
    const supplierOpenOverdueAsOfT0 = historicalTransactions.filter((tx) => {
      if (tx.id === targetInvoice.id) return false;
      if (tx.supplierId !== targetInvoice.supplierId) return false;
      const txIssue = new Date(tx.invoiceDate).getTime();
      const txDue = new Date(tx.dueDate).getTime();
      if (txIssue >= t0) return false; // Not yet issued at t0
      if (txDue >= t0) return false; // Not yet overdue at t0
      // Overdue at t0 if unpaid at t0 or paid after t0
      if (!tx.paymentDate) return true;
      return new Date(tx.paymentDate).getTime() > t0;
    });
    const supplierOverdueReceivableExposurePreT0 = supplierOpenOverdueAsOfT0.reduce(
      (acc, tx) => acc + (Number(tx.invoiceAmount) || 0),
      0
    );

    // 5. Network Topology Features (Pre-t0)
    // Unique suppliers serving this buyer pre-t0
    const uniqueSuppliersForBuyer = new Set(buyerPreT0.map((tx) => tx.supplierId));
    const networkBuyerInDegreePreT0 = uniqueSuppliersForBuyer.size;

    // Supplier concentration (Herfindahl-Hirschman index across buyers pre-t0)
    let networkSupplierConcentrationPreT0 = 0;
    if (supplierPreT0.length > 0) {
      const buyerVolumeMap: Record<string, number> = {};
      let totalSupplierVol = 0;
      for (const tx of supplierPreT0) {
        const amt = Number(tx.invoiceAmount) || 0;
        buyerVolumeMap[tx.buyerId] = (buyerVolumeMap[tx.buyerId] || 0) + amt;
        totalSupplierVol += amt;
      }
      if (totalSupplierVol > 0) {
        let hhi = 0;
        for (const bId of Object.keys(buyerVolumeMap)) {
          const share = buyerVolumeMap[bId] / totalSupplierVol;
          hhi += share * share;
        }
        networkSupplierConcentrationPreT0 = hhi;
      }
    }

    // Assemble features dictionary
    const features: Record<string, number> = {
      invoiceAmount,
      creditPeriodDays,
      invoiceDayOfWeek,
      invoiceMonthOfYear,
      buyerHistoricalDelayMean30d: parseFloat(buyerHistoricalDelayMean30d.toFixed(2)),
      buyerHistoricalDelayMean90d: parseFloat(buyerHistoricalDelayMean90d.toFixed(2)),
      buyerOverdueRatioPreT0: parseFloat(buyerOverdueRatioPreT0.toFixed(4)),
      buyerSettledCountPreT0,
      supplierTrailingVolume90d,
      supplierOverdueReceivableExposurePreT0,
      amountRelativeToBuyerAvg: parseFloat(amountRelativeToBuyerAvg.toFixed(4)),
      networkBuyerInDegreePreT0,
      networkSupplierConcentrationPreT0: parseFloat(networkSupplierConcentrationPreT0.toFixed(4)),
    };

    const featureVector = this.ACTIVE_NUMERIC_FEATURES.map((fn) => features[fn] ?? 0);

    // Generate SHA-256 snapshot hash for auditability
    const hashInput = JSON.stringify({
      invoiceId: targetInvoice.id,
      t0: targetInvoice.invoiceDate,
      version: this.FEATURE_VERSION,
      featureVector,
    });
    const snapshotHash = crypto.createHash("sha256").update(hashInput).digest("hex");

    return {
      invoiceId: targetInvoice.id,
      organizationId: targetInvoice.organizationId,
      predictionTimestamp: t0Date.toISOString(),
      featureVersion: this.FEATURE_VERSION,
      features,
      featureVector,
      featureNames: [...this.ACTIVE_NUMERIC_FEATURES],
      snapshotHash,
    };
  }

  /**
   * Batch extracts features for multiple invoices chronologically.
   */
  public static extractBatch(
    invoices: RawInvoiceRecord[],
    allCorpus: RawInvoiceRecord[]
  ): ExtractedFeatureSnapshot[] {
    return invoices.map((inv) => this.extractFeaturesForInvoice(inv, allCorpus));
  }
}
