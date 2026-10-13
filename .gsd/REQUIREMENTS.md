# REQUIREMENTS.md — Milestone 2.0: Ingestion, Persistence & Analytics Correctness

## Format
| ID | Requirement | Source | Status |
|----|-------------|--------|--------|
| REQ-01 | Forensic Diagnosis of Ingestion, Persistence, and Metric Gaps | SPEC Goal 1, 2, 3 | Pending |
| REQ-02 | Deterministic Duplicate-Import Prevention & Count Reconciliation | SPEC Goal 1 | Pending |
| REQ-03 | Transaction Relational Persistence & Organization-Scoped Retrieval | SPEC Goal 2 | Pending |
| REQ-04 | Honest Dashboard & Risk Aggregation from Valid Persisted Ledgers | SPEC Goal 3 | Pending |
| REQ-05 | Semantic Universal Mapping Verification Across Diverse Datasets | SPEC Goal 4 | Pending |
| REQ-06 | 100 MB Large-File Stress Testing, Edge Ingestion & Error Reporting | SPEC Goal 4 | Pending |
| REQ-07 | Full Regression Test Suite & End-to-End Browser Flow Verification | SPEC Goal 5 | Pending |

---

## Detailed Requirement Specifications

### REQ-01: Ingestion & Analytics Forensic Diagnosis
- Identify the exact root cause why valid CSV uploads report success while Transactions show 0 items and Dashboard displays ₹0.
- Trace the lifecycle of imported rows: client chunking → Express route → `PipelineOrchestrator.executeImport` → Prisma `createMany` → PostgreSQL commit → `TransactionRepository.findMany`.
- Verify database foreign key constraints (`smeId`, `buyerId`, `supplierId`, `batchId`) and identify any silent rejections or transaction rollbacks.

### REQ-02: Deterministic Duplicate Import & Reconciliation
- Content fingerprinting must calculate a robust SHA-256 hash independent of user-typed labels or version strings.
- Re-importing identical file content within the same organization must return a 409 conflict referencing the existing batch.
- Batch creation must be transactional: an `ImportBatch` must NEVER be committed with status `IMPORTED` if transaction row insertion fails.
- Reconcile `scorecard.acceptedCount`, `scorecard.rejectedCount`, `batch.recordCount`, and `SELECT COUNT(*) FROM "Transaction" WHERE "batchId" = ?`.

### REQ-03: Organization-Scoped Transaction Persistence & Retrieval
- Ensure `Firm` auto-creation creates valid counterparty firms scoped to `organizationId` with no null or empty string foreign keys.
- Ensure `Transaction.supplierId` is `null` when no supplier is present, rather than empty string `""` which fails relational foreign key checks.
- Verify `TransactionRepository.findMany` pagination, filtering, and ordering logic matches frontend query parameters.
- Verify that navigating from Upload success ("View in Transactions") renders the newly imported items immediately.

### REQ-04: Authentic Dashboard & Risk Metric Aggregation
- Compute `totalOutstandingAmount`, `avgPaymentDelayDays`, and `overallRiskIndex` directly from valid records belonging to `organizationId`.
- Distinguish between `PAID` (0 outstanding) and `PENDING`/`DELAYED` (unsettled outstanding balance) invoices.
- Display explicit and helpful empty states (`Not enough data` or zero-state guidance) when an organization has 0 transactions or 0 counterparties.
- Guarantee that real SME organizations never display demo benchmark constants or synthetic placeholder cards.

### REQ-05: Schema-Agnostic Universal Mapping Verification
- Verify that `universalMappingEngine.ts` maps required fields (`transaction_id`, `invoice_amount`, `invoice_date`, `buyer_name`/`buyer_id`, `supplier_name`/`supplier_id`) across at least 3 distinct real formats (e.g. standard B2B invoice, Fulton procurement format, Indian SME Tally export).
- Prevent column collisions and ensure user manual overrides in the UI take precedence with 100% confidence.
- Leave optional columns unmapped when confidence is below 70%, rather than making noisy guesses.

### REQ-06: 100 MB Ingestion Resilience & Error Handling
- Validate that uploads up to 100 MB do not exceed JSON payload limits (250MB limit verified in `app.ts`) or trigger Node event-loop starvation.
- Test malformed CSVs (unbalanced quotes, invalid numeric amounts, impossible dates) and ensure informative row-level rejection reporting.
- Validate that partial batches route invalid rows to quarantine and ingest valid rows cleanly.

### REQ-07: Regression & Browser-Based Verification
- Execute and pass all existing Vitest suites in `server/tests/` without regressions.
- Perform live browser-based verification: log in as an SME organization, upload an authentic invoice CSV, inspect import history, verify transactions list, and confirm updated dashboard metrics.
