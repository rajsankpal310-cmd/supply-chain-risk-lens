/**
 * NEXUS-CFR Machine Learning Lineage Tracker
 * Phase 4.5: ML Production Hardening & Data-Arrival Readiness
 *
 * Implements end-to-end cryptographic lineage:
 * 1. Feature Lineage: Feature Name -> Feature Snapshot -> Canonical Transactions -> Import Batch -> Source System.
 * 2. Prediction Lineage: Prediction ID -> Organization -> Model Version -> Dataset/Feature Version -> Feature Snapshot -> Explanation -> Audit Timestamp.
 */

import crypto from "crypto";

export interface FeatureSourceLineage {
  featureName: string;
  featureValue: number;
  featureVersion: string;
  generatedAt: string;
  predictionTimestamp: string;
  sourceTransactionIds: string[];
  sourceBatchIds: string[];
  sourceSystem: string;
  aggregationWindowDays?: number;
  lineageHash: string;
}

export interface PredictionLineageRecord {
  predictionId: string;
  organizationId: string;
  invoiceId: string;
  counterpartyBuyerId: string;
  counterpartySupplierId: string;
  modelId: string;
  modelVersion: string;
  modelChecksum: string;
  datasetId: string;
  datasetVersion: string;
  featureVersion: string;
  featureSnapshotHash: string;
  predictedProbability: number;
  riskBand: string;
  predictedAt: string;
  featuresUsed: Record<string, number>;
  featureLineages: FeatureSourceLineage[];
  lineageSignature: string;
}

export class LineageTracker {
  /**
   * Generates a cryptographic lineage record for a computed feature.
   */
  public static createFeatureLineage(params: {
    featureName: string;
    featureValue: number;
    featureVersion: string;
    predictionTimestamp: string;
    sourceTransactionIds: string[];
    sourceBatchIds: string[];
    sourceSystem: string;
    aggregationWindowDays?: number;
  }): FeatureSourceLineage {
    const raw = JSON.stringify({
      name: params.featureName,
      val: params.featureValue,
      ver: params.featureVersion,
      t0: params.predictionTimestamp,
      sources: params.sourceTransactionIds.slice(0, 10),
      batches: params.sourceBatchIds,
      sys: params.sourceSystem,
    });
    const lineageHash = crypto.createHash("sha256").update(raw).digest("hex");

    return {
      featureName: params.featureName,
      featureValue: params.featureValue,
      featureVersion: params.featureVersion,
      generatedAt: new Date().toISOString(),
      predictionTimestamp: params.predictionTimestamp,
      sourceTransactionIds: params.sourceTransactionIds,
      sourceBatchIds: params.sourceBatchIds,
      sourceSystem: params.sourceSystem,
      aggregationWindowDays: params.aggregationWindowDays,
      lineageHash,
    };
  }

  /**
   * Generates an end-to-end Prediction Lineage Record answering:
   * "Where did this model feature come from?" and "Why did the system produce this prediction?"
   */
  public static createPredictionLineage(params: {
    organizationId: string;
    invoiceId: string;
    buyerId: string;
    supplierId: string;
    modelId: string;
    modelVersion: string;
    modelChecksum: string;
    datasetId: string;
    datasetVersion: string;
    featureVersion: string;
    featureSnapshotHash: string;
    predictedProbability: number;
    riskBand: string;
    featuresUsed: Record<string, number>;
    featureLineages: FeatureSourceLineage[];
  }): PredictionLineageRecord {
    const predictionId = `PRED-LIN-${params.organizationId}-${Date.now().toString(36).toUpperCase()}`;
    const sigPayload = JSON.stringify({
      predictionId,
      org: params.organizationId,
      inv: params.invoiceId,
      model: params.modelId,
      modelVer: params.modelVersion,
      modelChk: params.modelChecksum,
      featVer: params.featureVersion,
      featHash: params.featureSnapshotHash,
      prob: params.predictedProbability,
      band: params.riskBand,
    });
    const lineageSignature = crypto.createHash("sha256").update(sigPayload).digest("hex");

    return {
      predictionId,
      organizationId: params.organizationId,
      invoiceId: params.invoiceId,
      counterpartyBuyerId: params.buyerId,
      counterpartySupplierId: params.supplierId,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      modelChecksum: params.modelChecksum,
      datasetId: params.datasetId,
      datasetVersion: params.datasetVersion,
      featureVersion: params.featureVersion,
      featureSnapshotHash: params.featureSnapshotHash,
      predictedProbability: params.predictedProbability,
      riskBand: params.riskBand,
      predictedAt: new Date().toISOString(),
      featuresUsed: params.featuresUsed,
      featureLineages: params.featureLineages,
      lineageSignature,
    };
  }
}
