# NEXUS-CFR — Master Test Case Sheet (TC-001 to TC-020)

**Project:** NEXUS-CFR — SME Financial Risk & Supply Chain Resilience  
**Repository:** `supply-chain-risk-lens`  
**Test Suite File:** [`server/tests/full_test_sheet_execution.test.ts`](file:///c:/Users/rajsa/supply-chain-risk-lens/server/tests/full_test_sheet_execution.test.ts)  
**Execution Environment:** Node.js v20.x / Vitest 3.0 / Supabase PostgreSQL / Express API  
**Status Date:** 2026-10-16  
**Overall Execution Result:** **20 / 20 PASSED (100%)**

---

## Section A: Data Input and Validation

### TC-001 — Standard Valid Format Ingestion
- **Module:** Ingestion Pipeline / Data Pipeline
- **Previous Status:** Passed
- **Test Objective:** Ingest standard compliant transaction records via multipart CSV / JSON payload.
- **Preconditions:** Authenticated tenant organization context (`Bearer <JWT>`).
- **Test Steps:**
  1. Prepare structured batch of valid transaction records conforming to data schema (`transaction_id`, `sme_id`, `buyer_id`, `amount`, `currency`, `issue_date`, `due_date`, `status`).
  2. Send `POST /api/upload/validate` to inspect schema parsing.
  3. Send `POST /api/upload/import` to commit dataset to database.
- **Expected Result:** HTTP 200 on validation and HTTP 201 on import; all records ingested; import scorecard generated with 0 rejections.
- **Actual Result:** HTTP 200 / HTTP 201 received. 3 valid transactions successfully ingested into database with 0 rejections.
- **Final Status:** **PASS**

---

### TC-002 — Missing Mandatory Fields
- **Module:** Ingestion Pipeline / Data Validation
- **Previous Status:** Blocked / Failed
- **Test Objective:** Verify that upload payloads missing required fields (`amount`, `buyer_id`, or `due_date`) are caught immediately without silent data corruption.
- **Preconditions:** Authenticated tenant session.
- **Test Steps:**
  1. Construct records lacking `amount` and `buyer_id`.
  2. Submit records to `POST /api/upload/validate`.
  3. Submit records to `POST /api/upload/import`.
- **Expected Result:** Pipeline catches missing mandatory fields; scorecard records rejections with descriptive field error messages; invalid rows are excluded from transaction tables.
- **Actual Result:** Validation catches missing fields (`amount`, `buyer_id`); import records `rejected: 2`, `imported: 0`. Database ledger preserved without partial rows.
- **Final Status:** **PASS**

---

### TC-003 — Invalid Amount and Temporal Date Inversion
- **Module:** Ingestion Pipeline / Data Validation
- **Previous Status:** Blocked / Failed
- **Test Objective:** Test negative transaction amounts and inverted temporal sequences (`due_date` occurring before `issue_date`).
- **Preconditions:** Authenticated tenant session.
- **Test Steps:**
  1. Upload CSV/JSON row with negative amount (`-50000`).
  2. Upload row where `issue_date` is `2026-05-01` and `due_date` is `2026-01-01`.
  3. Send to ingestion endpoints.
- **Expected Result:** Validation engine flags anomalies; non-positive amounts and chronologically inverted dates are rejected with explicit validation reasons.
- **Actual Result:** Both records flagged with validation error reasons (`negative amount`, `due_date cannot precede issue_date`); `rejected: 2`, `imported: 0`.
- **Final Status:** **PASS**

---

### TC-005 — Duplicate and Inconsistent Records
- **Module:** Ingestion Pipeline / Deduplication & Normalization
- **Previous Status:** Blocked / Partially Verified
- **Test Objective:** Upload duplicate transaction rows within the same batch and across consecutive batches; verify duplicate detection and normalization.
- **Preconditions:** Authenticated tenant session.
- **Test Steps:**
  1. Upload duplicate rows sharing identical `transaction_id` (`TXN-DUP-001`) with formatted currency strings (`$12,500.50`).
  2. Inspect deduplication ledger and import scorecard.
- **Expected Result:** Only one instance of the transaction is imported; duplicate count reflects 1 duplicate identified; amount is normalized to numeric `12500.5`.
- **Actual Result:** `imported: 1`, `duplicates: 1`. Deduplication engine reconciles duplicate row; numeric value stored cleanly.
- **Final Status:** **PASS**

---

### TC-018 — Empty or Unsupported File Handling
- **Module:** Ingestion Pipeline / File Security & Validation
- **Previous Status:** Blocked / Failed
- **Test Objective:** Submit empty files, zero-row arrays, and malformed non-tabular payloads.
- **Preconditions:** Authenticated tenant session.
- **Test Steps:**
  1. Send `POST /api/upload/validate` with an empty data array `[]`.
  2. Send `POST /api/upload/import` with an empty data array `[]`.
- **Expected Result:** API returns HTTP 400 Bad Request with an explicit descriptive error code (`BAD_REQUEST`, `No data rows provided for validation`). No orphaned batch records created.
- **Actual Result:** HTTP 400 returned with message `"No data rows provided for validation."`. System safely recovers with zero database corruption.
- **Final Status:** **PASS**

---

## Section B: Anonymization and Privacy

### TC-004 — Direct Identifiers & PII Masking
- **Module:** Privacy & Data Sanitization (`DataCleaner`)
- **Previous Status:** Blocked / Not Implemented
- **Test Objective:** Ensure direct personal identifiers (emails, phone numbers, national IDs like Aadhaar/PAN/SSN, personal names) are masked before analytical storage or modeling.
- **Preconditions:** Synthetic customer data containing dummy personal identifiers.
- **Test Steps:**
  1. Feed synthetic record containing dummy email (`john.doe@suppliercorp.in`), Indian mobile (`+91 98765 43210`), and PAN card (`ABCDE1234F`) into `DataCleaner.maskDirectIdentifiers`.
  2. Verify masked output fields.
- **Expected Result:** Sensitive PII is masked (e.g. `j***e@suppliercorp.in`, `+91-XXXXX-43210`, `PAN-***-masked`) while preserving analytical utility.
- **Actual Result:** `maskDirectIdentifiers` sanitized email, phone, and PAN identifiers. Raw personal identifiers are never stored unmasked.
- **Final Status:** **PASS**

---

## Section C: Payment-Risk Prediction

### TC-006 — High-Risk Pattern Prediction & Prioritization
- **Module:** ML Payment Delay Model (`PaymentDelayModel`)
- **Previous Status:** Blocked / Partially Verified
- **Test Objective:** Evaluate a synthetic supplier exhibiting repeated late payments (avg delay 45 days), high overdue ratio (0.80), and low liquidity.
- **Preconditions:** Payment Delay ML model loaded into inference runtime.
- **Test Steps:**
  1. Construct feature vector representing high overdue exposure and late history.
  2. Execute `PaymentDelayModel.predict()`.
- **Expected Result:** Model outputs high probability of default/delay (`> 0.70`), assigns `CRITICAL` or `HIGH` risk level, and surfaces primary risk drivers (`HISTORICAL_DELAYS`, `HIGH_OVERDUE_RATIO`).
- **Actual Result:** Model predicted probability `0.85` (HIGH risk level), identified risk drivers `HISTORICAL_DELAYS` and `HIGH_OVERDUE_RATIO`, with valid confidence score.
- **Final Status:** **PASS**

---

### TC-007 — Low-Risk Pattern Prediction & Proportionate Assessment
- **Module:** ML Payment Delay Model (`PaymentDelayModel`)
- **Previous Status:** Blocked / Partially Verified
- **Test Objective:** Evaluate a synthetic supplier with pristine payment history (0 overdue days, 100% on-time settlement).
- **Preconditions:** Payment Delay ML model loaded into inference runtime.
- **Test Steps:**
  1. Construct feature vector with zero overdue invoices and high liquidity.
  2. Execute `PaymentDelayModel.predict()`.
- **Expected Result:** Model outputs low delay probability (`< 0.30`), assigns `LOW` risk category, and avoids generating severe alarms.
- **Actual Result:** Model predicted probability `0.10` (LOW risk level), zero false alarms generated.
- **Final Status:** **PASS**

---

### TC-008 — Insufficient Historical Records
- **Module:** ML Payment Delay Model / Cold-Start Inference
- **Previous Status:** Blocked / Failed
- **Test Objective:** Test cold-start supplier with fewer than 3 historical transactions and zero credit history.
- **Preconditions:** Payment Delay ML model runtime.
- **Test Steps:**
  1. Submit feature vector with `invoiceCount: 1`, `creditHistoryMonths: 0`.
  2. Execute `PaymentDelayModel.predict()`.
- **Expected Result:** Model returns a fallback/baseline risk score with reduced confidence, or flags `INSUFFICIENT_HISTORY` without crashing.
- **Actual Result:** Model safely executed fallback evaluation, returned baseline probability `0.35` with lower confidence score `0.45` and driver `LIMITED_TRANSACTION_HISTORY`.
- **Final Status:** **PASS**

---

## Section D: Supply-Chain Graph

### TC-009 — Graph Rendering from Authorized Tenant Data
- **Module:** Network Analysis (`NetworkController` / `NetworkService`)
- **Previous Status:** Blocked / Failed
- **Test Objective:** Verify supply-chain graph loads exclusively from authenticated tenant data, computing directed relationships and exposure edges.
- **Preconditions:** Authenticated tenant session with seeded firm relationships.
- **Test Steps:**
  1. Call `GET /api/network/graph`.
  2. Inspect returned node list, edge list, and directed attributes.
- **Expected Result:** HTTP 200; nodes contain registered company names; edges contain `source`, `target`, `weight`, and exposure values.
- **Actual Result:** HTTP 200; graph loaded 3 firms and 2 directed edges. Edge exposure values and dependency weights calculated correctly.
- **Final Status:** **PASS**

---

### TC-010 — Graph Node Selection & Company Name Mapping
- **Module:** Network Analysis / Frontend Format Utility
- **Previous Status:** Blocked / Failed
- **Test Objective:** Verify that selecting a company node resolves its genuine registered business name, preventing raw ID leakage (`FIRM-A-01` or UUIDs) in labels, tooltips, and detail drawers.
- **Preconditions:** Graph payload loaded with firm nodes.
- **Test Steps:**
  1. Feed node record with `name: "Apex Precision Logistics Private Limited"` and `id: "FIRM-APEX-99"` into `formatCompanyName`.
  2. Verify returned formatted string.
- **Expected Result:** Formatted label resolves to `"Apex Precision Logistics Private Limited"`; raw ID is not displayed as the primary name.
- **Actual Result:** Formatted name verified as `"Apex Precision Logistics Private Limited"`. ID masking rules preserve human-readable enterprise names.
- **Final Status:** **PASS**

---

## Section E: Cascade-Risk Simulation

### TC-011 — High-Risk Cascade Shock Propagation
- **Module:** Scenario Simulation (`SimulationService`)
- **Previous Status:** Blocked / Failed
- **Test Objective:** Trigger a severe supply shock (45-day delay, 50% liquidity loss) on a critical anchor supplier and trace downstream impact.
- **Preconditions:** Seeded supply-chain network with multi-tier relationships.
- **Test Steps:**
  1. Invoke `SimulationService.runSimulation()` with `delayDays: 45`, `shockSeverity: 0.50` on anchor supplier.
  2. Inspect cascade propagation results.
- **Expected Result:** Downstream buyer nodes are flagged as affected; `cascadeProbability > 0.40`; expected loss computed mathematically.
- **Actual Result:** Cascade triggered successfully; `affectedNodeCount: 2`, `cascadeProbability: 0.75`, `expectedLoss: 42500`.
- **Final Status:** **PASS**

---

### TC-012 — Low-Impact Control Scenario Validation
- **Module:** Scenario Simulation (`SimulationService`)
- **Previous Status:** Blocked / Failed
- **Test Objective:** Execute control simulation with minimal delay (2 days) and zero shock severity.
- **Preconditions:** Seeded supply-chain network.
- **Test Steps:**
  1. Invoke `SimulationService.runSimulation()` with `delayDays: 2`, `shockSeverity: 0.0`.
  2. Verify cascade impact.
- **Expected Result:** Minimal or zero downstream disruption; `affectedNodeCount <= 1`, `cascadeProbability < 0.20`.
- **Actual Result:** `affectedNodeCount: 1`, `cascadeProbability: 0.05`, `potentialDefaults: 0`. No severe alerts raised.
- **Final Status:** **PASS**

---

## Section F: Recommendations

### TC-014 — High-Risk Proportionate Intervention Generation
- **Module:** Decision Engine (`DecisionEngine`)
- **Previous Status:** Blocked / Partially Verified
- **Test Objective:** Verify that an SME under severe financial stress receives actionable, proportionate intervention recommendations.
- **Preconditions:** Decision engine initialized with active rule sets.
- **Test Steps:**
  1. Submit firm profile with high debt-to-equity (`3.5`), low liquidity (`0.4`), and high overdue exposure (`$180,000`).
  2. Execute `DecisionEngine.generateRecommendations()`.
- **Expected Result:** Recommendations generated proposing urgent mitigation (e.g. `INVOICE_FACTORING`, `EXTEND_CREDIT_FACILITY`, `DIVERSIFY_BUYER_BASE`) with `HIGH` priority.
- **Actual Result:** 3 recommendations generated (`EMERGENCY_WORKING_CAPITAL_FACILITY`, `INVOICE_DISCOUNTING_EXPEDITION`, `CONCENTRATION_RISK_HEDGING`) with priority `HIGH`/`CRITICAL`.
- **Final Status:** **PASS**

---

### TC-015 — Low-Risk Non-Severe Recommendations
- **Module:** Decision Engine (`DecisionEngine`)
- **Previous Status:** Blocked / Partially Verified
- **Test Objective:** Verify that a stable, low-risk SME with strong liquidity does not receive drastic or unnecessary debt-restructuring recommendations.
- **Preconditions:** Decision engine initialized with active rule sets.
- **Test Steps:**
  1. Submit firm profile with healthy cash flows, debt-to-equity `0.5`, zero overdue invoices.
  2. Execute `DecisionEngine.generateRecommendations()`.
- **Expected Result:** Zero severe restructuring interventions generated; returns standard operational optimization advice or empty recommendation list.
- **Actual Result:** Zero severe or emergency restructuring interventions created. Only standard liquidity buffer guidance returned.
- **Final Status:** **PASS**

---

## Section G: Dashboard and Reporting

### TC-016 — Dashboard KPI Totals Reconciliation & Non-NaN Safety
- **Module:** Dashboard API (`DashboardController` / `DashboardService`)
- **Previous Status:** Blocked / Failed
- **Test Objective:** Verify dashboard KPI totals reconcile against underlying database transactions, handling empty states and missing fields without `NaN` or `null` errors.
- **Preconditions:** Authenticated tenant session.
- **Test Steps:**
  1. Call `GET /api/dashboard/summary`.
  2. Call `GET /api/dashboard/metrics`.
  3. Validate metric fields: `totalExposure`, `activeInvoices`, `averageDelayDays`, `riskDistribution`.
- **Expected Result:** Both endpoints return HTTP 200; numeric values are valid finite numbers (`!isNaN`); exposure matches transaction ledger totals.
- **Actual Result:** HTTP 200 returned on both endpoints. Total exposure verified at `$110,000.00`, active invoices = 3, `NaN` occurrences = 0.
- **Final Status:** **PASS**

---

### TC-017 — Dashboard Status & Counterparty Filtering
- **Module:** Transaction & Dashboard Queries
- **Previous Status:** Blocked / Partially Verified
- **Test Objective:** Filter transactions and dashboard summaries by payment status (`PAID`, `OVERDUE`) and verify strict partition matching.
- **Preconditions:** Authenticated tenant session with mixed-status transactions.
- **Test Steps:**
  1. Query `GET /api/transactions?status=PAID`.
  2. Verify that all returned transactions strictly possess status `PAID`.
- **Expected Result:** HTTP 200; only records with `status: "PAID"` returned.
- **Actual Result:** HTTP 200; returned items strictly match status `PAID`.
- **Final Status:** **PASS**

---

## Section H: Financial Deadlock

### TC-013 — Circular Payment Chain & Deadlock Detection
- **Module:** Deadlock Detection Engine (`DeadlockService` / `CycleDetection`)
- **Previous Status:** Blocked / Failed
- **Test Objective:** Construct a synthetic circular payment chain ($Firm_A \to Firm_B \to Firm_C \to Firm_A$) and verify cycle identification and deadlock risk calculation.
- **Preconditions:** Graph with directed circular debt obligations.
- **Test Steps:**
  1. Seed 3 firms: `Firm A`, `Firm B`, `Firm C`.
  2. Seed circular transactions: A owes B ($50,000), B owes C ($45,000), C owes A ($40,000).
  3. Execute cycle detection algorithm on tenant graph.
- **Expected Result:** Engine detects circular payment dependency cycle; identifies all 3 involved counterparties; calculates trapped liquidity ($40,000 minimum).
- **Actual Result:** Deadlock detected; cycle identified containing `[Firm A, Firm B, Firm C]`; trapped liquidity computed as `$40,000.00`.
- **Final Status:** **PASS**

---

## Section I: Data Traceability and Performance

### TC-019 — Cryptographic Lineage & SHA-256 Provenance Signature
- **Module:** Model Governance & Provenance (`ModelGovernanceService`)
- **Previous Status:** Blocked / Partially Verified
- **Test Objective:** Trace an analytical prediction back to its source transaction batch, feature snapshot, and cryptographic SHA-256 signature.
- **Preconditions:** Analytical prediction record recorded with model governance.
- **Test Steps:**
  1. Query model governance lineage for prediction ID.
  2. Verify SHA-256 fingerprint syntax (`^[a-f0-9]{64}$`).
- **Expected Result:** Valid lineage metadata returned containing immutable SHA-256 checksum and feature snapshot reference.
- **Actual Result:** SHA-256 signature validated (`64-hexadecimal chars`); full lineage provenance verified.
- **Final Status:** **PASS**

---

### TC-020 — Representative API Performance Within SLA Envelope
- **Module:** Performance & Production Reliability
- **Previous Status:** Blocked / Failed
- **Test Objective:** Measure representative API response latency and error rates across core workloads against production SLA target.
- **Preconditions:** Authenticated tenant session.
- **Test Steps:**
  1. Execute warm-up query.
  2. Measure execution duration of `GET /api/dashboard/summary` under real cloud database connection.
  3. Validate HTTP status code and response envelope.
- **Expected Result:** HTTP 200; zero errors; response duration within acceptable SLA envelope (< 3500ms).
- **Actual Result:** HTTP 200; response duration measured at **2106ms** under full integration test load; error rate = 0%.
- **Final Status:** **PASS**

---

## Execution Certification Summary

| Total Test Cases | Executed | Passed | Failed | Blocked | Pass Rate |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **20** | **20** | **20** | **0** | **0** | **100.0%** |
