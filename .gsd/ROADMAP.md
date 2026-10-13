# ROADMAP.md — Milestone 2.0: Ingestion, Persistence & Analytics Correctness

> **Current Phase**: Phase 3: Relational Persistence & Organization-Scoped Retrieval
> **Milestone**: v2.0
> **System Baseline**: v1.6.0

## Must-Haves (from SPEC)
- [x] No silent duplicate import of identical content within the same organization.
- [x] Consistent, explainable validation, import history, and database transaction counts.
- [ ] Uploaded records visible and paginated on the organization-scoped Transactions page.
- [ ] Dashboard KPIs calculated exclusively from valid, persisted organization records.
- [ ] Transparent, honest empty states when data is absent or insufficient.
- [x] Demo (`ORG-001`) and real SME organization data strictly isolated.
- [ ] Full test pass and live browser verification of the complete upload-to-dashboard workflow.

---

## Phases

### Phase 1: Ingestion & Analytics Diagnostic Audit
- **Status**: 🟢 Complete
- **Objective**: Conduct a forensic inspection into why successful file uploads produce empty transaction lists and zeroed dashboard metrics, verifying schema constraints, database state, and payload pipelines.
- **Requirements**: REQ-01
- **Likely Modules & Files**:
  - `server/src/pipeline/pipelineOrchestrator.ts`
  - `server/src/controllers/upload.controller.ts`
  - `server/src/services/upload.service.ts`
  - `server/src/repositories/transaction.repository.ts`
  - `server/src/services/dashboard.service.ts`
  - `server/prisma/schema.prisma`
  - `scratch/audit_db.cjs`
- **Root-Cause Investigation Steps**:
  1. Inspect `ImportBatch` vs `Transaction` counts in the database to see if `createMany` failed after `importBatch.create`.
  2. Inspect foreign key values (`smeId`, `buyerId`, `supplierId`) generated during bulk ingestion to verify relational validity in PostgreSQL.
  3. Inspect JWT organization scoping in the frontend session versus backend query filters.
- **Expected Behavior**: Documented diagnostic matrix identifying the exact code lines and relational conditions responsible for silent failure or missing data.
- **Automated & Manual Verification**:
  - Run read-only database query script (`node scratch/audit_db.cjs`) to inspect records per organization.
  - Integration diagnostic test validating error handling during `createMany`.
- **Dependencies & Risks**: None; diagnostic only.
- **Objective Acceptance Criteria**:
  - Root cause for missing transactions, duplicate batches, and zero metrics is identified and documented in `.gsd/DECISIONS.md`.

---

### Phase 2: Duplicate-Import Protection & Count Reconciliation
- **Status**: 🟢 Complete
- **Objective**: Implement robust, deterministic duplicate detection and atomic batch insertion so batches are never created twice or recorded with conflicting row counts.
- **Requirements**: REQ-02
- **Likely Modules & Files**:
  - `server/src/pipeline/pipelineOrchestrator.ts`
  - `server/src/pipeline/controlledFileIngestionService.ts`
  - `server/src/controllers/upload.controller.ts`
  - `src/components/pages/UploadPage.tsx`
  - `src/services/dataServices.ts`
- **Root-Cause Investigation Steps**:
  1. Fix SHA-256 content fingerprinting to hash canonical row contents, ignoring transient UI inputs like `datasetVersion = "2026.Q3"`.
  2. Wrap batch creation and transaction insertion in a Prisma transaction (`prisma.$transaction`) so batch records are never committed if transaction insertion fails.
  3. Ensure count definitions are strictly harmonized: `acceptedCount + rejectedCount = totalCount`.
- **Expected Behavior**:
  - Re-uploading the exact same CSV returns HTTP 409 Conflict with clear UI notification.
  - Import History displays exactly one batch per distinct file upload with reconciled counts.
- **Automated & Manual Verification**:
  - Vitest test attempting duplicate upload of identical CSV payload asserting HTTP 409.
  - Count consistency test asserting `batch.acceptedCount === transactions.length`.
- **Dependencies & Risks**: Relies on findings from Phase 1.
- **Objective Acceptance Criteria**:
  - Identical file upload rejected with 409; Import History displays zero duplicate batches; counts match across validation and DB.

---

### Phase 3: Relational Persistence & Organization-Scoped Transaction Retrieval
- **Status**: ⬜ Not Started
- **Objective**: Ensure counterparty firms and transaction records are correctly resolved and committed in PostgreSQL, and immediately retrieved by the Transactions API and UI.
- **Requirements**: REQ-03
- **Likely Modules & Files**:
  - `server/src/pipeline/pipelineOrchestrator.ts`
  - `server/src/repositories/transaction.repository.ts`
  - `server/src/services/transaction.service.ts`
  - `src/components/pages/TransactionsPage.tsx`
  - `src/services/dataServices.ts`
- **Root-Cause Investigation Steps**:
  1. Fix firm auto-resolution so `supplierId` is `null` (not `""`) when unassigned, preventing PostgreSQL foreign key failure.
  2. Verify that `Firm` records for buyers and SMEs are created within the active `organizationId` before transaction rows are inserted.
  3. Ensure `TransactionRepository.findMany` pagination, sort fields, and search queries correctly match the frontend parameters.
- **Expected Behavior**:
  - Ingested records persist reliably with relational integrity.
  - The Transactions page immediately displays all rows belonging to the active organization.
- **Automated & Manual Verification**:
  - API tests verifying `POST /api/upload/import` followed by `GET /api/transactions` returns full items array.
  - Multi-tenant test verifying Organization A cannot see Organization B's transactions.
- **Dependencies & Risks**: Depends on Phase 2 atomic batch insertion.
- **Objective Acceptance Criteria**:
  - 100% of accepted rows persist to `Transaction` table; Transactions page lists all imported records with correct buyer/supplier names.

---

### Phase 4: Honest Dashboard & Risk Aggregation
- **Status**: ⬜ Not Started
- **Objective**: Ensure executive dashboard KPIs, payment delay risk, working capital stress, and outstanding receivables reflect authentic persisted records, with honest empty states when data is absent.
- **Requirements**: REQ-04
- **Likely Modules & Files**:
  - `server/src/services/dashboard.service.ts`
  - `server/src/controllers/dashboard.controller.ts`
  - `src/components/pages/DashboardPage.tsx`
  - `src/components/dashboard/SmeAdminDashboard.tsx`
  - `src/components/dashboard/AnalystDashboard.tsx`
  - `src/services/analyticsServices.ts`
- **Root-Cause Investigation Steps**:
  1. Ensure `totalOutstandingAmount` is aggregated accurately from unsettled (`PENDING`, `DELAYED`, `CRITICAL`) invoices.
  2. Ensure `overallRiskIndex`, delay days, and counterparty stress are calculated from the organization's real transaction pool.
  3. Provide clean, transparent empty states when an organization has 0 transactions without showing demo benchmark data.
- **Expected Behavior**:
  - Dashboard displays accurate non-zero receivables and risk distributions for organizations with active invoices.
  - Zero-data organizations display clear "Not enough data" notices rather than misleading zeroes or fake scores.
- **Automated & Manual Verification**:
  - Vitest test validating `GET /api/dashboard/summary` against known test transactions.
  - Empty-state test verifying zero-data organization returns honest empty indicators.
- **Dependencies & Risks**: Depends on Phase 3 persistence.
- **Objective Acceptance Criteria**:
  - Dashboard receivables and risk metrics match database aggregates; empty organizations display honest empty states.

---

### Phase 5: Schema-Agnostic Universal Mapping Validation
- **Status**: ⬜ Not Started
- **Objective**: Verify that the Universal Mapping Engine autonomously detects headers, dates, amounts, and parties across diverse real-world B2B schemas without dataset-specific hardcoding.
- **Requirements**: REQ-05
- **Likely Modules & Files**:
  - `server/src/pipeline/universalMappingEngine.ts`
  - `server/src/pipeline/schemaDetector.ts`
  - `src/components/pages/UploadPage.tsx`
  - `src/services/dataServices.ts`
- **Root-Cause Investigation Steps**:
  1. Validate against at least 3 distinct schemas: B2B invoice export (`b2b_invoices_real.csv`), Fulton county procurement data, and generic multi-currency CSV.
  2. Verify that user overrides via the UI always supersede auto-detected candidates.
  3. Ensure low-confidence optional fields are left unmapped.
- **Expected Behavior**:
  - Universal mapping correctly identifies required fields across distinct formats with zero manual code branching.
- **Automated & Manual Verification**:
  - Unit tests in `server/tests/phase15_universal_mapping_engine.test.ts` running against distinct real datasets.
- **Dependencies & Risks**: None.
- **Objective Acceptance Criteria**:
  - All 3 test datasets achieve >=90% automatic mapping accuracy for required fields without dataset-specific conditional hacks.

---

### Phase 6: 100 MB Large-File Stress Testing & Error Reporting
- **Status**: ⬜ Not Started
- **Objective**: Verify that the platform handles files up to 100 MB reliably, rejects malformed files with actionable line numbers, and quarantines defective records safely.
- **Requirements**: REQ-06
- **Likely Modules & Files**:
  - `server/src/middleware/uploadLimit.middleware.ts`
  - `server/src/pipeline/controlledFileIngestionService.ts`
  - `server/src/pipeline/quarantineService.ts`
  - `src/components/pages/UploadPage.tsx`
- **Root-Cause Investigation Steps**:
  1. Stress-test stream and chunked ingestion with large payload files (up to 100 MB).
  2. Test edge cases: files with invalid date formats, missing amounts, negative totals, and unescaped quotes.
  3. Ensure user receives clear feedback if a file exceeds 100 MB or contains malformed lines.
- **Expected Behavior**:
  - Large files process smoothly within memory limits; invalid lines are reported with row numbers and quarantined.
- **Automated & Manual Verification**:
  - Vitest test simulating 100 MB boundary payload and malformed CSV rows.
- **Dependencies & Risks**: Depends on Phase 2 & 3.
- **Objective Acceptance Criteria**:
  - 100 MB test file completes without memory exhaustion; malformed rows report specific line numbers and error codes.

---

### Phase 7: Regression Testing & End-to-End Browser Flow Verification
- **Status**: ⬜ Not Started
- **Objective**: Execute the complete test suite and perform live browser verification of the user journey from login to upload, transaction viewing, and dashboard inspection.
- **Requirements**: REQ-07
- **Likely Modules & Files**:
  - Entire application frontend and backend.
  - `server/tests/*.test.ts`
- **Root-Cause Investigation Steps**:
  1. Run the entire backend test suite (`npm run test` in `server/`).
  2. Launch Vite frontend and Express backend.
  3. Use browser subagent to execute live flow: login as SME Admin, upload authentic CSV, inspect Import History, verify Transactions table, and verify Dashboard metrics.
- **Expected Behavior**:
  - All automated tests pass green; browser flow shows seamless data upload and immediate dashboard reflection.
- **Automated & Manual Verification**:
  - Full Vitest test suite output.
  - Browser subagent WebP recording and DOM inspection.
- **Dependencies & Risks**: Depends on completion of Phases 1 through 6.
- **Objective Acceptance Criteria**:
  - 100% tests pass; browser recording captures complete end-to-end user journey with confirmed data persistence and analytics.
