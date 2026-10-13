---
phase: 1
plan: 1
wave: 1
gap_closure: false
depends_on: []
---

# Plan 1.1: Read-Only Code, Artifact & Validation Arithmetic Audit

## Objective
Perform a comprehensive, read-only static analysis across the pipeline codebase, test scripts, and historical artifacts to investigate the count discrepancy (`180,282 / 48,143` vs `184,888 / 43,537`) and trace the exact code paths responsible for potential duplicate imports and foreign-key insertion failures without executing any database mutations.

## Context
Load these files for context:
- [.gsd/SPEC.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/SPEC.md)
- [.gsd/ROADMAP.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/ROADMAP.md)
- [server/src/pipeline/pipelineOrchestrator.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/pipeline/pipelineOrchestrator.ts)
- [server/src/pipeline/businessValidator.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/pipeline/businessValidator.ts)
- [server/src/pipeline/duplicateDetector.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/pipeline/duplicateDetector.ts)
- [scratch/analyze_fulton_rules.cjs](file:///c:/Users/rajsa/supply-chain-risk-lens/scratch/analyze_fulton_rules.cjs)

## Tasks

<task type="auto">
  <name>Audit Validation vs Rejection Arithmetic & Scorecard Math</name>
  <files>
    server/src/pipeline/pipelineOrchestrator.ts
    server/src/pipeline/businessValidator.ts
    server/src/pipeline/duplicateDetector.ts
    server/src/pipeline/qualityAnalyzer.ts
    scratch/analyze_fulton_rules.cjs
  </files>
  <action>
    Analyze the exact arithmetic flow connecting raw row validation to the final QualityScorecard:
    1. Inspect how `BusinessValidator.validateRows` categorizes valid vs invalid rows (yielding 184,888 valid and 43,537 invalid rows on Fulton dataset).
    2. Inspect how `DuplicateDetector.checkDuplicates` identifies intra-batch duplicate transaction IDs and exact duplicate rows.
    3. Trace how `PipelineOrchestrator.validate` maps `valResults` and `dupResults` into `rowResults` (checking line 69: `isValid: v.isValid && !isExact`).
    4. Verify the exact mathematical relationship:
       - Total rows = 228,425
       - Invalid rows = 43,537
       - Valid rows = 184,888
       - Exact duplicate rows among valid = 4,606 (`exactDupOnValid`)
       - Accepted rows = 180,282 (184,888 - 4,606)
       - Total rejected = 48,143 (43,537 invalid + 4,606 duplicates)
    5. Document where the discrepancy arose between Test D (which reported pre-deduplication validity: 184,888) and Import History (which reported post-deduplication acceptance: 180,282).
    
    AVOID: Modifying any validation or deduplication code.
    USE: Read-only inspection of source code and calculation logic.
  </action>
  <verify>
    Confirm via code trace that `acceptedCount (180,282) + rejectedCount (48,143) === totalRecords (228,425)` and that `validRows (184,888) - exactDuplicates (4,606) === acceptedRows (180,282)`.
  </verify>
  <done>
    Mathematical proof reconciling the 4,606-row delta is documented in the audit notes.
  </done>
</task>

<task type="auto">
  <name>Audit Ingestion Pipeline & Foreign Key Code Paths</name>
  <files>
    server/src/pipeline/pipelineOrchestrator.ts
    server/src/services/upload.service.ts
    server/src/controllers/upload.controller.ts
    server/prisma/schema.prisma
  </files>
  <action>
    Trace the execution flow of `PipelineOrchestrator.executeImport` from request reception to database write:
    1. Trace lines 93-131: Inspect the SHA-256 fingerprint generation logic and evaluate why `existingBatch` matching might fail or permit duplicate batch records (e.g. `b.datasetVersion` vs `contentFingerprint`).
    2. Trace lines 157-178: Inspect the creation of `ImportBatch` (created with status `IMPORTED` *before* `prisma.transaction.createMany` executes). Check what happens if a subsequent error occurs during transaction chunk insertion.
    3. Trace lines 201-295: Inspect counterparty firm auto-creation and collision resolution. Verify if firms are committed before transactions.
    4. Trace lines 320-360: Inspect transaction record preparation, specifically how unassigned `supplierId` is handled (e.g. `row.supplierId ? ... : null` vs `""`). Check `schema.prisma` foreign key constraints (`@relation("SupplierFirm", fields: [supplierId], references: [id])`).
    5. Evaluate whether `prisma.transaction.createMany` wrapped in chunks of 2,500 without a top-level Prisma transaction leaves orphan batches upon failure.
    
    AVOID: Making code changes or running write operations.
    USE: Exact line-by-line static analysis citing specific file lines and failure mechanics.
  </action>
  <verify>
    Verify whether `supplierId` can ever evaluate to an empty string `""` or invalid foreign key, and whether `executeImport` rolls back `ImportBatch` if `prisma.transaction.createMany` fails.
  </verify>
  <done>
    Clear structural diagnosis of potential failure points in `executeImport` documented with file lines.
  </done>
</task>

## Must-Haves
After tasks complete, verify:
- [ ] 100% mathematical reconciliation of 180,282 vs 184,888 documented with zero ambiguity.
- [ ] Ingestion failure modes and duplicate fingerprinting gaps in `pipelineOrchestrator.ts` mapped with line numbers.
- [ ] Zero application code, database records, or configuration files modified.

## Success Criteria
- [ ] Both diagnostic tasks completed via read-only inspection.
- [ ] Findings prepared for synthesis with database audit evidence in Plan 1.2.
