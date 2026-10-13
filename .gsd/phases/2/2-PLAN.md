---
phase: 2
plan: 2
wave: 2
gap_closure: false
depends_on:
  - 1
---

# Plan 2.2: Count Reconciliation & Multi-Tenant Regression Test Suite

## Objective
Preserve accurate, reconciled count calculations across validation and import reporting (`total = accepted + rejected`), ensure invalid rows and exact duplicate rows are clearly distinguished in scorecards without double-counting, and author a comprehensive Vitest regression test suite verifying all Phase 2 guarantees.

## Context
Load these files for context:
- [.gsd/SPEC.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/SPEC.md)
- [.gsd/ROADMAP.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/ROADMAP.md)
- [server/src/pipeline/qualityAnalyzer.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/pipeline/qualityAnalyzer.ts)
- [server/src/pipeline/pipelineOrchestrator.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/pipeline/pipelineOrchestrator.ts)
- [server/src/controllers/upload.controller.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/controllers/upload.controller.ts)

## Tasks

<task type="auto">
  <name>Preserve Transparent Count Reconciliation in QualityAnalyzer</name>
  <files>
    server/src/pipeline/qualityAnalyzer.ts
    server/src/pipeline/pipelineOrchestrator.ts
  </files>
  <action>
    Enhance `QualityScorecard` and `QualityAnalyzer.analyze`:
    1. Reconcile counts strictly:
       - `totalRecords = acceptedCount + rejectedCount`.
       - `invalidCount`: count of rows failing business validation (`!res.isValid`).
       - `exactDuplicateCount`: total rows flagged as exact duplicates.
       - `exactDuplicateOnValidCount`: rows that passed business validation but were rejected solely because of exact duplicate ID.
       - `acceptedCount`: `validationResults.filter(r => r.isValid && !isExactMap.get(r.rowNum)).length`.
       - `rejectedCount`: `totalRecords - acceptedCount` === `invalidCount + exactDuplicateOnValidCount`.
    2. Ensure duplicate rows that would otherwise be valid have an explicit entry in `rejectionReasons` with `rule: "EXACT_DUPLICATE"` so row-level rejection reasons are fully accounted for.
    3. Ensure no row is counted twice in `rejectedCount`.
    
    AVOID: Altering the fundamental business validation rules.
    USE: Additive transparency in `QualityScorecard` properties and clean error recording.
  </action>
  <verify>
    Verify that in all cases `acceptedCount + rejectedCount === totalRecords` and that `rejectionReasons` reflects both invalid and duplicate rows.
  </verify>
  <done>
    Count reconciliation is mathematically guaranteed and fully transparent in scorecard outputs.
  </done>
</task>

<task type="auto">
  <name>Author & Execute Comprehensive Phase 2 Vitest Regression Suite</name>
  <files>
    server/tests/phase2_duplicate_and_reconciliation.test.ts
  </files>
  <action>
    Create a dedicated, end-to-end integration test suite in `server/tests/phase2_duplicate_and_reconciliation.test.ts`:
    1. Test 1: Identical content with different filenames (`fileA.csv` vs `fileB_renamed.csv`) in same organization -> First succeeds (201), second is rejected with 409 Conflict.
    2. Test 2: Identical content uploaded twice to the same organization -> First succeeds (201), second is rejected with 409 Conflict with batch ID cited.
    3. Test 3: Identical content uploaded by two different organizations (Org X and Org Y) -> Both succeed (201) with distinct batches and isolated transaction records.
    4. Test 4: Atomic rollback on database failure -> Simulate failure in transaction insertion, assert that `ImportBatch` is not committed or left with status IMPORTED and 0 transactions.
    5. Test 5: Count reconciliation -> Upload file with mixed valid, invalid, and duplicate rows; assert `totalRecords === acceptedCount + rejectedCount`, and assert `batch.acceptedCount === transactionsCountInDb`.
    6. Execute the test suite using `npm run test -- server/tests/phase2_duplicate_and_reconciliation.test.ts` or vitest.
    
    AVOID: Calling real external services or mocking away Prisma without testing the real database path.
    USE: Supertest / Vitest with test organization accounts and clean assertions.
  </action>
  <verify>
    Run `npx vitest run server/tests/phase2_duplicate_and_reconciliation.test.ts` and verify all tests pass green.
  </verify>
  <done>
    All regression tests pass with concrete assertion evidence.
  </done>
</task>

## Must-Haves
After tasks complete, verify:
- [x] Vitest test suite passes 100% with real assertion output.
- [x] Reconciled counts verified in tests (`total === accepted + rejected`).
- [x] No regression in existing test suites.

## Success Criteria
- [x] Phase 2 guarantees fully validated by automated tests.
