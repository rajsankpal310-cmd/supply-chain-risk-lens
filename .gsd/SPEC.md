# SPEC.md — Project Specification: Milestone 2.0 (End-to-End Ingestion, Persistence & Analytics Correctness)

> **Status**: `FINALIZED`
> **Milestone**: v2.0
> **System Baseline**: v1.6.0
> **Target Scope**: End-to-End Upload, Persistence, Multi-Tenant Data Isolation, and Dashboard Analytics Correctness

---

## Vision
Transform NEXUS-CFR into a robust, deterministic, end-to-end verified platform where real SME transaction ledgers uploaded via CSV/Excel are accurately parsed through universal schema mapping, reliably persisted in organization-scoped storage without silent failure or duplicate batches, reflected immediately in transaction views, and honestly aggregated into executive risk and liquidity analytics.

---

## Goals
1. **Deterministic Ingestion & Duplicate Protection**: Prevent duplicate imports of identical file content within the same organization while providing unambiguous, reconciled counts across validation, import batch history, and database tables.
2. **Reliable Relational Persistence & Visibility**: Ensure all validated rows are persisted in PostgreSQL with correct entity resolutions (buyer, supplier, SME) and can be queried and paginated immediately by the authenticated organization on the Transactions page.
3. **Truthful & Transparent Analytics**: Compute dashboard KPIs, cash-flow stress, and risk metrics solely from verified, persisted organization data, displaying clear, honest empty states when data is absent or insufficient without fabricating scores or leaking demo benchmarks.
4. **Resilient Schema Mapping & Large Payload Handling**: Guarantee that the Universal Mapping Engine handles diverse real-world B2B invoice layouts without dataset-specific hardcoding, and securely processes file uploads up to 100 MB.
5. **Zero Regression & Multi-Tenant Isolation**: Maintain complete physical and logical isolation between Demo (`ORG-001`) and real SME organizations, ensuring existing RBAC, ML governance, and connector APIs remain intact.

---

## Non-Goals (Out of Scope for this Milestone)
- Redesigning the existing frontend visual theme or migrating UI component libraries.
- Rewriting working ML training routines, BPI event log pipelines, or optimization algorithms.
- Adding third-party payment gateways, bank statement parsers, or billing integrations.
- Replacing Prisma ORM or Express architecture with alternate server runtimes.
- Merging real SME customer data into demo datasets or benchmarks.

---

## Users & Personas
- **SME Admin / Finance Officer**: Uploads monthly accounting ledgers (CSV/XLSX), reviews schema mappings, verifies invoice reconciliation, and inspects working capital risk and payment delays.
- **Supply Chain Risk Analyst**: Investigates counterparty risk distribution, drill downs into multi-tier dependencies, and evaluates stress scenarios on confirmed transaction graphs.
- **Executive Viewer / Board Member**: Consumes high-level portfolio health, overdue receivable exposure, and supply-chain cascade vulnerability metrics.

---

## Constraints
- **Stack Consistency**: TanStack Start / React 19 frontend, Express 4.x / TypeScript backend, Prisma ORM 6.x, PostgreSQL (Supabase) persistence.
- **Upload Scale**: Support single file uploads up to 100 MB with graceful memory and validation management.
- **Data Integrity**: Never fabricate metrics, synthetic fallbacks, or unverified ML performance in real tenant organizations.
- **Multi-Tenant Scoping**: All queries must strictly scope to `req.user.organizationId` with no leakage across organizations.

---

## Success Criteria
- [ ] Uploading identical content in the same organization rejects with HTTP 409 and explains the duplicate batch to the user.
- [ ] Validation summary, import history batch cards, and database table row counts match with zero unexplained variance.
- [ ] Every successfully imported transaction appears on `/app/transactions` under the uploading organization.
- [ ] Dashboard displays non-zero receivables and authentic risk indicators whenever valid, unsettled invoices exist.
- [ ] Dashboards show informative empty states (`Not enough data` / empty indicators) when an organization has 0 transactions.
- [ ] Diverse real-world invoice formats (e.g. B2B invoices, Fulton county exports, Indian SME formats) map accurately without hardcoded dataset rules.
- [ ] Files up to 100 MB process or reject cleanly with proper user feedback and zero process crashes.
- [ ] Complete Vitest test suite passes and end-to-end browser verification confirms ledger upload through dashboard rendering.
