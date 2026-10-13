import { prisma } from "../config/database";
import { CleanedTransactionRow } from "./dataCleaner";

export interface DuplicateCheckResult {
  rowNum: number;
  isExactDuplicate: boolean;
  isPotentialDuplicate: boolean;
  duplicateReason?: string;
  matchedId?: string;
}

export class DuplicateDetector {
  static async checkDuplicates(
    organizationId: string,
    rows: CleanedTransactionRow[]
  ): Promise<DuplicateCheckResult[]> {
    const results: DuplicateCheckResult[] = [];

    // 1. Gather existing IDs and composite keys in batch to detect intra-batch duplicates
    const seenTxnIdsInBatch = new Map<string, number>();
    const seenCompositesInBatch = new Map<string, number>();

    // 2. Fetch existing transaction IDs and potential duplicate keys from DB for this organization
    const incomingTxnIds = Array.from(
      new Set(rows.map((r) => r.transactionId).filter((id): id is string => Boolean(id)))
    );

    const existingById = new Set<string>();
    // PostgreSQL / Prisma has a hard limit of 32,767 bind parameters.
    // Querying in chunks of 2,000 (4,000 parameters for OR condition) stays well within safe limits.
    const TXN_CHUNK_SIZE = 2000;
    for (let i = 0; i < incomingTxnIds.length; i += TXN_CHUNK_SIZE) {
      const chunk = incomingTxnIds.slice(i, i + TXN_CHUNK_SIZE);
      const existingTxns = await prisma.transaction.findMany({
        where: {
          organizationId,
          OR: [
            { id: { in: chunk } },
            { transactionId: { in: chunk } },
          ],
        },
        select: { id: true, transactionId: true },
      });

      for (const t of existingTxns) {
        if (t.id) existingById.add(t.id);
        if (t.transactionId) existingById.add(t.transactionId);
      }
    }

    // Fetch existing candidates for potential duplicates (matching SME + Buyer + Amount)
    const uniqueSmeIds = Array.from(new Set(rows.map((r) => r.smeId).filter(Boolean) as string[]));
    const uniqueBuyerIds = Array.from(new Set(rows.map((r) => r.buyerId).filter(Boolean) as string[]));
    const existingCompositeMap = new Map<string, string>();

    // Chunk SME and Buyer IDs to keep bind variables safely below PostgreSQL limits
    const SME_CHUNK = 500;
    const BUYER_CHUNK = 500;
    if (uniqueSmeIds.length > 0 && uniqueBuyerIds.length > 0) {
      for (let s = 0; s < uniqueSmeIds.length; s += SME_CHUNK) {
        const smeChunk = uniqueSmeIds.slice(s, s + SME_CHUNK);
        for (let b = 0; b < uniqueBuyerIds.length; b += BUYER_CHUNK) {
          const buyerChunk = uniqueBuyerIds.slice(b, b + BUYER_CHUNK);
          const possibleCandidates = await prisma.transaction.findMany({
            where: {
              organizationId,
              smeId: { in: smeChunk },
              buyerId: { in: buyerChunk },
            },
            select: {
              id: true,
              transactionId: true,
              smeId: true,
              buyerId: true,
              invoiceAmount: true,
              invoiceDate: true,
              dueDate: true,
            },
            take: 5000,
          });

          for (const c of possibleCandidates) {
            const dateStr = c.invoiceDate ? c.invoiceDate.toISOString().slice(0, 10) : "";
            const dueStr = c.dueDate ? c.dueDate.toISOString().slice(0, 10) : "";
            const key = `${c.smeId}|${c.buyerId}|${c.invoiceAmount}|${dateStr}|${dueStr}`;
            existingCompositeMap.set(key, c.transactionId || c.id);
          }
        }
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      let isExact = false;
      let isPotential = false;
      let reason: string | undefined;
      let matchedId: string | undefined;

      // Check Exact Duplicate by Transaction ID
      if (row.transactionId) {
        if (seenTxnIdsInBatch.has(row.transactionId)) {
          isExact = true;
          const prevRow = seenTxnIdsInBatch.get(row.transactionId)!;
          reason = `Exact duplicate transaction ID '${row.transactionId}' matches earlier row #${prevRow} in this batch.`;
          matchedId = row.transactionId;
        } else if (existingById.has(row.transactionId)) {
          isExact = true;
          reason = `Exact duplicate: transaction ID '${row.transactionId}' already exists in your organization's database.`;
          matchedId = row.transactionId;
        }
        seenTxnIdsInBatch.set(row.transactionId, rowNum);
      }

      // Check Potential Duplicate by Composite Concept Key
      if (!isExact && row.smeId && row.buyerId && row.invoiceAmount && row.invoiceDate && row.dueDate) {
        const invDateStr = row.invoiceDate.toISOString().slice(0, 10);
        const dueDateStr = row.dueDate.toISOString().slice(0, 10);
        const compKey = `${row.smeId}|${row.buyerId}|${row.invoiceAmount}|${invDateStr}|${dueDateStr}`;

        if (seenCompositesInBatch.has(compKey)) {
          isPotential = true;
          const prevRow = seenCompositesInBatch.get(compKey)!;
          reason = `Potential duplicate: Identical SME (${row.smeId}), Buyer (${row.buyerId}), Amount (${row.invoiceAmount}), and dates match row #${prevRow} in this batch.`;
          matchedId = `Row #${prevRow}`;
        } else if (existingCompositeMap.has(compKey)) {
          isPotential = true;
          const existingId = existingCompositeMap.get(compKey)!;
          reason = `Potential duplicate: Identical SME, Buyer, Amount (${row.invoiceAmount}), and dates match existing transaction '${existingId}'.`;
          matchedId = existingId;
        }
        seenCompositesInBatch.set(compKey, rowNum);
      }

      results.push({
        rowNum,
        isExactDuplicate: isExact,
        isPotentialDuplicate: isPotential,
        duplicateReason: reason,
        matchedId,
      });
    }

    return results;
  }
}
