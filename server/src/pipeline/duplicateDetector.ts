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
    const incomingTxnIds = rows
      .map((r) => r.transactionId)
      .filter((id): id is string => Boolean(id));

    const existingById = new Set<string>();
    if (incomingTxnIds.length > 0) {
      const existingTxns = await prisma.transaction.findMany({
        where: {
          organizationId,
          OR: [
            { id: { in: incomingTxnIds } },
            { transactionId: { in: incomingTxnIds } },
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
    const possibleCandidates = await prisma.transaction.findMany({
      where: {
        organizationId,
        smeId: { in: rows.map((r) => r.smeId).filter(Boolean) as string[] },
        buyerId: { in: rows.map((r) => r.buyerId).filter(Boolean) as string[] },
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
    });

    const existingCompositeMap = new Map<string, string>();
    for (const c of possibleCandidates) {
      const dateStr = c.invoiceDate ? c.invoiceDate.toISOString().slice(0, 10) : "";
      const dueStr = c.dueDate ? c.dueDate.toISOString().slice(0, 10) : "";
      const key = `${c.smeId}|${c.buyerId}|${c.invoiceAmount}|${dateStr}|${dueStr}`;
      existingCompositeMap.set(key, c.transactionId || c.id);
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
