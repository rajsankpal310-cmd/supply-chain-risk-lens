/**
 * NEXUS-CFR Data Quality Quarantine & Review Service
 * Phase 5: Real Authorized Data Acquisition & First Evidence Run
 *
 * Partitions normalized canonical records into ACCEPTED, WARNING, REJECTED,
 * and QUARANTINED tiers. Provides auditable compliance review workflows.
 */

import { CanonicalInvoiceContract } from "./canonicalContract";

export type DataQualityTier = "ACCEPTED" | "WARNING" | "REJECTED" | "QUARANTINED";

export type QuarantineReason =
  | "AMBIGUOUS_BUYER_IDENTITY"
  | "CONFLICTING_DATES"
  | "UNRESOLVABLE_PAYMENT_STATE"
  | "INVALID_NEGATIVE_AMOUNT"
  | "ZERO_OR_MISSING_AMOUNT"
  | "FUTURE_INVOICE_DATE";

export interface QuarantinedRecordAudit {
  quarantineId: string;
  organizationId: string;
  sourceId: string;
  transactionId: string;
  buyerId: string;
  smeId: string;
  invoiceAmount: number;
  invoiceDate: string;
  dueDate: string;
  paymentDate?: string | null;
  quarantineReason: QuarantineReason;
  details: string;
  tier: DataQualityTier;
  quarantinedAt: string;
  reviewStatus: "PENDING_REVIEW" | "APPROVED_RELEASE" | "PERMANENTLY_REJECTED";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  rawPayload?: Record<string, any>;
}

export interface QualityPartitionSummary {
  totalEvaluated: number;
  accepted: CanonicalInvoiceContract[];
  warning: Array<{ record: CanonicalInvoiceContract; warnings: string[] }>;
  rejected: Array<{ record: Partial<CanonicalInvoiceContract>; reasons: string[] }>;
  quarantined: QuarantinedRecordAudit[];
  qualityScore: number; // 0-100
  isDatasetEligibleForML: boolean;
}

export class QuarantineService {
  // Scoped by organizationId -> Map<quarantineId, QuarantinedRecordAudit>
  private static tenantQuarantineStore: Map<string, Map<string, QuarantinedRecordAudit>> = new Map();

  /**
   * Partitions an array of canonical records into ACCEPTED, WARNING, REJECTED, and QUARANTINED.
   */
  public static evaluateAndPartition(
    organizationId: string,
    sourceId: string,
    records: CanonicalInvoiceContract[]
  ): QualityPartitionSummary {
    const accepted: CanonicalInvoiceContract[] = [];
    const warning: Array<{ record: CanonicalInvoiceContract; warnings: string[] }> = [];
    const rejected: Array<{ record: Partial<CanonicalInvoiceContract>; reasons: string[] }> = [];
    const quarantined: QuarantinedRecordAudit[] = [];

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    for (const rec of records) {
      const recWarnings: string[] = [];
      const recErrors: string[] = [];

      // 1. REJECTED: Critical value failures
      if (typeof rec.invoice_amount !== "number" || isNaN(rec.invoice_amount) || rec.invoice_amount <= 0) {
        recErrors.push(`Invoice amount ${rec.invoice_amount} is non-positive or invalid.`);
      }

      if (recErrors.length > 0) {
        rejected.push({ record: rec, reasons: recErrors });
        continue;
      }

      // 2. QUARANTINED: Semantic anomalies requiring compliance review
      let quarantineReason: QuarantineReason | null = null;
      let quarantineDetail = "";

      const invTime = new Date(rec.invoice_date).getTime();
      const dueTime = new Date(rec.due_date).getTime();
      const payTime = rec.payment_date ? new Date(rec.payment_date).getTime() : null;

      // Conflicting Dates: dueDate < invoiceDate
      if (dueTime < invTime) {
        quarantineReason = "CONFLICTING_DATES";
        quarantineDetail = `Due date (${rec.due_date}) precedes invoice date (${rec.invoice_date}).`;
      }
      // Conflicting Dates: paymentDate < invoiceDate
      else if (payTime !== null && payTime < invTime) {
        quarantineReason = "CONFLICTING_DATES";
        quarantineDetail = `Payment settlement date (${rec.payment_date}) precedes invoice issuance date (${rec.invoice_date}).`;
      }
      // Future Invoice Date: invoiceDate > today + 7 days
      else if (invTime > now.getTime() + 7 * 86400000) {
        quarantineReason = "FUTURE_INVOICE_DATE";
        quarantineDetail = `Invoice date (${rec.invoice_date}) is in the future relative to extraction run.`;
      }
      // Ambiguous Identity: Generic or unresolvable buyer ID
      else if (
        !rec.buyer_id ||
        rec.buyer_id.trim().toUpperCase() === "UNKNOWN" ||
        rec.buyer_id.trim().toUpperCase() === "CASH" ||
        rec.buyer_id.trim().length < 2
      ) {
        quarantineReason = "AMBIGUOUS_BUYER_IDENTITY";
        quarantineDetail = `Buyer identifier '${rec.buyer_id}' is generic, anonymous, or unresolvable.`;
      }
      // Unresolvable Payment State: marked PAID with no payment date and full balance remaining
      else if (rec.payment_status === "PAID" && !rec.payment_date && rec.outstanding_amount >= rec.invoice_amount) {
        quarantineReason = "UNRESOLVABLE_PAYMENT_STATE";
        quarantineDetail = `Voucher is marked 'PAID' but has null payment_date and outstanding balance equals full invoice amount.`;
      }

      if (quarantineReason) {
        const qAudit: QuarantinedRecordAudit = {
          quarantineId: `Q-${organizationId}-${rec.transaction_id}-${Date.now().toString(36)}`,
          organizationId,
          sourceId,
          transactionId: rec.transaction_id,
          buyerId: rec.buyer_id,
          smeId: rec.sme_id,
          invoiceAmount: rec.invoice_amount,
          invoiceDate: rec.invoice_date,
          dueDate: rec.due_date,
          paymentDate: rec.payment_date,
          quarantineReason,
          details: quarantineDetail,
          tier: "QUARANTINED",
          quarantinedAt: now.toISOString(),
          reviewStatus: "PENDING_REVIEW",
          rawPayload: rec.raw_payload,
        };

        if (!this.tenantQuarantineStore.has(organizationId)) {
          this.tenantQuarantineStore.set(organizationId, new Map());
        }
        this.tenantQuarantineStore.get(organizationId)!.set(qAudit.quarantineId, qAudit);
        quarantined.push(qAudit);
        continue;
      }

      // 3. WARNING: Non-critical missing optional fields
      if (!rec.supplier_id) {
        recWarnings.push("Optional field 'supplier_id' is missing. Mapped directly to SME ID.");
      }
      if (rec.credit_period > 180) {
        recWarnings.push(`Unusually long credit period: ${rec.credit_period} days.`);
      }

      if (recWarnings.length > 0) {
        warning.push({ record: rec, warnings: recWarnings });
      }

      // 4. ACCEPTED: Valid commercial invoice
      accepted.push(rec);
    }

    // Quality Score Calculation
    const total = records.length;
    const acceptedCount = accepted.length;
    const rejectedCount = rejected.length;
    const quarantinedCount = quarantined.length;

    let qualityScore = 100;
    if (total > 0) {
      const penalty = (rejectedCount * 25 + quarantinedCount * 10 + warning.length * 2) / total;
      qualityScore = Math.max(0, Math.round(100 - penalty));
    }

    const isDatasetEligibleForML = qualityScore >= 70 && quarantinedCount / (total || 1) < 0.15;

    return {
      totalEvaluated: total,
      accepted,
      warning,
      rejected,
      quarantined,
      qualityScore,
      isDatasetEligibleForML,
    };
  }

  /**
   * Reviews and resolves a quarantined record.
   */
  public static reviewQuarantineRecord(
    organizationId: string,
    quarantineId: string,
    decision: "APPROVED_RELEASE" | "PERMANENTLY_REJECTED",
    reviewerEmail: string,
    notes: string
  ): QuarantinedRecordAudit {
    const orgMap = this.tenantQuarantineStore.get(organizationId);
    if (!orgMap) throw new Error("Quarantine record not found for tenant.");

    const audit = orgMap.get(quarantineId);
    if (!audit) throw new Error(`Quarantine item ${quarantineId} not found.`);

    audit.reviewStatus = decision;
    audit.reviewedBy = reviewerEmail;
    audit.reviewedAt = new Date().toISOString();
    audit.reviewNotes = notes;

    return audit;
  }

  /**
   * Lists all quarantined records for a tenant.
   */
  public static listQuarantinedRecords(
    organizationId: string,
    statusFilter?: QuarantinedRecordAudit["reviewStatus"]
  ): QuarantinedRecordAudit[] {
    const orgMap = this.tenantQuarantineStore.get(organizationId);
    if (!orgMap) return [];
    let list = Array.from(orgMap.values());
    if (statusFilter) {
      list = list.filter((q) => q.reviewStatus === statusFilter);
    }
    return list.sort((a, b) => new Date(b.quarantinedAt).getTime() - new Date(a.quarantinedAt).getTime());
  }

  /**
   * Clears quarantine store (for test harness).
   */
  public static clearStore(): void {
    this.tenantQuarantineStore.clear();
  }
}
