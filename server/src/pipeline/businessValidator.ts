import { CleanedTransactionRow } from "./dataCleaner";

export interface ValidationErrorDetail {
  row: number;
  field: string;
  rule: string;
  problem: string;
  expectedFormat: string;
  example: string;
}

export interface RowValidationResult {
  rowNum: number;
  isValid: boolean;
  errors: ValidationErrorDetail[];
  warnings: string[];
  cleaned: CleanedTransactionRow;
}

export class BusinessValidator {
  static validateRows(rows: CleanedTransactionRow[]): RowValidationResult[] {
    const results: RowValidationResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const errors: ValidationErrorDetail[] = [];
      const warnings: string[] = [];

      // 1. Mandatory concepts
      if (!row.smeId) {
        errors.push({
          row: rowNum,
          field: "sme_id",
          rule: "MANDATORY_FIELD",
          problem: "Missing SME/Vendor identifier.",
          expectedFormat: "Non-empty string (e.g. FIRM-A-01, VENDOR-102)",
          example: "FIRM-A-01",
        });
      }

      if (!row.buyerId) {
        errors.push({
          row: rowNum,
          field: "buyer_id",
          rule: "MANDATORY_FIELD",
          problem: "Missing Buyer/Customer identifier.",
          expectedFormat: "Non-empty string (e.g. FIRM-A-02, BUYER-501)",
          example: "FIRM-A-02",
        });
      }

      if (row.smeId && row.buyerId && row.smeId.toLowerCase() === row.buyerId.toLowerCase()) {
        errors.push({
          row: rowNum,
          field: "buyer_id",
          rule: "IDENTITY_CONFLICT",
          problem: "SME and Buyer cannot be the same entity.",
          expectedFormat: "Distinct SME and Buyer entity identifiers",
          example: "sme_id: FIRM-A-01, buyer_id: FIRM-A-02",
        });
      }

      if (row.invoiceAmount === undefined) {
        errors.push({
          row: rowNum,
          field: "invoice_amount",
          rule: "MANDATORY_NUMERIC",
          problem: "Missing or non-numeric invoice amount.",
          expectedFormat: "Positive number > 0",
          example: "500000",
        });
      } else if (row.invoiceAmount <= 0) {
        errors.push({
          row: rowNum,
          field: "invoice_amount",
          rule: "POSITIVE_AMOUNT",
          problem: `Invoice amount must be strictly greater than 0 (received ${row.invoiceAmount}).`,
          expectedFormat: "Positive number > 0",
          example: "500000",
        });
      }

      if (!row.invoiceDate) {
        errors.push({
          row: rowNum,
          field: "invoice_date",
          rule: "MANDATORY_DATE",
          problem: "Missing or invalid invoice date format.",
          expectedFormat: "Valid ISO Date String (YYYY-MM-DD)",
          example: "2026-05-15",
        });
      }

      if (!row.dueDate) {
        errors.push({
          row: rowNum,
          field: "due_date",
          rule: "MANDATORY_DATE",
          problem: "Missing or invalid due date format.",
          expectedFormat: "Valid ISO Date String (YYYY-MM-DD)",
          example: "2026-06-15",
        });
      }

      // 2. Temporal consistency
      if (row.invoiceDate && row.dueDate) {
        if (row.dueDate.getTime() < row.invoiceDate.getTime()) {
          errors.push({
            row: rowNum,
            field: "due_date",
            rule: "TEMPORAL_SEQUENCE",
            problem: `Due date (${row.dueDate.toISOString().slice(0, 10)}) cannot be earlier than invoice date (${row.invoiceDate.toISOString().slice(0, 10)}).`,
            expectedFormat: "due_date >= invoice_date",
            example: "invoice_date: 2026-05-01, due_date: 2026-06-01",
          });
        }
      }

      if (row.invoiceDate && row.paymentDate) {
        if (row.paymentDate.getTime() < row.invoiceDate.getTime()) {
          errors.push({
            row: rowNum,
            field: "payment_date",
            rule: "TEMPORAL_SEQUENCE",
            problem: `Payment date (${row.paymentDate.toISOString().slice(0, 10)}) cannot precede invoice date (${row.invoiceDate.toISOString().slice(0, 10)}).`,
            expectedFormat: "payment_date >= invoice_date",
            example: "invoice_date: 2026-05-01, payment_date: 2026-05-28",
          });
        }
      }

      // 3. Outstanding amount bounds
      if (row.outstandingAmount !== undefined && row.invoiceAmount !== undefined) {
        if (row.outstandingAmount < 0) {
          errors.push({
            row: rowNum,
            field: "outstanding_amount",
            rule: "NON_NEGATIVE_AMOUNT",
            problem: `Outstanding amount cannot be negative (received ${row.outstandingAmount}).`,
            expectedFormat: "Number >= 0",
            example: "0 or positive balance",
          });
        } else if (row.outstandingAmount > row.invoiceAmount) {
          errors.push({
            row: rowNum,
            field: "outstanding_amount",
            rule: "OUTSTANDING_BOUNDS",
            problem: `Outstanding amount (${row.outstandingAmount}) exceeds invoice amount (${row.invoiceAmount}).`,
            expectedFormat: "outstanding_amount <= invoice_amount",
            example: `Max allowed: ${row.invoiceAmount}`,
          });
        }
      }

      // 4. Payment status & state consistency
      const VALID_PAYMENT_STATUSES = [
        "PAID",
        "PENDING",
        "DELAYED",
        "CRITICAL",
        "OVERDUE",
        "PARTIALLY_PAID",
        "DEFAULTED",
      ];

      if (row.paymentStatus && !VALID_PAYMENT_STATUSES.includes(row.paymentStatus)) {
        errors.push({
          row: rowNum,
          field: "payment_status",
          rule: "INVALID_STATUS",
          problem: `Unrecognized payment status '${row.paymentStatus}'.`,
          expectedFormat: `One of: ${VALID_PAYMENT_STATUSES.join(", ")}`,
          example: "PAID, PENDING, DELAYED, OVERDUE",
        });
      }

      const status = row.paymentStatus || (row.paymentDate ? "PAID" : "PENDING");

      if (status === "PAID") {
        if (!row.paymentDate) {
          errors.push({
            row: rowNum,
            field: "payment_date",
            rule: "STATUS_CONSISTENCY",
            problem: "Transaction marked as PAID but missing payment date.",
            expectedFormat: "Valid payment date when status is PAID",
            example: "2026-06-10",
          });
        }
        if (row.outstandingAmount !== undefined && row.outstandingAmount !== 0) {
          errors.push({
            row: rowNum,
            field: "outstanding_amount",
            rule: "STATUS_CONSISTENCY",
            problem: `Transaction marked as PAID must have outstanding amount of 0 (received ${row.outstandingAmount}).`,
            expectedFormat: "0 for settled transactions",
            example: "0",
          });
        }
      } else if (["PENDING", "OVERDUE", "DELAYED"].includes(status)) {
        if (row.outstandingAmount !== undefined && row.outstandingAmount <= 0) {
          errors.push({
            row: rowNum,
            field: "outstanding_amount",
            rule: "STATUS_CONSISTENCY",
            problem: `Transaction with status '${status}' must have a positive outstanding amount > 0.`,
            expectedFormat: "outstanding_amount > 0",
            example: "50000",
          });
        }
      }

      results.push({
        rowNum,
        isValid: errors.length === 0,
        errors,
        warnings,
        cleaned: row,
      });
    }

    return results;
  }
}
