# Architecture Decision Records (ADRs) — NEXUS-CFR

## ADR-001: Milestone 2.0 Architectural Ingestion & Analytics Boundaries
- **Date**: 2026-10-11
- **Status**: Accepted
- **Context**:
  Users experienced duplicate batch appearances in Import History, inconsistent record counts between validation and database tables, missing transactions after upload success, and zeroed dashboard metrics.
- **Decision**:
  1. We will NOT rewrite existing frontend views, backend routes, or ML training pipelines.
  2. Batch creation and transaction row insertion must be strictly atomic (wrapped in a transactional unit) so that an `ImportBatch` is never committed if row insertion fails.
  3. Content fingerprinting for duplicate detection must be deterministic based on raw row content and organization ID, rather than relying on mutable UI labels or hardcoded version strings.
  4. Nullable relational references like `supplierId` must be sanitized to `null` rather than empty strings `""` to prevent PostgreSQL foreign key constraint rejections during bulk `createMany`.
  5. The Demo organization (`ORG-001`) must remain completely isolated from real SME tenant organizations; real tenants must never display synthetic benchmark metrics as live balances.
- **Consequences**:
  Ensures predictable, verifiable data integrity across the entire ingestion and reporting lifecycle while protecting existing codebase investments.

---

## ADR-002: Phase 1 Diagnostic Findings & Root Cause Determinations
- **Date**: 2026-10-11
- **Status**: Confirmed by Empirical Audit
- **Context**:
  Empirical database audit via `scratch/audit_db.cjs` and static source analysis executed under Phase 1 to investigate:
  1. Count discrepancy: 180,282 accepted vs 184,888 reported.
  2. Missing transactions on `/app/transactions` after upload.
  3. Dashboard showing 228,425 records ingested but zero risk metrics.
  4. Duplicate batch entries in Import History.
- **Findings & Root Causes**:
  1. **Count Discrepancy Reconciliation (Confirmed Fact)**:
     - Total file rows: 228,425
     - Invalid rows (business rules): 43,537 -> Valid rows: 184,888 (228,425 - 43,537).
     - Intra-batch duplicate IDs on valid rows: 4,606 (`exactDupOnValid`).
     - Accepted rows: 180,282 (184,888 - 4,606).
     - Rejected rows: 48,143 (43,537 + 4,606).
     - **Determination**: Test D reported pre-deduplication validity (`184,888 / 43,537`), whereas Import History reported post-deduplication acceptance (`180,282 / 48,143`).
  2. **Transaction Persistence & Organization Scoping (Confirmed Fact)**:
     - The database contains exactly **180,282 persisted transactions** under Organization `6ee28c8e-1f1c-4c4c-86a9-e45c2897993e` (`Raj`).
     - Organizations created during test/registration flows (such as `Pinnacle Precision Gears`) currently contain **0 transactions**.
     - **Determination**: If a user is authenticated into any organization other than `6ee28c8e-1f1c-4c4c-86a9-e45c2897993e`, the Transactions API legitimately filters by `where: { organizationId }` and returns 0 records.
  3. **Dashboard Metric Decoupling (Confirmed Fact)**:
     - `SmeAdminDashboard.tsx` (L287) renders `batch.recordCount` from `ImportBatch` ("228,425 rows").
     - KPI cards (receivables, delay risk) aggregate from `Transaction` table.
     - In Organization `6ee28c8e-1f1c-4c4c-86a9-e45c2897993e`, 180,121 out of 180,282 rows (99.91%) have `paymentStatus: "PAID"`. Outstanding receivables are only ₹12.89L on ₹235.6Cr volume, and overdue delays are 0.
     - In zero-transaction organizations, KPIs evaluate to "Not enough data" or ₹0 while the Ingestion Health card shows raw batch metadata.
  4. **Duplicate Import Gaps (Confirmed Fact)**:
     - SHA-256 fingerprint generation hashes `metadata.sourceName` and `organizationId`. A change in `sourceName` (e.g. from file name to default label) or cross-tenant upload generates a different fingerprint.
     - `ImportBatch` is created before `createMany` without a surrounding database transaction, creating non-atomic batches.
- **Phase 2 Implementation Directive**:
  1. Implement atomic batch insertion (`prisma.$transaction`).
  2. Refactor content fingerprinting to depend strictly on normalized row data.
  3. Ensure UI session organization ID is clearly surfaced and aligned during file upload.
  4. Reconcile frontend dashboard empty states to show honest indicators when records are absent or all settled.

---

## ADR-003: Phase 2 Duplicate-Import Protection & Count Reconciliation Decisions
- **Date**: 2026-10-11
- **Status**: Implemented & Empirically Verified
- **Context**:
  Phase 2 required reliable duplicate-import protection that ignores filename changes, maintains organization-level tenant isolation, wraps batch and row persistence into an atomic database transaction, and preserves exact count reconciliation (`total = accepted + rejected`).
- **Decisions**:
  1. **Canonical Content Fingerprinting**:
     `generateContentFingerprint(organizationId, rawRows)` deterministically hashes rows by sorting object keys alphabetically and trimming string cell values, prefixed with `org:${organizationId}:count:${rawRows.length}:`. Mutable parameters (e.g. `sourceName`, `datasetVersion`, filenames, timestamps) are strictly excluded from the hash.
  2. **Multi-Tenant Isolation**:
     Because the fingerprint includes `organizationId` and duplicate checks in `ImportBatch` are strictly filtered by `where: { organizationId, status: "IMPORTED" }`, identical files uploaded by distinct organizations produce distinct fingerprints, succeed without conflict, and store isolated transaction records.
  3. **Atomic Interactive Transaction**:
     Wrapped `tx.importBatch.create`, `tx.firm.create`, `tx.firm.createMany`, `tx.transaction.createMany`, and `tx.firm.update` inside `prisma.$transaction(async (tx) => { ... }, { timeout: 120000, maxWait: 15000 })`. If any batch insertion fails, PostgreSQL rolls back all records, preventing orphan batches.
  4. **Strict Count Reconciliation**:
     `QualityAnalyzer.analyze` calculates:
     - `acceptedCount = validRowsCount`
     - `invalidCount = invalidRowsCount`
     - `exactDuplicateOnValidCount`: count of rows passing business rules but rejected for duplicate ID.
     - `rejectedCount = invalidCount + exactDuplicateOnValidCount`
     - `totalRecords = acceptedCount + rejectedCount` (guaranteed equality).
     - Row-level rejection reasons contain both business rule violations and exact duplicate rows (`rule: "EXACT_DUPLICATE"`), avoiding double-counting.
- **Verification Evidence**:
  - `server/tests/phase2_duplicate_and_reconciliation.test.ts`: 9/9 passing tests.
  - `server/tests/phase15_universal_mapping_engine.test.ts`: 25/25 passing tests.
