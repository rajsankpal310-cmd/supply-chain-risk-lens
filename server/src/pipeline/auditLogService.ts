/**
 * NEXUS-CFR Enterprise Audit Log Service
 * Phase 6: Real Data Activation & Production Readiness
 *
 * Implements structured, append-only, tenant-isolated audit logging
 * for all compliance-critical lifecycle transitions.
 */

export type AuditEventType =
  | "SOURCE_REGISTERED"
  | "AUTHORIZATION_SUBMITTED"
  | "AUTHORIZATION_APPROVED"
  | "AUTHORIZATION_REJECTED"
  | "CONNECTION_TESTED"
  | "EXTRACTION_STARTED"
  | "EXTRACTION_COMPLETED"
  | "EXTRACTION_FAILED"
  | "SNAPSHOT_CREATED"
  | "RECONCILIATION_PASSED"
  | "RECONCILIATION_FAILED"
  | "QUARANTINE_CREATED"
  | "ENTITY_REVIEW_REQUIRED"
  | "DATASET_PROMOTED"
  | "DATASET_BLOCKED"
  | "ML_GATE_EVALUATED"
  | "MODEL_TRAINED"
  | "MODEL_REJECTED"
  | "MODEL_APPROVED"
  | "PRODUCTION_INFERENCE_BLOCKED"
  | "PRODUCTION_INFERENCE_INVOKED"
  | "FALLBACK_INFERENCE_DISPATCHED";

export interface GovernedAuditEvent {
  eventId: string;
  organizationId: string;
  eventType: AuditEventType;
  timestamp: string;
  actor: string;
  entityId?: string;
  entityType?: "SOURCE" | "BATCH" | "DATASET" | "MODEL" | "TRANSACTION" | "INFERENCE";
  status: "SUCCESS" | "WARNING" | "BLOCKED" | "FAILED";
  details: string;
  metadata?: Record<string, any>;
}

export class AuditLogService {
  // Scoped by organizationId -> GovernedAuditEvent[]
  private static eventLog: Map<string, GovernedAuditEvent[]> = new Map();

  /**
   * Records a structured audit event with tenant scoping.
   */
  public static logEvent(params: {
    organizationId: string;
    eventType: AuditEventType;
    actor: string;
    status: GovernedAuditEvent["status"];
    details: string;
    entityId?: string;
    entityType?: GovernedAuditEvent["entityType"];
    metadata?: Record<string, any>;
  }): GovernedAuditEvent {
    if (!params.organizationId) {
      throw new Error("Audit violation: organizationId is strictly required.");
    }

    const event: GovernedAuditEvent = {
      eventId: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      organizationId: params.organizationId,
      eventType: params.eventType,
      timestamp: new Date().toISOString(),
      actor: params.actor || "system",
      entityId: params.entityId,
      entityType: params.entityType,
      status: params.status,
      details: params.details,
      metadata: params.metadata || {},
    };

    if (!this.eventLog.has(params.organizationId)) {
      this.eventLog.set(params.organizationId, []);
    }

    this.eventLog.get(params.organizationId)!.push(event);
    return event;
  }

  /**
   * Retrieves events for a specific tenant with optional type filtering.
   */
  public static getEvents(
    organizationId: string,
    filters?: {
      eventType?: AuditEventType;
      entityId?: string;
      limit?: number;
    }
  ): GovernedAuditEvent[] {
    const events = this.eventLog.get(organizationId) || [];
    let filtered = [...events];

    if (filters?.eventType) {
      filtered = filtered.filter((e) => e.eventType === filters.eventType);
    }

    if (filters?.entityId) {
      filtered = filtered.filter((e) => e.entityId === filters.entityId);
    }

    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  /**
   * Clears audit events for testing purposes.
   */
  public static _reset(): void {
    this.eventLog.clear();
  }
}
