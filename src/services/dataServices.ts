import { USE_MOCK_API, apiClient, mockDelay, resolve } from "@/api/client";
import { ENDPOINTS } from "@/api/contracts";
import * as db from "@/mocks/data";
import type {
  Firm,
  Paginated,
  Relationship,
  Transaction,
  TransactionQuery,
  ValidationSummary,
} from "@/types";
import { RISK_ORDER } from "@/utils/format";

// ---------------------------------------------------------------- mutable demo store
let transactionStore: Transaction[] = [...db.transactions];
let relationshipStore: Relationship[] = [...db.relationships];

// ---------------------------------------------------------------- transactions
export const transactionService = {
  async getTransactions(query: TransactionQuery = {}): Promise<Paginated<Transaction>> {
    if (!USE_MOCK_API) return apiClient.post<Paginated<Transaction>>(ENDPOINTS.transactions, query);
    await mockDelay();
    const {
      search = "",
      status = "ALL",
      risk = "ALL",
      buyerId = "ALL",
      supplierId = "ALL",
      from,
      to,
      sortBy = "invoiceDate",
      sortDir = "desc",
      page = 1,
      pageSize = 10,
    } = query;

    const term = search.trim().toLowerCase();
    let rows = transactionStore.filter((t) => {
      if (status !== "ALL" && t.paymentStatus !== status) return false;
      if (risk !== "ALL" && t.riskLevel !== risk) return false;
      if (buyerId !== "ALL" && t.buyerId !== buyerId) return false;
      if (supplierId !== "ALL" && t.supplierId !== supplierId) return false;
      if (from && t.invoiceDate < from) return false;
      if (to && t.invoiceDate > to) return false;
      if (term) {
        const hay = [t.id, db.firmById(t.smeId)?.name, db.firmById(t.buyerId)?.name, db.firmById(t.supplierId ?? "")?.name]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      let cmp = 0;
      if (sortBy === "riskLevel") cmp = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });

    const start = (page - 1) * pageSize;
    return { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize };
  },

  getTransactionById(id: string) {
    return resolve<Transaction | undefined>(ENDPOINTS.transaction(id), () => transactionStore.find((t) => t.id === id));
  },

  getRelatedTransactions(txn: Transaction) {
    return resolve<Transaction[]>(`${ENDPOINTS.transactions}?buyer=${txn.buyerId}`, () =>
      transactionStore.filter((t) => t.id !== txn.id && (t.buyerId === txn.buyerId || t.smeId === txn.smeId)).slice(0, 6),
    );
  },

  async createTransaction(data: Omit<Transaction, "id">): Promise<Transaction> {
    if (!USE_MOCK_API) return apiClient.post<Transaction>(ENDPOINTS.transactions, data);
    await mockDelay();
    const created: Transaction = { ...data, id: `TXN-${String(transactionStore.length + 1).padStart(4, "0")}` };
    transactionStore = [created, ...transactionStore];
    return created;
  },

  async updateTransaction(id: string, patch: Partial<Transaction>): Promise<Transaction> {
    if (!USE_MOCK_API) return apiClient.put<Transaction>(ENDPOINTS.transaction(id), patch);
    await mockDelay();
    transactionStore = transactionStore.map((t) => (t.id === id ? { ...t, ...patch } : t));
    return transactionStore.find((t) => t.id === id)!;
  },

  async deleteTransaction(id: string): Promise<void> {
    if (!USE_MOCK_API) return apiClient.delete<void>(ENDPOINTS.transaction(id));
    await mockDelay();
    transactionStore = transactionStore.filter((t) => t.id !== id);
  },

  async importTransactions(count: number): Promise<{ imported: number }> {
    if (!USE_MOCK_API) return apiClient.post<{ imported: number }>(ENDPOINTS.transactionsImport, { count });
    await mockDelay(900);
    return { imported: count };
  },
};

// ---------------------------------------------------------------- firms
export const firmService = {
  getFirms: () => resolve<Firm[]>(ENDPOINTS.firms, () => db.firms),
  getFirmById: (id: string) => resolve<Firm | undefined>(ENDPOINTS.firm(id), () => db.firmById(id)),
  getFirmTransactions: (id: string) =>
    resolve<Transaction[]>(`${ENDPOINTS.firm(id)}/transactions`, () =>
      transactionStore.filter((t) => t.smeId === id || t.buyerId === id || t.supplierId === id).slice(0, 25),
    ),
  getFirmRelationships: (id: string) =>
    resolve<Relationship[]>(`${ENDPOINTS.firm(id)}/relationships`, () =>
      relationshipStore.filter((r) => r.sourceFirmId === id || r.targetFirmId === id),
    ),
};

// ---------------------------------------------------------------- relationships
export const relationshipService = {
  getRelationships: () => resolve<Relationship[]>(ENDPOINTS.relationships, () => relationshipStore),
  async createRelationship(data: Omit<Relationship, "id">): Promise<Relationship> {
    if (!USE_MOCK_API) return apiClient.post<Relationship>(ENDPOINTS.relationships, data);
    await mockDelay();
    const created = { ...data, id: `REL-${String(relationshipStore.length + 1).padStart(3, "0")}` };
    relationshipStore = [created, ...relationshipStore];
    return created;
  },
  async updateRelationship(id: string, patch: Partial<Relationship>): Promise<Relationship> {
    if (!USE_MOCK_API) return apiClient.put<Relationship>(ENDPOINTS.relationship(id), patch);
    await mockDelay();
    relationshipStore = relationshipStore.map((r) => (r.id === id ? { ...r, ...patch } : r));
    return relationshipStore.find((r) => r.id === id)!;
  },
  async deleteRelationship(id: string): Promise<void> {
    if (!USE_MOCK_API) return apiClient.delete<void>(ENDPOINTS.relationship(id));
    await mockDelay();
    relationshipStore = relationshipStore.filter((r) => r.id !== id);
  },
};

// ---------------------------------------------------------------- upload
export const EXPECTED_COLUMNS = [
  "transaction_id",
  "sme_id",
  "buyer_id",
  "supplier_id",
  "invoice_amount",
  "invoice_date",
  "due_date",
  "payment_date",
  "credit_period",
  "outstanding_amount",
  "payment_status",
] as const;

export type ExpectedColumn = (typeof EXPECTED_COLUMNS)[number];

const REQUIRED_COLUMNS: ExpectedColumn[] = [
  "transaction_id",
  "sme_id",
  "buyer_id",
  "invoice_amount",
  "invoice_date",
  "due_date",
  "payment_status",
];

export const uploadService = {
  /** Parses a CSV file in the browser. Non-CSV files fall back to a representative sample. */
  async parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
    await mockDelay(500);
    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    if (!isCsv) return uploadService.sampleParsed();
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new Error("The file does not contain any data rows.");
    const headers = splitCsvLine(lines[0]!);
    const rows = lines.slice(1).map((line) => {
      const cells = splitCsvLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
    });
    return { headers, rows };
  },

  sampleParsed(): { headers: string[]; rows: Record<string, string>[] } {
    const headers = ["Invoice No", "SME Code", "Buyer Code", "Supplier Code", "Amount", "Invoice Dt", "Due Dt", "Paid Dt", "Credit Days", "Outstanding", "Status"];
    const rows = db.transactions.slice(0, 40).map((t, i) => ({
      "Invoice No": i === 7 ? db.transactions[6]!.id : t.id,
      "SME Code": t.smeId,
      "Buyer Code": t.buyerId,
      "Supplier Code": t.supplierId ?? "",
      Amount: i === 3 ? "abc" : String(t.invoiceAmount),
      "Invoice Dt": i === 11 ? "31/31/2026" : t.invoiceDate,
      "Due Dt": t.dueDate,
      "Paid Dt": t.paymentDate ?? "",
      "Credit Days": String(t.creditPeriodDays ?? ""),
      Outstanding: String(t.outstandingAmount),
      Status: i === 15 ? "" : t.paymentStatus,
    }));
    return { headers, rows };
  },

  async validate(rows: Record<string, string>[], mapping: Record<string, string>): Promise<ValidationSummary> {
    await mockDelay(700);
    const seen = new Set<string>();
    let duplicates = 0;
    let invalidDates = 0;
    let invalidAmounts = 0;
    let missingFields = 0;

    const validated = rows.map((raw) => {
      const errors: string[] = [];
      const get = (col: ExpectedColumn) => (mapping[col] ? (raw[mapping[col]!] ?? "").trim() : "");

      for (const col of REQUIRED_COLUMNS) {
        if (!get(col)) {
          errors.push(`Missing ${col.replace(/_/g, " ")}`);
          missingFields++;
        }
      }
      const amount = Number(get("invoice_amount"));
      if (get("invoice_amount") && (!Number.isFinite(amount) || amount <= 0)) {
        errors.push("Invoice amount is not a valid number");
        invalidAmounts++;
      }
      for (const dateCol of ["invoice_date", "due_date", "payment_date"] as ExpectedColumn[]) {
        const value = get(dateCol);
        if (value && Number.isNaN(new Date(value).getTime())) {
          errors.push(`${dateCol.replace(/_/g, " ")} is not a valid date`);
          invalidDates++;
        }
      }
      const id = get("transaction_id");
      if (id) {
        if (seen.has(id)) {
          errors.push("Duplicate transaction id");
          duplicates++;
        }
        seen.add(id);
      }
      return { raw, errors, valid: errors.length === 0 };
    });

    return {
      totalRows: validated.length,
      validRows: validated.filter((r) => r.valid).length,
      invalidRows: validated.filter((r) => !r.valid).length,
      duplicates,
      invalidDates,
      invalidAmounts,
      missingFields,
      rows: validated,
    };
  },

  sampleTemplateCsv(): string {
    const header = EXPECTED_COLUMNS.join(",");
    const sample = db.transactions.slice(0, 5).map((t) =>
      [t.id, t.smeId, t.buyerId, t.supplierId ?? "", t.invoiceAmount, t.invoiceDate, t.dueDate, t.paymentDate ?? "", t.creditPeriodDays ?? "", t.outstandingAmount, t.paymentStatus].join(","),
    );
    return [header, ...sample].join("\n");
  },
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
