import { prisma } from "../config/database";
import { FirmRepository } from "../repositories/firm.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import { recalculateFirmRisk } from "../utils/riskCalculator";
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

export class PipelineOrchestrator {
  static inspect(headers: string[], rows: Record<string, any>[]): SchemaDetectionResult {
    return SchemaDetector.inspect(headers, rows);
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

    // 1. Validate
    const { scorecard, rowResults } = await this.validate(organizationId, rawRows, mapping);

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
      importedBy: userId,
    });

    // 3. Create ImportBatch audit record
    const batch = await prisma.importBatch.create({
      data: {
        organizationId,
        sourceType: provenance.sourceType,
        sourceName: provenance.sourceName,
        sourceOrg: provenance.sourceOrg,
        sourceUrl: provenance.sourceUrl,
        sourceDate: provenance.sourceDate,
        datasetVersion: provenance.datasetVersion,
        license: provenance.license,
        dataGranularity: provenance.dataGranularity,
        status: "IMPORTED",
        importedBy: userId,
        recordCount: rawRows.length,
        acceptedCount: acceptedRows.length,
        rejectedCount: rawRows.length - acceptedRows.length,
        duplicateCount: scorecard.exactDuplicateCount,
        dataStatus: provenance.dataStatus,
        qualityReport: JSON.stringify(scorecard),
        rawSample: JSON.stringify(rawRows.slice(0, 5)),
      },
    });

    // 4. Counterparty auto-resolution under organizationId
    const distinctFirmIds = new Set<string>();
    for (const row of acceptedRows) {
      if (row.smeId) distinctFirmIds.add(row.smeId);
      if (row.buyerId) distinctFirmIds.add(row.buyerId);
      if (row.supplierId) distinctFirmIds.add(row.supplierId);
    }

    for (const firmId of Array.from(distinctFirmIds)) {
      const existing = await FirmRepository.findById(firmId, organizationId);
      if (!existing) {
        await FirmRepository.create({
          id: firmId,
          organizationId,
          name: firmId,
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
        });
      }
    }

    // 5. Ingest Transactions
    const affectedFirms = new Set<string>();
    let importCount = 0;

    for (let i = 0; i < acceptedRows.length; i++) {
      const row = acceptedRows[i];
      const invDate: Date = row.invoiceDate!;
      const dueDate: Date = row.dueDate!;
      const payDate: Date | null = row.paymentDate || null;

      let paymentDelayDays: number | null = null;
      if (payDate) {
        paymentDelayDays = Math.max(0, Math.round((payDate.getTime() - dueDate.getTime()) / 86400000));
      }

      const creditPeriodDays = row.creditPeriodDays
        ? row.creditPeriodDays
        : Math.max(1, Math.round((dueDate.getTime() - invDate.getTime()) / 86400000));

      const status = row.paymentStatus || (payDate ? "PAID" : "PENDING");
      const outstandingAmount = status === "PAID"
        ? 0
        : (row.outstandingAmount !== undefined ? row.outstandingAmount : row.invoiceAmount!);

      const id = row.transactionId || `TXN-IMP-${Date.now()}-${i + 1}`;

      await TransactionRepository.create({
        id,
        organizationId,
        transactionId: id,
        smeId: row.smeId!,
        buyerId: row.buyerId!,
        supplierId: row.supplierId || null,
        invoiceAmount: row.invoiceAmount!,
        outstandingAmount,
        invoiceDate: invDate,
        dueDate,
        paymentDate: payDate,
        creditPeriodDays,
        paymentDelayDays,
        paymentStatus: status,
        riskLevel: "LOW",
        sourceType: provenance.sourceType,
        sourceName: provenance.sourceName,
        sourceUrl: provenance.sourceUrl,
        dataStatus: provenance.dataStatus,
        batchId: batch.id,
      });

      importCount++;
      affectedFirms.add(row.smeId!);
      affectedFirms.add(row.buyerId!);
    }

    // 6. Recalculate firm risk scores
    for (const firmId of Array.from(affectedFirms)) {
      await recalculateFirmRisk(firmId, organizationId);
    }

    return {
      success: true,
      batchId: batch.id,
      imported: importCount,
      rejected: rawRows.length - importCount,
      duplicates: scorecard.exactDuplicateCount,
      potentialDuplicates: scorecard.potentialDuplicateCount,
      qualityScore: scorecard.overallQualityScore,
      qualityGrade: scorecard.qualityGrade,
      scorecard,
    };
  }
}
