# Project TODOs — NEXUS-CFR

## Pending Tasks (Milestone 2.0)
- [ ] Phase 1: Ingestion & Analytics Diagnostic Audit
  - [ ] Execute read-only database audit to inspect `ImportBatch` vs `Transaction` state.
  - [ ] Trace `createMany` failure modes and foreign key resolution in `PipelineOrchestrator`.
  - [ ] Document verified root causes in `.gsd/DECISIONS.md`.
- [ ] Phase 2: Duplicate-Import Protection & Count Reconciliation
  - [ ] Fix SHA-256 fingerprint generation to be content-derived.
  - [ ] Atomic batch and transaction ingestion inside Prisma transaction.
  - [ ] Reconcile counts across validation, batch cards, and database.
- [ ] Phase 3: Relational Persistence & Organization-Scoped Transaction Retrieval
  - [ ] Sanitize unassigned `supplierId` to `null`.
  - [ ] Ensure counterparty firms are safely resolved under tenant `organizationId`.
  - [ ] Verify immediate visibility on `/app/transactions`.
- [ ] Phase 4: Honest Dashboard & Risk Aggregation
  - [ ] Calculate outstanding receivables and risk scores from live tenant transactions.
  - [ ] Render clean empty states when 0 transactions exist.
- [ ] Phase 5: Schema-Agnostic Universal Mapping Validation
  - [ ] Verify mapping accuracy across 3 distinct CSV/Excel formats.
  - [ ] Ensure manual column overrides take absolute precedence.
- [ ] Phase 6: 100 MB Large-File Stress Testing & Error Reporting
  - [ ] Test 100 MB payload boundaries and verify row-level error reporting.
- [ ] Phase 7: Regression Testing & End-to-End Browser Flow Verification
  - [ ] Run full Vitest suite.
  - [ ] Execute browser subagent recording covering upload to dashboard journey.
