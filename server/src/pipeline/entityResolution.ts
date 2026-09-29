/**
 * NEXUS-CFR Conservative Entity Resolution Engine
 * Phase 5: Real Authorized Data Acquisition & First Evidence Run
 *
 * Implements deterministic, conservative entity resolution.
 * Auto-links only high-confidence deterministic matches (e.g. verified GSTIN/PAN/exact ERP customer ID).
 * Never merges entities merely due to superficial name similarity.
 * Maintains an auditable entity resolution lineage.
 */

export interface EntityResolutionMapping {
  mappingId: string;
  organizationId: string;
  sourceEntityIdentifier: string;
  sourceEntityType: "BUYER" | "SUPPLIER";
  canonicalEntityId: string;
  canonicalEntityName: string;
  resolutionMethod: "EXACT_TAX_IDENTIFIER" | "DETERMINISTIC_ERP_MASTER_ID" | "MANUAL_COMPLIANCE_LINKAGE" | "AMBIGUOUS_UNRESOLVED";
  confidenceScore: number; // 0.0 - 1.0 (1.0 = exact deterministic)
  verifiedIdentifiers: {
    gstin?: string;
    pan?: string;
    cin?: string;
    erpMasterId?: string;
  };
  resolvedAt: string;
  reviewedBy?: string;
  notes?: string;
}

export interface EntityResolutionResult {
  totalEntitiesProcessed: number;
  deterministicAutoLinkedCount: number;
  ambiguousUnresolvedCount: number;
  mappings: EntityResolutionMapping[];
}

export class EntityResolutionEngine {
  // Scoped by organizationId -> Map<sourceIdentifier, EntityResolutionMapping>
  private static tenantEntityStore: Map<string, Map<string, EntityResolutionMapping>> = new Map();

  /**
   * Cleans and normalizes tax identifiers (GSTIN, PAN).
   */
  public static normalizeTaxId(id?: string): string | undefined {
    if (!id) return undefined;
    const clean = id.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Standard Indian GSTIN is 15 alphanumeric characters
    if (clean.length === 15) return clean;
    // Standard Indian PAN is 10 alphanumeric characters
    if (clean.length === 10) return clean;
    return clean.length >= 8 ? clean : undefined;
  }

  /**
   * Resolves an enterprise entity conservatively.
   */
  public static resolveEntity(
    organizationId: string,
    params: {
      rawIdentifier: string;
      rawName: string;
      entityType: "BUYER" | "SUPPLIER";
      gstin?: string;
      pan?: string;
      erpMasterId?: string;
      reviewerEmail?: string;
    }
  ): EntityResolutionMapping {
    const rawId = params.rawIdentifier.trim();
    const rawName = params.rawName.trim();
    const normalizedGstin = this.normalizeTaxId(params.gstin);
    const normalizedPan = this.normalizeTaxId(params.pan);

    const now = new Date().toISOString();
    const mappingId = `ENT-${organizationId}-${params.entityType}-${Date.now().toString(36)}`;

    // Rule 1: High-Confidence Exact Tax Identifier Match
    if (normalizedGstin) {
      const mapping: EntityResolutionMapping = {
        mappingId,
        organizationId,
        sourceEntityIdentifier: rawId,
        sourceEntityType: params.entityType,
        canonicalEntityId: `CAN-GSTIN-${normalizedGstin}`,
        canonicalEntityName: rawName || `Verified Firm (${normalizedGstin})`,
        resolutionMethod: "EXACT_TAX_IDENTIFIER",
        confidenceScore: 1.0,
        verifiedIdentifiers: { gstin: normalizedGstin, pan: normalizedPan, erpMasterId: params.erpMasterId },
        resolvedAt: now,
      };
      this.storeMapping(organizationId, mapping);
      return mapping;
    }

    // Rule 2: High-Confidence Deterministic ERP Master ID Match
    if (params.erpMasterId && params.erpMasterId.trim().length >= 4) {
      const cleanMasterId = params.erpMasterId.trim().toUpperCase();
      const mapping: EntityResolutionMapping = {
        mappingId,
        organizationId,
        sourceEntityIdentifier: rawId,
        sourceEntityType: params.entityType,
        canonicalEntityId: `CAN-ERP-${cleanMasterId}`,
        canonicalEntityName: rawName || `Customer Master (${cleanMasterId})`,
        resolutionMethod: "DETERMINISTIC_ERP_MASTER_ID",
        confidenceScore: 0.95,
        verifiedIdentifiers: { erpMasterId: cleanMasterId, pan: normalizedPan },
        resolvedAt: now,
      };
      this.storeMapping(organizationId, mapping);
      return mapping;
    }

    // Rule 3: Conservative Identity Isolation - Superficial name similarities must NOT auto-merge!
    // Example: "Tata Motors Limited" vs "Tata Steel Limited" or "Reliance Retail" vs "Reliance Jio"
    // Each receives its own isolated canonical entity ID rather than risky auto-merging.
    const cleanId = rawId.toUpperCase().replace(/\s+/g, "_");
    const mapping: EntityResolutionMapping = {
      mappingId,
      organizationId,
      sourceEntityIdentifier: rawId,
      sourceEntityType: params.entityType,
      canonicalEntityId: `CAN-ISO-${params.entityType}-${cleanId}`,
      canonicalEntityName: rawName || rawId,
      resolutionMethod: "AMBIGUOUS_UNRESOLVED",
      confidenceScore: 0.5,
      verifiedIdentifiers: {},
      resolvedAt: now,
      notes: "No verified tax ID or ERP master key provided. Isolated as discrete entity to prevent entity contamination.",
    };

    this.storeMapping(organizationId, mapping);
    return mapping;
  }

  /**
   * Resolves a batch of raw invoice records for unique buyers and suppliers.
   */
  public static resolveBatchEntities(
    organizationId: string,
    records: Array<{ buyer_id: string; sme_id: string; raw_payload?: Record<string, any> }>
  ): EntityResolutionResult {
    const mappings: EntityResolutionMapping[] = [];

    const uniqueBuyers = Array.from(new Set(records.map((r) => r.buyer_id))).filter(Boolean);
    const uniqueSuppliers = Array.from(new Set(records.map((r) => r.sme_id))).filter(Boolean);

    for (const buyer of uniqueBuyers) {
      const m = this.resolveEntity(organizationId, {
        rawIdentifier: buyer,
        rawName: buyer,
        entityType: "BUYER",
      });
      mappings.push(m);
    }

    for (const supplier of uniqueSuppliers) {
      const m = this.resolveEntity(organizationId, {
        rawIdentifier: supplier,
        rawName: supplier,
        entityType: "SUPPLIER",
      });
      mappings.push(m);
    }

    const deterministicAutoLinkedCount = mappings.filter((m) => m.confidenceScore >= 0.9).length;
    const ambiguousUnresolvedCount = mappings.filter((m) => m.confidenceScore < 0.9).length;

    return {
      totalEntitiesProcessed: mappings.length,
      deterministicAutoLinkedCount,
      ambiguousUnresolvedCount,
      mappings,
    };
  }

  /**
   * Cross-Source Entity Safety Guard:
   * Asserts that external survey microdata or aggregate benchmarks are NEVER
   * joined to transaction invoices without an explicit, documented key.
   */
  public static validateCrossSourceLinkage(
    invoiceEntityId: string,
    externalSourceKey?: string
  ): { isLinkageAuthorized: boolean; violationReason?: string } {
    if (!externalSourceKey) {
      return {
        isLinkageAuthorized: false,
        violationReason: `Cross-source join rejected: No documented linking key between invoice entity '${invoiceEntityId}' and external reference dataset.`,
      };
    }

    // Must be a verified 15-character GSTIN or verified corporate CIN
    const isVerifiedKey = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(externalSourceKey);
    if (!isVerifiedKey) {
      return {
        isLinkageAuthorized: false,
        violationReason: `Cross-source join rejected: Key '${externalSourceKey}' is not an authorized, verified statutory identifier.`,
      };
    }

    return { isLinkageAuthorized: true };
  }

  private static storeMapping(organizationId: string, mapping: EntityResolutionMapping): void {
    if (!this.tenantEntityStore.has(organizationId)) {
      this.tenantEntityStore.set(organizationId, new Map());
    }
    this.tenantEntityStore.get(organizationId)!.set(mapping.sourceEntityIdentifier, mapping);
  }

  public static clearStore(): void {
    this.tenantEntityStore.clear();
  }
}
