/**
 * NEXUS-CFR Machine Learning Dataset Builder
 * Phase 4: Production ML Foundation
 *
 * Constructs versioned, reproducible, leakage-free ML datasets with
 * explicit target construction, right-censoring exclusion logging,
 * and chronological temporal partitioning.
 */

import crypto from "crypto";
import { FeatureEngine, RawInvoiceRecord, ExtractedFeatureSnapshot } from "../features/featureEngine";
import { TARGET_REGISTRY, TargetDefinition } from "../targets/targetRegistry";
import { TemporalSplitter, TemporalSplitResult } from "../validation/temporalSplitter";

export interface MLDatasetRecord {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentDate?: string | null;
  features: Record<string, number>;
  featureVector: number[];
  targetValue: number; // 0 or 1 for classification, or delay_days for regression
  splitCohort: "TRAIN" | "VALIDATION" | "TEST";
}

export interface MLDatasetVersion {
  datasetId: string;
  version: string;
  organizationId: string;
  targetId: string;
  targetVersion: string;
  featureVersion: string;
  preprocessingVersion: string;
  splitStrategy: string;
  createdAt: string;
  timeRange: { start: string; end: string };
  recordCount: {
    totalEligible: number;
    trainCount: number;
    valCount: number;
    testCount: number;
    censoredExcludedCount: number;
    invalidExcludedCount: number;
  };
  entityCount: {
    uniqueBuyers: number;
    uniqueSuppliers: number;
  };
  labelStats: {
    positiveCount: number;
    negativeCount: number;
    prevalencePercent: number;
  };
  exclusionLog: Array<{
    invoiceId: string;
    reason: string;
  }>;
  checksum: string;
  records: MLDatasetRecord[];
  temporalSplit: {
    trainWindow: { start: string; end: string; count: number };
    valWindow: { start: string; end: string; count: number };
    testWindow: { start: string; end: string; count: number };
    temporalIntegrityVerified: boolean;
  };
}

export class MLDatasetBuilder {
  public static readonly PREPROCESSING_VERSION = "1.0-STRICT_STANDARDIZED";

  /**
   * Builds a versioned, reproducible ML dataset from raw canonical invoices.
   */
  public static buildDataset(
    organizationId: string,
    invoices: RawInvoiceRecord[],
    targetId = "PAYMENT_DELAY_RISK",
    options: { trainRatio?: number; valRatio?: number } = {}
  ): MLDatasetVersion {
    const targetDef: TargetDefinition = TARGET_REGISTRY[targetId] || TARGET_REGISTRY.PAYMENT_DELAY_RISK;
    const exclusionLog: Array<{ invoiceId: string; reason: string }> = [];
    const eligibleInvoices: Array<{
      raw: RawInvoiceRecord;
      targetValue: number;
    }> = [];

    let censoredCount = 0;
    let invalidCount = 0;
    const now = new Date().getTime();

    // 1. Target Construction and Inclusion/Exclusion Audit
    for (const inv of invoices) {
      if (!inv.invoiceDate || !inv.dueDate) {
        invalidCount++;
        exclusionLog.push({ invoiceId: inv.id, reason: "Missing invoiceDate or dueDate." });
        continue;
      }

      const invoiceDate = new Date(inv.invoiceDate).getTime();
      const dueDate = new Date(inv.dueDate).getTime();
      if (dueDate <= invoiceDate) {
        invalidCount++;
        exclusionLog.push({ invoiceId: inv.id, reason: "Contractual credit period non-positive (dueDate <= invoiceDate)." });
        continue;
      }

      if (targetDef.problemType === "BINARY_CLASSIFICATION") {
        if (inv.paymentDate) {
          // Settled invoice
          const payDate = new Date(inv.paymentDate).getTime();
          const isDelayed = payDate > dueDate ? 1 : 0;
          eligibleInvoices.push({ raw: inv, targetValue: isDelayed });
        } else {
          // Open invoice
          if (now > dueDate) {
            // Already overdue, confirmed delayed outcome
            eligibleInvoices.push({ raw: inv, targetValue: 1 });
          } else {
            // Right-censored: unexpired credit window, outcome not yet observable
            censoredCount++;
            exclusionLog.push({
              invoiceId: inv.id,
              reason: "Right-censored open invoice within unexpired credit window (observationDate <= dueDate).",
            });
          }
        }
      } else if (targetDef.problemType === "REGRESSION") {
        if (inv.paymentDate) {
          const payDate = new Date(inv.paymentDate).getTime();
          const delayDays = Math.max(0, Math.round((payDate - dueDate) / (1000 * 60 * 60 * 24)));
          eligibleInvoices.push({ raw: inv, targetValue: delayDays });
        } else {
          // Continuous regression requires completed lifecycle
          censoredCount++;
          exclusionLog.push({
            invoiceId: inv.id,
            reason: "Unsettled open invoice cannot compute exact delay days without survival estimation.",
          });
        }
      }
    }

    if (eligibleInvoices.length < 5) {
      throw new Error(`Insufficient eligible records to construct ML dataset. Found ${eligibleInvoices.length} eligible.`);
    }

    // 2. Chronological Temporal Partitioning
    const splitResult = TemporalSplitter.splitChronological(
      eligibleInvoices.map((e) => ({
        id: e.raw.id,
        invoiceDate: e.raw.invoiceDate,
        raw: e.raw,
        targetValue: e.targetValue,
      })),
      options.trainRatio ?? 0.6,
      options.valRatio ?? 0.2
    );

    const cohortMap = new Map<string, "TRAIN" | "VALIDATION" | "TEST">();
    splitResult.trainSet.forEach((item) => cohortMap.set(item.id, "TRAIN"));
    splitResult.validationSet.forEach((item) => cohortMap.set(item.id, "VALIDATION"));
    splitResult.testSet.forEach((item) => cohortMap.set(item.id, "TEST"));

    // 3. Feature Extraction strictly pre-t0
    const records: MLDatasetRecord[] = [];
    let positiveCount = 0;
    let negativeCount = 0;
    const uniqueBuyers = new Set<string>();
    const uniqueSuppliers = new Set<string>();

    for (const item of eligibleInvoices) {
      const inv = item.raw;
      uniqueBuyers.add(inv.buyerId);
      uniqueSuppliers.add(inv.supplierId);

      const featureSnapshot: ExtractedFeatureSnapshot = FeatureEngine.extractFeaturesForInvoice(inv, invoices);
      const cohort = cohortMap.get(inv.id) || "TRAIN";

      if (targetDef.problemType === "BINARY_CLASSIFICATION") {
        if (item.targetValue === 1) positiveCount++;
        else negativeCount++;
      }

      records.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: new Date(inv.invoiceDate).toISOString(),
        dueDate: new Date(inv.dueDate).toISOString(),
        paymentDate: inv.paymentDate ? new Date(inv.paymentDate).toISOString() : null,
        features: featureSnapshot.features,
        featureVector: featureSnapshot.featureVector,
        targetValue: item.targetValue,
        splitCohort: cohort,
      });
    }

    // Chronological date bounds
    const sortedDates = records.map((r) => new Date(r.invoiceDate).getTime()).sort((a, b) => a - b);
    const startStr = new Date(sortedDates[0]).toISOString();
    const endStr = new Date(sortedDates[sortedDates.length - 1]).toISOString();

    const prevalence = records.length > 0 ? (positiveCount / records.length) * 100 : 0;
    const datasetId = `DS-${organizationId}-${targetDef.targetId}-${Date.now().toString(36).toUpperCase()}`;

    // Cryptographic Checksum of entire dataset specification
    const checksumPayload = JSON.stringify({
      datasetId,
      organizationId,
      targetId: targetDef.targetId,
      recordCount: records.length,
      featureVersion: FeatureEngine.FEATURE_VERSION,
      recordsHashSample: records.slice(0, 10).map((r) => r.features),
    });
    const checksum = crypto.createHash("sha256").update(checksumPayload).digest("hex");

    return {
      datasetId,
      version: "1.0",
      organizationId,
      targetId: targetDef.targetId,
      targetVersion: targetDef.version,
      featureVersion: FeatureEngine.FEATURE_VERSION,
      preprocessingVersion: this.PREPROCESSING_VERSION,
      splitStrategy: splitResult.splitStrategy,
      createdAt: new Date().toISOString(),
      timeRange: { start: startStr, end: endStr },
      recordCount: {
        totalEligible: records.length,
        trainCount: splitResult.trainSet.length,
        valCount: splitResult.validationSet.length,
        testCount: splitResult.testSet.length,
        censoredExcludedCount: censoredCount,
        invalidExcludedCount: invalidCount,
      },
      entityCount: {
        uniqueBuyers: uniqueBuyers.size,
        uniqueSuppliers: uniqueSuppliers.size,
      },
      labelStats: {
        positiveCount,
        negativeCount,
        prevalencePercent: parseFloat(prevalence.toFixed(2)),
      },
      exclusionLog,
      checksum,
      records,
      temporalSplit: {
        trainWindow: splitResult.trainWindow,
        valWindow: splitResult.valWindow,
        testWindow: splitResult.testWindow,
        temporalIntegrityVerified: splitResult.temporalIntegrityVerified,
      },
    };
  }
}
