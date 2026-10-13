---
phase: 1
plan: 2
wave: 2
gap_closure: false
depends_on:
  - 1
---

# Plan 1.2: Database Evidence Gathering & Multi-Tenant Diagnostic Synthesis

## Objective
Collect empirical read-only database state (subject to explicit user approval), trace multi-tenant organization scoping across user authentication, transaction queries, and dashboard metrics, and formally document the verified root causes in `.gsd/DECISIONS.md` without modifying any application code or database records.

## Context
Load these files for context:
- [.gsd/SPEC.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/SPEC.md)
- [.gsd/ROADMAP.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/ROADMAP.md)
- [.gsd/phases/1/1-PLAN.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/phases/1/1-PLAN.md)
- [scratch/audit_db.cjs](file:///c:/Users/rajsa/supply-chain-risk-lens/scratch/audit_db.cjs)
- [server/src/services/transaction.service.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/services/transaction.service.ts)
- [server/src/repositories/transaction.repository.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/repositories/transaction.repository.ts)
- [server/src/services/dashboard.service.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/services/dashboard.service.ts)

## Tasks

<task type="checkpoint:human-verify">
  <name>Explicit Human Approval Checkpoint for Read-Only DB State Query</name>
  <files>
    scratch/audit_db.cjs
  </files>
  <action>
    Present the confirmed read-only audit verification of `scratch/audit_db.cjs` to the user:
    1. Confirm that `scratch/audit_db.cjs` contains only SELECT queries (`findMany`, `count`, `aggregate`, `groupBy`, and a SELECT count query).
    2. Confirm that no credentials, tokens, or connection strings are logged or printed.
    3. Confirm zero database writes, schema changes, or deletes.
    4. Pause and await explicit user permission before executing `node scratch/audit_db.cjs`.
  </action>
  <verify>
    User provides explicit confirmation to proceed with the read-only execution of `scratch/audit_db.cjs`.
  </verify>
  <done>
    Explicit approval received from the user.
  </done>
</task>

<task type="auto">
  <name>Multi-Tenant Scoping, Transaction Retrieval & Dashboard Coupling Diagnosis</name>
  <files>
    server/src/services/transaction.service.ts
    server/src/repositories/transaction.repository.ts
    server/src/services/dashboard.service.ts
    src/components/pages/TransactionsPage.tsx
    src/components/pages/DashboardPage.tsx
    scratch/audit_db.cjs
  </files>
  <action>
    Upon approval, execute `node scratch/audit_db.cjs` to capture the read-only empirical state:
    1. Determine all organizations present in the database, their IDs, and their assigned names.
    2. Inspect all `ImportBatch` records for `Vendor_Payments_20261007.csv`: record their `id`, `organizationId`, `sourceName`, `recordCount`, `acceptedCount`, `rejectedCount`, and `createdAt`. Check if two batches exist and why.
    3. Check `prisma.transaction.count` per organization. Identify whether transactions were written to `6ee28c8e-1f1c-4c4c-86a9-e45c2897993e`, `ORG-001`, or another organization ID.
    4. Trace `TransactionService.getTransactions`: inspect how `where.organizationId` filters the results. If user JWT belongs to Org X, but transactions were imported into Org Y, verify this scoping boundary.
    5. Trace `DashboardService.getSummary` (lines 215-235): verify why dashboard displays 228,425 records ingested (read from `latestBatch.recordCount`) while receivables aggregate to 0 (read from `prisma.transaction.aggregate` where 0 transactions exist for that org).
    6. Ensure NO credentials, secrets, or sensitive connection parameters are outputted or logged.
    
    AVOID: Modifying any database tables or code.
    USE: Read-only inspection and empirical evidence capture.
  </action>
  <verify>
    Empirical output captures total transaction counts, batch IDs, and organization IDs for the imported CSV, confirming or refuting Hypotheses H1, H2, H4, and H5.
  </verify>
  <done>
    Empirical DB evidence captured and cross-referenced with code paths.
  </done>
</task>

<task type="auto">
  <name>Synthesize Diagnostic Findings into ADR & Phase 1 Completion Audit</name>
  <files>
    .gsd/DECISIONS.md
    .gsd/STATE.md
    .gsd/JOURNAL.md
  </files>
  <action>
    Synthesize all findings from Plans 1.1 and 1.2 into a formal diagnostic report:
    1. Rule definitively on each hypothesis (H1: Duplicate batches, H2: Fingerprint gaps, H3: 180,282 vs 184,888 count discrepancy, H4: Zero transactions in UI, H5: Zero dashboard metrics).
    2. Document empirical proof in `.gsd/DECISIONS.md` under ADR-002: "Phase 1 Diagnostic Findings & Root Cause Determinations".
    3. Update `.gsd/STATE.md` with completed Phase 1 diagnostic status and explicit prerequisites for Phase 2.
    4. Log the session in `.gsd/JOURNAL.md`.
    
    AVOID: Starting Phase 2 or editing application code.
    USE: Fact-based, evidence-backed documentation.
  </action>
  <verify>
    Verify that `.gsd/DECISIONS.md` contains clear evidence for each observed defect and that `.gsd/STATE.md` reflects Phase 1 audit completion.
  </verify>
  <done>
    Diagnostic report finalized and documented in GSD state files.
  </done>
</task>

## Must-Haves
After tasks complete, verify:
- [ ] Explicit human checkpoint honored before running `scratch/audit_db.cjs`.
- [ ] Exact organization ID of the upload determined from database batch records.
- [ ] Root causes of duplicate batch, count discrepancy, empty transactions page, and zeroed dashboard metrics confirmed with empirical evidence.
- [ ] Zero application code, database records, schema, or configuration files modified.

## Success Criteria
- [ ] All 3 tasks executed with full empirical evidence.
- [ ] Phase 1 completion report ready to guide Phase 2 implementation planning.
