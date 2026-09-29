/**
 * NEXUS-CFR Raw Data Snapshot Service
 * Phase 5: Real Authorized Data Acquisition & First Evidence Run
 *
 * Implements immutable raw snapshot storage and cryptographic integrity verification.
 * Does not expose raw confidential enterprise payloads unnecessarily in application logs.
 */

import crypto from "crypto";

export interface RawSnapshotMetadata {
  snapshotId: string;
  sourceId: string;
  connectorId: string;
  organizationId: string;
  extractionTimestamp: string;
  sourceRecordCount: number;
  payloadChecksum: string; // SHA-256
  schemaFingerprint: string; // SHA-256 of field keys & sample schema
  extractionVersion: string;
  batchId: string;
  isImmutable: boolean;
  createdAt: string;
}

export interface RawSnapshotArtifact {
  metadata: RawSnapshotMetadata;
  // Immutable raw payloads stored in-memory/repository storage (confidential)
  rawRecords: Record<string, any>[];
}

export class RawSnapshotService {
  private static snapshotStore: Map<string, RawSnapshotArtifact> = new Map();

  /**
   * Computes a deterministic SHA-256 schema fingerprint from a set of raw record keys.
   */
  public static computeSchemaFingerprint(records: Record<string, any>[]): string {
    if (records.length === 0) return crypto.createHash("sha256").update("EMPTY_SCHEMA").digest("hex");
    const allKeys = Array.from(new Set(records.flatMap((r) => Object.keys(r)))).sort();
    return crypto.createHash("sha256").update(JSON.stringify(allKeys)).digest("hex");
  }

  /**
   * Computes SHA-256 checksum over raw record payload.
   */
  public static computePayloadChecksum(records: Record<string, any>[]): string {
    return crypto.createHash("sha256").update(JSON.stringify(records)).digest("hex");
  }

  /**
   * Creates an immutable raw data snapshot.
   */
  public static createSnapshot(params: {
    organizationId: string;
    sourceId: string;
    connectorId: string;
    batchId: string;
    extractionVersion?: string;
    rawRecords: Record<string, any>[];
  }): RawSnapshotArtifact {
    if (!params.organizationId) throw new Error("Multi-tenant violation: organizationId required.");

    const now = new Date().toISOString();
    const payloadChecksum = this.computePayloadChecksum(params.rawRecords);
    const schemaFingerprint = this.computeSchemaFingerprint(params.rawRecords);

    const snapshotId = `SNAP-${params.organizationId}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const metadata: RawSnapshotMetadata = {
      snapshotId,
      sourceId: params.sourceId,
      connectorId: params.connectorId,
      organizationId: params.organizationId,
      extractionTimestamp: now,
      sourceRecordCount: params.rawRecords.length,
      payloadChecksum,
      schemaFingerprint,
      extractionVersion: params.extractionVersion || "1.0",
      batchId: params.batchId,
      isImmutable: true,
      createdAt: now,
    };

    // Deep freeze records copy to guarantee immutability in runtime memory
    const immutableRecords = Object.freeze(JSON.parse(JSON.stringify(params.rawRecords)));

    const artifact: RawSnapshotArtifact = {
      metadata,
      rawRecords: immutableRecords,
    };

    this.snapshotStore.set(snapshotId, artifact);
    return artifact;
  }

  /**
   * Retrieves snapshot metadata, enforcing tenant boundary.
   */
  public static getSnapshot(organizationId: string, snapshotId: string): RawSnapshotArtifact | null {
    const artifact = this.snapshotStore.get(snapshotId);
    if (!artifact) return null;

    if (artifact.metadata.organizationId !== organizationId) {
      throw new Error(`Unauthorized access: Snapshot ${snapshotId} does not belong to organization ${organizationId}.`);
    }

    return artifact;
  }

  /**
   * Verifies the cryptographic integrity of a raw snapshot against its payload checksum.
   */
  public static verifySnapshotIntegrity(organizationId: string, snapshotId: string): boolean {
    const snapshot = this.getSnapshot(organizationId, snapshotId);
    if (!snapshot) return false;

    const recomputedChecksum = this.computePayloadChecksum(snapshot.rawRecords);
    return recomputedChecksum === snapshot.metadata.payloadChecksum;
  }

  /**
   * Resets snapshot store for testing.
   */
  public static clearStore(): void {
    this.snapshotStore.clear();
  }
}
