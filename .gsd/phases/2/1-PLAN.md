---
phase: 2
plan: 1
wave: 1
gap_closure: false
depends_on: []
---

# Plan 2.1: Canonical Content Fingerprinting & Atomic Ingestion Pipeline

## Objective
Implement reliable duplicate-import protection that calculates a canonical SHA-256 fingerprint based strictly on normalized row content and organization ID (ignoring mutable filenames or UI source labels), and make batch creation and transaction insertion fully atomic via Prisma transactions so failures never commit orphan batches.

## Context
Load these files for context:
- [.gsd/SPEC.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/SPEC.md)
- [.gsd/ROADMAP.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/ROADMAP.md)
- [.gsd/DECISIONS.md](file:///c:/Users/rajsa/supply-chain-risk-lens/.gsd/DECISIONS.md)
- [server/src/pipeline/pipelineOrchestrator.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/pipeline/pipelineOrchestrator.ts)
- [server/src/pipeline/qualityAnalyzer.ts](file:///c:/Users/rajsa/supply-chain-risk-lens/server/src/pipeline/qualityAnalyzer.ts)

## Tasks

<task type="auto">
  <name>Implement Canonical Normalized Content Fingerprinting</name>
  <files>
    server/src/pipeline/pipelineOrchestrator.ts
  </files>
  <action>
    Refactor fingerprint generation in `PipelineOrchestrator.executeImport` (and a reusable helper `generateContentFingerprint`):
    1. Base the hash strictly on:
       - `organizationId` (guaranteeing organization isolation: identical files uploaded by Org A and Org B produce distinct fingerprints and remain private).
       - Canonical normalized row content: sort keys of each row, sample or stream rows deterministically across the dataset.
       - Raw row count (`rawRows.length`).
    2. Explicitly EXCLUDE mutable external labels from the hash:
       - DO NOT include `metadata?.sourceName` or fallback `"Direct CSV Ingestion"`.
       - DO NOT include `metadata?.datasetVersion`.
       - DO NOT include transient timestamps.
    3. Update duplicate detection query:
       - Find existing batches in the same `organizationId` with `status: "IMPORTED"`.
       - Match against `datasetVersion === contentFingerprint` OR `qualityReport` containing `contentFingerprint` (checking parsed JSON `report.contentFingerprint`).
       - If an existing batch has transactions > 0, reject with HTTP 409 conflict and informative error message.
       - If an existing batch has 0 transactions (from an interrupted prior run), clean it up.
    4. When persisting `ImportBatch`:
       - Always store `contentFingerprint` inside `scorecard.contentFingerprint` and store it in `datasetVersion` if `metadata?.datasetVersion` is not a custom version.
    
    AVOID: Including `sourceName` or filenames in the fingerprint hash.
    USE: Deterministic key-sorted JSON hashing scoped to `organizationId`.
  </action>
  <verify>
    Verify that two uploads with different `sourceName` (e.g. "file1.csv" and "renamed.csv") having identical rows generate the exact same fingerprint in the same organization, but different fingerprints across different organizations.
  </verify>
  <done>
    Canonical fingerprinting implemented and verified without sensitivity to filename or source label changes.
  </done>
</task>

<task type="auto">
  <name>Atomic Batch Creation & Transaction Row Insertion via prisma.$transaction</name>
  <files>
    server/src/pipeline/pipelineOrchestrator.ts
  </files>
  <action>
    Refactor `PipelineOrchestrator.executeImport` so that batch creation, firm resolution, and transaction row inserts execute inside an atomic interactive transaction (`prisma.$transaction`):
    1. Wrap steps 3, 4, 5, and 6 inside `prisma.$transaction(async (tx) => { ... }, { timeout: 120000, maxWait: 15000 })`.
    2. Replace all root `prisma.` calls inside the execution block with the transactional client `tx.`:
       - `tx.importBatch.create(...)`
       - `tx.firm.create(...)` / `tx.firm.createMany(...)`
       - `tx.transaction.createMany(...)`
       - `tx.firm.update(...)`
    3. If any step throws an error, fails a database constraint, or times out, the entire transaction rolls back automatically in PostgreSQL.
    4. Ensure the error is caught and re-thrown with clear status codes (`409`, `422`, or `500`) without creating orphan batch records with status `IMPORTED` and 0 transactions.
    
    AVOID: Creating `ImportBatch` outside of the database transaction.
    USE: `prisma.$transaction` with appropriate timeout for bulk operations.
  </action>
  <verify>
    Simulate or verify that if `transaction.createMany` fails during insertion, `ImportBatch` is not found in the database (rolled back).
  </verify>
  <done>
    Ingestion pipeline is 100% atomic: either the batch and all accepted transactions are committed together, or nothing is committed.
  </done>
</task>

## Must-Haves
After tasks complete, verify:
- [x] Changing a filename does not bypass duplicate import protection.
- [x] Identical content uploaded to different organizations is permitted and isolated.
- [x] Failed transaction writes roll back the `ImportBatch` completely.

## Success Criteria
- [x] Canonical fingerprinting and atomic transactions active in `pipelineOrchestrator.ts`.
