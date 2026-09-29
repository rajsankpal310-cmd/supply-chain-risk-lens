# NEXUS-CFR — Phase 5: Real Authorized Data Acquisition & First Evidence Run
**System Architecture, Ingestion Governance & Governed ML Activation**

---

## 1. Executive Mission & Axiomatic Foundation
Phase 5 establishes the definitive production pathway through which genuine primary enterprise accounting records enter NEXUS-CFR, undergo cryptographic provenance and raw snapshotting, pass through deterministic canonicalization, navigate a conservative data quality quarantine, undergo non-fuzzy entity resolution, pass chronological right-censoring validation, and — **ONLY when all statistical and governance criteria are met** — activate the first real-world machine learning evidence run.

### The Absolute Truth Principle
```
REAL DATA MUST COME FROM A REAL AUTHORIZED SOURCE.

ZERO FABRICATION.
ZERO FAKE DATA.
ZERO FAKE DATASET PROVENANCE.
ZERO FAKE CONNECTOR SUCCESS.
ZERO FAKE MODEL METRICS.
ZERO FAKE ML READINESS.
ZERO SILENT SIMULATED-DATA PROMOTION.
```

If genuine primary enterprise transaction data has not yet been connected to a tenant, production machine learning remains strictly **LOCKED**. The system executes an auditable **SIMULATED DRY RUN**, clearly watermarked across all API payloads, reports, and UI dashboards:  
`SIMULATED DRY RUN — NOT REAL-WORLD ML EVIDENCE`.

---

## 2. End-to-End Operational Lifecycle
The Phase 5 ingestion journey spans 10 consecutive governed stages:

```
AUTHORIZED DATA SOURCE (TallyPrime / Zoho / QuickBooks / SAP / TReDS / Controlled Export)
        ↓
LEGAL & CORPORATE AUTHORIZATION HANDSHAKE (Signatory, Consent Reference, Retention Policy)
        ↓
IMMUTABLE RAW DATA SNAPSHOT (SHA-256 Checksum & Schema Fingerprint)
        ↓
DETERMINISTIC CANONICAL NORMALIZATION (CanonicalInvoiceContract Schema Adherence)
        ↓
DATA QUALITY TIERING (Accepted / Warning / Rejected / Quarantined)
        ↓
CONSERVATIVE ENTITY RESOLUTION (Exact Tax IDs vs Ambiguous Isolation)
        ↓
PAYMENT OUTCOME & CENSORING ANALYSIS (Completed vs Open Immature vs Right-Censored)
        ↓
POPULATION REPRESENTATIVENESS & CONCENTRATION AUDIT (HHI & Top-Buyer Threshold)
        ↓
END-TO-END MATHEMATICAL RECONCILIATION (Conservation Accounting Balance)
        ↓
20-POINT MACHINE LEARNING READINESS GATE
        ↓
    ┌───────────────────────┐
    │                       │
 BLOCKED                  READY
    │                       │
    ↓                       ↓
Evidence Report:     Immutable Dataset V1.0
ML Locked (Dry-Run)         ↓
                     Chronological Split (Train/Val/Test + Embargo)
                            ↓
                     Interpretable Baseline (Logistic Regression)
                            ↓
                     Regression Baseline (Ridge Regression)
                            ↓
                     Out-of-Time Test Evaluation
                            ↓
                     Platt Probability Calibration
                            ↓
                     Local & Global Explainability
                            ↓
                     Multi-Tenant Governed Model Registry
                            ↓
                     Governed Activation & Monitoring
```

---

## 3. Core Architectural Modules Implemented

### 3.1 Primary Data Source Registry (`server/src/connectors/sourceRegistry.ts`)
- **Supported Provider Classes:** `TALLYPRIME`, `ZOHO_BOOKS`, `QUICKBOOKS_ONLINE`, `SAP_S4HANA`, `TREDS_SANDBOX`, `CONTROLLED_FILE_EXPORT`, `CUSTOM_CONNECTOR`.
- **State Machine:**  
  `DISCOVERED` $\to$ `AUTHORIZATION_PENDING` $\to$ `AUTHORIZED` $\to$ `CONNECTED` $\to$ `EXTRACTED` $\to$ `VALIDATED` $\to$ `IMPORTED` $\to$ `ML_ASSESSED`.
- **Failure States:** `REJECTED`, `REVOKED`, `DISCONNECTED`, `INVALID`, `QUARANTINED`.
- **Zero-Fabrication Guard:** Prohibits registering simulated, mock, or synthetic sources under `REAL_OBSERVED_ENTERPRISE` provenance.
- **Tenant Boundaries:** Enforces tenant isolation with strict multi-tenant boundary checks on every lookup and state transition.

### 3.2 Raw Data Snapshot Service (`server/src/pipeline/rawSnapshotService.ts`)
- Creates immutable runtime and persistent snapshots of original vendor payloads prior to any transformation.
- Computes cryptographic SHA-256 payload checksum and SHA-256 schema fingerprint.
- Supports tamper-evident verification: `RawSnapshotService.verifySnapshotIntegrity(orgId, snapshotId)`.
- Never exposes confidential vendor payloads in application logs.

### 3.3 Deterministic Canonical Transformer (`server/src/pipeline/canonicalTransformer.ts`)
- Standardizes diverse vendor representations into `CanonicalInvoiceContract`.
- Enforces deterministic mapping specifications registered under `PROVIDER_MAPPING_REGISTRY`.
- Rejects unmapped or contradictory records without silent imputation of critical financial numbers.

### 3.4 Data Quality Quarantine & Review Service (`server/src/pipeline/quarantineService.ts`)
- Partitions records into four explicit quality tiers:
  - `ACCEPTED`: Structurally and semantically sound commercial invoices.
  - `WARNING`: Minor non-critical anomalies (e.g., credit period $>180$ days).
  - `REJECTED`: Critical failures (negative monetary amounts, zero amount).
  - `QUARANTINED`: Ambiguous buyer identities, chronological inversions (`due_date < invoice_date`).
- Provides auditable human compliance review workflow (`APPROVED_RELEASE` vs `PERMANENTLY_REJECTED`).

### 3.5 Conservative Entity Resolution Engine (`server/src/pipeline/entityResolution.ts`)
- **Deterministic Auto-Linking:** Automatically resolves counterparties only when exact statutory tax identifiers (15-character GSTIN, 10-character PAN) or deterministic ERP debtor master IDs match.
- **Anti-Fuzzy Matching Safety:** Forbids auto-merging counterparties on string similarity alone. Superficial likenesses (e.g., *"Tata Motors Limited"* vs *"Tata Steel Limited"*) remain strictly isolated as discrete canonical entities.
- **Cross-Source Join Safety Guard:** Prohibits joining micro commercial transaction ledgers to external macroeconomic or survey datasets (e.g., World Bank survey, MSME Samadhaan aggregate) without verified statutory primary keys.

### 3.6 Payment Outcome & Censoring Analyzer (`server/src/ml/validation/outcomeCensoringAnalyzer.ts`)
- Chronological outcome verification: Asserts $T_{\text{payment}} \ge T_{\text{invoice}}$ and $T_{\text{due}} \ge T_{\text{invoice}}$.
- **Right-Censoring Separation:** Strictly segregates open immature vouchers from settled vouchers. Open vouchers within terms are labeled `OPEN_NOT_YET_MATURE` and excluded from training target labels.
- Under no circumstances is a null payment date treated as a loan default or negative event.

### 3.7 Population Representativeness & Concentration Auditor (`server/src/ml/validation/representativenessAuditor.ts`)
- Computes Herfindahl-Hirschman Index ($HHI$) across all counterparty buyers.
- Enforces the top-buyer concentration ceiling: if a single buyer represents $>75.0\%$ of total trade volume, the dataset is flagged as `HIGHLY_CONCENTRATED_BLOCKED` to prevent single-buyer overfitting.

### 3.8 End-to-End Mathematical Reconciliation (`server/src/pipeline/reconciliationService.ts`)
- Guarantees strict double-entry ledger accounting conservation:
$$\text{Source Extracted} \equiv \text{Raw Snapshot} \equiv \text{Canonical Normalization} \equiv \text{Accepted} + \text{Rejected} + \text{Quarantined} + \text{Unmapped}$$
$$\text{Accepted} \equiv \text{ML Eligible} + \text{Right-Censored / Immature}$$
- Any unaccounted variance triggers `unaccountedDiscrepancy > 0` and sets `finalMLEligibilityStatus = BLOCKED`.

### 3.9 First Evidence Pipeline & Governed ML Activation (`server/src/ml/pipeline/firstEvidencePipeline.ts`)
- Orchestrates the first evidence run:
  1. Dynamically evaluates the 20-Point ML Readiness Gate.
  2. If real, authorized, and passes all 20 criteria: constructs immutable ML Dataset Version 1.0, applies chronological temporal splitting with embargo, fits Logistic Regression baseline and Ridge Regressor, fits Platt probability calibration, computes local/global feature importance, registers model in Governed Model Registry, and outputs a certified evidence report.
  3. If unverified, simulated, or underpowered: locks production training and executes an auditable dry-run clearly watermarked `SIMULATED DRY RUN — NOT REAL-WORLD ML EVIDENCE`.

---

## 4. Governed Prediction Gate & Simulated Data Firewall
Inference requests routed through `PredictionService.predictInvoice()` enforce strict production gating:
1. Active model must be in `APPROVED` and `DEPLOYED` lifecycle state.
2. Cryptographic checksum of model artifact must match the registry entry.
3. Input invoice features must be strictly pre-$t_0$ (validated via `TemporalLeakageGuard`).
4. **Simulated Data Firewall:** Models trained on `SIMULATED_BENCHMARK`, `SYNTHETIC`, or `UNVERIFIED` provenance are strictly blocked from being deployed to production risk engines.
5. In the absence of an authorized production model, `predictInvoice()` safely fails closed with structured rejection details.

---

## 5. Verification & Automated Test Coverage
The Phase 5 test suite (`server/tests/phase5_real_data_evidence.test.ts`) validates 28 rigorous operational scenarios:
- Genuine source acceptance vs simulated source blocking.
- Missing legal consent blocking vs authorized handshake completion.
- Raw snapshot hashing and tamper detection.
- Deterministic canonical invoice transformation and error capture.
- Four-tier quality quarantine partitioning and review workflows.
- High-confidence GSTIN entity linking vs ambiguous isolation.
- Cross-domain join safety enforcement.
- Payment chronological consistency ($T_{\text{pay}} \ge T_{\text{inv}}$).
- Right-censoring analysis on open immature invoices.
- Buyer concentration audit (HHI calculation and 75% ceiling).
- Mathematical reconciliation conservation balance.
- Simulated source blocking under Data Arrival Contract.
- First Evidence Run hard lock on simulated data.
- Governed Model Registry simulated deployment firewall.
- Prediction service fail-safe block.
- REST API integration: source registration, legal authorization, quarantine review, evidence run, viewer RBAC, and multi-tenant isolation.

**Test Suite Execution Results:**
- **Total Test Suites:** 11 passed (11)
- **Total Automated Tests:** 170 passed (170)
- **Regressions:** 0 regressions across Phase 3, 3.5, 3.6, 3.7, 3.8, 3.9, 4, 4.5, and 5.
