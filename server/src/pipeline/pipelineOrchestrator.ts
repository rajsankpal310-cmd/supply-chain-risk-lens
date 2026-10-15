import crypto from "crypto";
import { prisma } from "../config/database";
import { FirmRepository } from "../repositories/firm.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import { recalculateFirmRisk } from "../utils/riskCalculator";
import { sanitizeCompanyName } from "../utils/sanitize";
import { BusinessValidator, RowValidationResult } from "./businessValidator";
import { DataCleaner } from "./dataCleaner";
import { DuplicateCheckResult, DuplicateDetector } from "./duplicateDetector";
import { QualityAnalyzer, QualityScorecard } from "./qualityAnalyzer";
import { SchemaDetectionResult, SchemaDetector } from "./schemaDetector";
import { ClassifiedProvenance, ProvenanceMetadata, SourceClassifier } from "./sourceClassifier";

export interface ValidationOutput {
  scorecard: QualityScorecard;
  rowResults: {
    rowNum: number;
    isValid: boolean;
    isExactDuplicate: boolean;
    isPotentialDuplicate: boolean;
    duplicateReason?: string;
    errors: string[];
    cleaned: any;
  }[];
}

export function generateContentFingerprint(
  organizationId: string,
  rawRows: Record<string, any>[]
): string {
  const hash = crypto.createHash("sha256");
  hash.update(`org:${organizationId}:count:${rawRows.length}:`);

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || typeof row !== "object") continue;
    const sortedKeys = Object.keys(row).sort();
    const normalized: Record<string, any> = {};
    for (const key of sortedKeys) {
      const val = row[key];
      normalized[key] = typeof val === "string" ? val.trim() : val;
    }
    hash.update(JSON.stringify(normalized));
    hash.update("\n");
  }

  return hash.digest("hex");
}

export class PipelineOrchestrator {
  static inspect(
    headers: string[],
    rows: Record<string, any>[],
    userOverrides: Record<string, string> = {}
  ): SchemaDetectionResult {
    return SchemaDetector.inspect(headers, rows, userOverrides);
  }

  static async validate(
    organizationId: string,
    rawRows: Record<string, any>[],
    mapping: Record<string, string> = {}
  ): Promise<ValidationOutput> {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      const scorecard = QualityAnalyzer.analyze([], []);
      return { scorecard, rowResults: [] };
    }

    // 1. Clean and normalize
    const cleanedRows = rawRows.map((r) => DataCleaner.cleanRow(r, mapping));

    // 2. Business & semantic validation
    const valResults = BusinessValidator.validateRows(cleanedRows);

    // 3. Duplicate detection
    const dupResults = await DuplicateDetector.checkDuplicates(organizationId, cleanedRows);

    // 4. Quality analysis
    const headers = Object.keys(rawRows[0] || {});
    const scorecard = QualityAnalyzer.analyze(valResults, dupResults, headers);

    const dupMap = new Map<number, DuplicateCheckResult>();
    for (const d of dupResults) {
      dupMap.set(d.rowNum, d);
    }

    const rowResults = valResults.map((v) => {
      const dup = dupMap.get(v.rowNum);
      const isExact = dup?.isExactDuplicate || false;
      const isPotential = dup?.isPotentialDuplicate || false;
      return {
        rowNum: v.rowNum,
        isValid: v.isValid && !isExact,
        isExactDuplicate: isExact,
        isPotentialDuplicate: isPotential,
        duplicateReason: dup?.duplicateReason,
        errors: v.errors.map((e) => `${e.field}: ${e.problem}`),
        cleaned: v.cleaned,
      };
    });

    return { scorecard, rowResults };
  }

  static async executeImport(
    organizationId: string,
    userId: string,
    rawRows: Record<string, any>[],
    mapping: Record<string, string> = {},
    metadata?: ProvenanceMetadata
  ) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      throw { status: 400, message: "No data rows provided for import." };
    }

    // 0. Deterministic duplicate-import protection using canonical content fingerprint
    const contentFingerprint = generateContentFingerprint(organizationId, rawRows);

    // Check if an import batch with this fingerprint and non-zero transactions already exists
    const existingBatches = await prisma.importBatch.findMany({
      where: {
        organizationId,
        status: "IMPORTED",
      },
      include: {
        _count: { select: { transactions: true } },
      },
    });

    const existingBatch = existingBatches.find((b) => {
      if (b.datasetVersion === contentFingerprint) return true;
      if (b.qualityReport) {
        try {
          const parsed = JSON.parse(b.qualityReport);
          if (parsed.contentFingerprint === contentFingerprint) return true;
        } catch {
          if (b.qualityReport.includes(contentFingerprint)) return true;
        }
      }
      return false;
    });

    if (existingBatch && existingBatch._count.transactions > 0) {
      throw {
        status: 409,
        message: `Deterministic duplicate import detected: dataset "${metadata?.sourceName || 'file'}" has already been imported for this organization (Batch ID: ${existingBatch.id}). The same file content cannot be imported twice.`,
      };
    }

    // Clean up any empty failed batches with 0 transactions for this fingerprint
    if (existingBatch && existingBatch._count.transactions === 0) {
      await prisma.importBatch.delete({ where: { id: existingBatch.id } }).catch(() => null);
    }

    // 1. Validate
    const { scorecard, rowResults } = await this.validate(organizationId, rawRows, mapping);
    scorecard.contentFingerprint = contentFingerprint;

    const acceptedRows = rowResults
      .filter((r) => r.isValid && !r.isExactDuplicate)
      .map((r) => r.cleaned);

    if (acceptedRows.length === 0) {
      throw {
        status: 422,
        message: "All records failed validation or were exact duplicates. Zero valid records to import.",
        details: scorecard.rejectionReasons,
        scorecard,
      };
    }

    // 2. Provenance classification
    const provenance: ClassifiedProvenance = SourceClassifier.classify({
      ...metadata,
      datasetVersion: metadata?.datasetVersion || contentFingerprint,
      importedBy: userId,
    });

    // 4. Counterparty pre-resolution under organizationId
    const distinctFirmIds = new Set<string>();
    const firmNameMap = new Map<string, string>();

    const getRawVal = (raw: Record<string, any>, concept: string): any => {
      if (!raw || typeof raw !== "object") return undefined;
      const col = mapping[concept];
      if (col && raw[col] !== undefined) return raw[col];
      for (const [srcCol, canon] of Object.entries(mapping)) {
        if (canon === concept && raw[srcCol] !== undefined) return raw[srcCol];
      }
      if (raw[concept] !== undefined) return raw[concept];
      const camel = concept.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
      if (raw[camel] !== undefined) return raw[camel];
      return undefined;
    };

    for (const row of acceptedRows) {
      const raw = row.raw || {};
      const rawSupplierName = getRawVal(raw, "supplier_name") || getRawVal(raw, "vendor_name") || getRawVal(raw, "seller_name");
      const rawBuyerName = getRawVal(raw, "buyer_name") || getRawVal(raw, "customer_name") || getRawVal(raw, "client_name");

      if (row.smeId) {
        distinctFirmIds.add(row.smeId);
        if (rawSupplierName && !firmNameMap.has(row.smeId)) {
          const clean = sanitizeCompanyName(rawSupplierName, row.smeId);
          firmNameMap.set(row.smeId, clean);
        }
      }
      if (row.buyerId) {
        distinctFirmIds.add(row.buyerId);
        if (rawBuyerName && !firmNameMap.has(row.buyerId)) {
          const clean = sanitizeCompanyName(rawBuyerName, row.buyerId);
          firmNameMap.set(row.buyerId, clean);
        }
      }
      if (row.supplierId) {
        distinctFirmIds.add(row.supplierId);
        if (rawSupplierName && !firmNameMap.has(row.supplierId)) {
          const clean = sanitizeCompanyName(rawSupplierName, row.supplierId);
          firmNameMap.set(row.supplierId, clean);
        }
      }
    }

    const existingFirms = await prisma.firm.findMany({
      where: { organizationId },
      select: { id: true, name: true, role: true },
    });

    const firmIdMap = new Map<string, string>();
    let orgSmeFirmId: string | null = null;

    for (const f of existingFirms) {
      firmIdMap.set(f.id, f.id);
      firmIdMap.set(f.name, f.id);
      if (f.role === "SME" && !orgSmeFirmId) {
        orgSmeFirmId = f.id;
      }
    }

    let defaultOrgSmeToCreate: any = null;
    if (!orgSmeFirmId) {
      defaultOrgSmeToCreate = {
        id: `${organizationId}_PRIMARY_SME`,
        organizationId,
        name: "Primary Enterprise",
        industry: "General Commerce",
        role: "SME",
        city: "Mumbai",
        annualTurnover: 0,
        cashBufferDays: 30,
        riskScore: 0,
        riskLevel: "LOW",
        isDemo: provenance.sourceType === "DEMO_ONLY",
        sourceType: provenance.sourceType,
        dataStatus: provenance.dataStatus,
      };
      orgSmeFirmId = defaultOrgSmeToCreate.id;
      firmIdMap.set("CURRENT_ORGANIZATION_SME", defaultOrgSmeToCreate.id);
    } else {
      firmIdMap.set("CURRENT_ORGANIZATION_SME", orgSmeFirmId!);
    }

    // Query global firm collisions
    const firmIdArray = Array.from(distinctFirmIds);
    const globalCollisions = await prisma.firm.findMany({
      where: { id: { in: firmIdArray.slice(0, 5000) } },
      select: { id: true, organizationId: true },
    });
    const collisionMap = new Map<string, string>();
    for (const c of globalCollisions) {
      collisionMap.set(c.id, c.organizationId);
    }

    const firmsToCreate: any[] = [];
    const now = new Date();

    for (const firmIdentifier of firmIdArray) {
      if (firmIdentifier === "CURRENT_ORGANIZATION_SME") continue;
      if (firmIdMap.has(firmIdentifier)) continue;

      const takenOrg = collisionMap.get(firmIdentifier);
      const targetId = (takenOrg && takenOrg !== organizationId)
        ? `${organizationId}_${firmIdentifier}`
        : firmIdentifier;

      if (firmIdMap.has(targetId)) continue;

      const rawFirmName = firmNameMap.get(firmIdentifier) || firmIdentifier;
      const firmName = sanitizeCompanyName(rawFirmName, targetId);
      firmsToCreate.push({
        id: targetId,
        organizationId,
        name: firmName,
        industry: "General Commerce",
        role: "SME",
        city: "Mumbai",
        annualTurnover: 0,
        cashBufferDays: 30,
        riskScore: 0,
        riskLevel: "LOW",
        isDemo: provenance.sourceType === "DEMO_ONLY",
        sourceType: provenance.sourceType,
        dataStatus: provenance.dataStatus,
        createdAt: now,
        updatedAt: now,
      });
      firmIdMap.set(firmIdentifier, targetId);
    }

    // Prepare transaction records in memory
    const affectedFirms = new Set<string>();
    const transactionRecords: any[] = [];

    for (let i = 0; i < acceptedRows.length; i++) {
      const row = acceptedRows[i];
      const invDate: Date = row.invoiceDate!;
      const payDate: Date | null = row.paymentDate || null;
      const creditPeriodDays = row.creditPeriodDays || 30;
      const dueDate: Date = row.dueDate || new Date(invDate.getTime() + creditPeriodDays * 86400000);

      let paymentDelayDays: number | null = null;
      if (payDate) {
        paymentDelayDays = Math.max(0, Math.round((payDate.getTime() - dueDate.getTime()) / 86400000));
      } else if (Date.now() > dueDate.getTime()) {
        paymentDelayDays = Math.max(0, Math.round((Date.now() - dueDate.getTime()) / 86400000));
      }

      const status = row.paymentStatus || (payDate ? "PAID" : "PENDING");
      const outstandingAmount = status === "PAID"
        ? 0
        : (row.outstandingAmount !== undefined ? row.outstandingAmount : row.invoiceAmount!);

      const resolvedSmeId = firmIdMap.get(row.smeId!) || row.smeId!;
      const resolvedBuyerId = firmIdMap.get(row.buyerId!) || row.buyerId!;
      const rawSupplier = (typeof row.supplierId === "string" && row.supplierId.trim()) ? row.supplierId.trim() : null;
      const resolvedSupplierId = rawSupplier ? (firmIdMap.get(rawSupplier) || rawSupplier) : null;

      transactionRecords.push({
        id: crypto.randomUUID(),
        organizationId,
        transactionId: (typeof row.transactionId === "string" && row.transactionId.trim()) ? row.transactionId.trim() : null,
        smeId: resolvedSmeId,
        buyerId: resolvedBuyerId,
        supplierId: resolvedSupplierId || null,
        invoiceAmount: row.invoiceAmount!,
        outstandingAmount,
        invoiceDate: invDate,
        dueDate,
        paymentDate: payDate,
        creditPeriodDays,
        paymentDelayDays,
        paymentStatus: status,
        riskLevel: paymentDelayDays && paymentDelayDays > 45 ? "CRITICAL" : paymentDelayDays && paymentDelayDays > 20 ? "HIGH" : paymentDelayDays && paymentDelayDays > 10 ? "MEDIUM" : "LOW",
        sourceType: provenance.sourceType,
        sourceName: provenance.sourceName,
        sourceUrl: provenance.sourceUrl,
        dataStatus: provenance.dataStatus,
        createdAt: now,
        updatedAt: now,
      });

      affectedFirms.add(resolvedSmeId);
      affectedFirms.add(resolvedBuyerId);
    }

    // Atomic interactive database transaction
    const batch = await prisma.$transaction(
      async (tx) => {
        // 3. Create ImportBatch audit record
        const createdBatch = await tx.importBatch.create({
          data: {
            organizationId,
            sourceType: provenance.sourceType,
            sourceName: provenance.sourceName,
            sourceOrg: provenance.sourceOrg,
            sourceUrl: provenance.sourceUrl,
            sourceDate: provenance.sourceDate,
            datasetVersion: provenance.datasetVersion || contentFingerprint,
            license: provenance.license,
            dataGranularity: provenance.dataGranularity,
            status: "IMPORTED",
            importedBy: userId,
            recordCount: rawRows.length,
            acceptedCount: acceptedRows.length,
            rejectedCount: rawRows.length - acceptedRows.length,
            duplicateCount: scorecard.exactDuplicateCount,
            dataStatus: provenance.dataStatus,
            qualityReport: JSON.stringify({ ...scorecard, contentFingerprint }),
            rawSample: JSON.stringify(rawRows.slice(0, 5)),
          },
        });

        // 4. Create primary SME if needed
        if (defaultOrgSmeToCreate) {
          await tx.firm.create({
            data: defaultOrgSmeToCreate,
          });
        }

        // Create counterparties
        if (firmsToCreate.length > 0) {
          for (let i = 0; i < firmsToCreate.length; i += 2000) {
            const chunk = firmsToCreate.slice(i, i + 2000);
            await tx.firm.createMany({
              data: chunk,
              skipDuplicates: true,
            });
          }
        }

        // 5. Ingest Transactions in bulk
        for (let i = 0; i < transactionRecords.length; i += 2500) {
          const chunk = transactionRecords.slice(i, i + 2500).map((t) => ({
            ...t,
            batchId: createdBatch.id,
          }));
          await tx.transaction.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        }

        // 6. Recalculate firm risk scores using database aggregation for affected firms
        const affectedFirmList: string[] = Array.from(affectedFirms);
        if (affectedFirmList.length > 0) {
          const firmTxnStats = await tx.transaction.groupBy({
            by: ["smeId"],
            where: {
              organizationId,
              smeId: { in: affectedFirmList },
            },
            _count: { id: true },
            _sum: { outstandingAmount: true },
            _avg: { paymentDelayDays: true },
          });

          for (let i = 0; i < firmTxnStats.length; i += 5) {
            const batchStats = firmTxnStats.slice(i, i + 5);
            await Promise.all(
              batchStats.map((stat: any) => {
                const count = stat._count?.id || 0;
                const outstanding = stat._sum?.outstandingAmount || 0;
                const avgDelay = Math.round(stat._avg?.paymentDelayDays || 0);
                const delayFactor = Math.min(60, avgDelay * 1.8);
                const riskScore = Math.min(99, Math.max(10, Math.round(delayFactor + 10)));
                const riskLevel = riskScore >= 80 ? "CRITICAL" : riskScore >= 62 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";
                const financialStress = Math.min(99, Math.round(riskScore * 0.85));
                const status = (riskLevel === "CRITICAL" || riskLevel === "HIGH") ? "STRESSED" : "HEALTHY";

                return tx.firm.update({
                  where: { id: stat.smeId },
                  data: {
                    transactionCount: count,
                    outstandingAmount: outstanding,
                    avgPaymentDelayDays: avgDelay,
                    riskScore,
                    riskLevel,
                    financialStress,
                    status,
                  },
                });
              })
            );
          }
        }

        return createdBatch;
      },
      {
        timeout: 120000,
        maxWait: 15000,
      }
    );

    return {
      success: true,
      batchId: batch.id,
      imported: acceptedRows.length,
      rejected: rawRows.length - acceptedRows.length,
      duplicates: scorecard.exactDuplicateCount,
      potentialDuplicates: scorecard.potentialDuplicateCount,
      qualityScore: scorecard.overallQualityScore,
      qualityGrade: scorecard.qualityGrade,
      scorecard,
    };
  }
}
