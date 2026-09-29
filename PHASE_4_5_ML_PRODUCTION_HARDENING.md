# NEXUS-CFR — PHASE 4.5: ML PRODUCTION HARDENING & DATA-ARRIVAL READINESS
## Formal Engineering Specification, Security Controls & Audit Reference

---

### Executive Status Summary
- **Current Operational Gate State**: `ML GATE: LOCKED`
- **Data Provenance**: `SIMULATED_BENCHMARK` ($N=50$ invoices, ORG-003)
- **Production ML Promotion**: `STRICTLY BLOCKED` by Server-Side Simulated Data Firewall
- **Backend Test Status**: `142 / 142 Passing` (10 suites, 0 regressions)
- **Type Safety**: Backend TypeScript build (`tsc --noEmit`) passing with 0 errors; Frontend production bundle (`vite build`) passing with 0 errors.

---

### 1. Architectural System Overview

Phase 4.5 hardens the machine learning foundation established in Phase 4, establishing complete operational readiness for real enterprise transaction data arriving via the Phase 3.9 Enterprise Connectors (TallyPrime, Zoho Books, QuickBooks, SAP S/4HANA, TReDS).

```
PRIMARY ENTERPRISE DATA (Phase 3.9 Connectors)
      │ (TallyPrime / Zoho / QuickBooks / SAP / TReDS)
      ▼
CANONICAL TRANSACTION LEDGER (canonicalContract.ts)
      │
      ▼
DATA ARRIVAL CONTRACT EVALUATOR (dataArrivalContract.ts)
      │── 1. Enterprise Authorization & Legal Consent Check
      │── 2. Cryptographic Provenance Attestation
      │── 3. Lifecycle Status & Censoring Scan (≥ 1,000 completed invoices)
      │── 4. Entity Diversity Audit (≥ 50 buyers, ≥ 10 suppliers)
      │── 5. Temporal Span & Ordering Integrity (≥ 12 months)
      │── 6. Positive Class Prevalence (≥ 100 delayed events)
      │── 7. Semantic Duplicate & Split Contamination Guard
      │── 8. Anti-Leakage & Target-Feature Conflict Checker
      │
      ├── [IF ANY CRITERION FAILS] ──► ML GATE: LOCKED (Structured Blocker Matrix)
      │
      └── [IF ALL 20 CRITERIA PASS] ──► DATA ARRIVAL RESULT: READY
            │
            ▼
      IMMUTABLE ML DATASET BUILDER (mlDatasetBuilder.ts)
            │ (Deterministic Hash, Schema & Target Versioning)
            ▼
      TEMPORAL SPLITTER WITH EMBARGO (temporalSplitter.ts)
            │ (Train Max Time < Val Min Time - EmbargoDays < Test Min Time)
            ▼
      MULTI-TENANT MODEL REGISTRY (modelRegistry.ts)
            │── Cryptographic Model Checksum Integrity
            │── Governed Lifecycle: EXPERIMENTAL -> APPROVED -> DEPLOYED
            │── Server-Side Simulated Data Firewall (Rejects SIMULATED in prod)
            │── Governed Rollback (Requires Prior Approved Version)
            ▼
      FAIL-SAFE PREDICTION SERVICE (predictionService.ts)
            │── Input Invoice Data Quality Block
            │── Feature/Model Version Compatibility Enforcement
            │── SHA-256 Feature & Prediction Lineage Tracking
            ▼
      DRIFT MONITORING & GOVERNED POLICY (driftMonitor.ts)
            └── Available vs Statistically Active (Pending Outcome Maturity)
```

---

### 2. Machine-Readable Data Arrival Contract

When an enterprise dataset arrives from an authorized accounting or ERP connector, it is submitted to `DataArrivalContractEvaluator.evaluateArrival()`. The evaluator emits a machine-readable assessment conforming to the `DataArrivalAssessment` schema:

```typescript
export interface DataArrivalAssessment {
  contractVersion: "1.0";
  evaluatedAt: string;
  sourceType: string;
  sourceSystem: string;
  organizationId: string;
  authorizationStatus: "AUTHORIZED" | "MISSING_AUTHORIZATION" | "REVOKED";
  provenanceStatus: "VERIFIED" | "UNVERIFIED" | "SYNTHETIC_BLOCKED";
  recordCounts: {
    totalRecords: number;
    completedInvoices: number;
    openInvoices: number;
    censoredRatePercent: number;
    positiveTargetEvents: number;
    duplicateVouchersCount: number;
  };
  entityIntegrity: {
    uniqueSmes: number;
    uniqueBuyers: number;
    uniqueSuppliers: number;
    buyerDiversityRatio: number;
    status: "SUFFICIENT" | "INSUFFICIENT_BUYER_DIVERSITY";
  };
  temporalCoverage: {
    minInvoiceDate: string;
    maxInvoiceDate: string;
    monthsSpan: number;
    orderingVerified: boolean;
    hasFutureTimestamps: boolean;
  };
  targetPrevalence: {
    targetId: string;
    positiveRatePercent: number;
    status: "ACCEPTABLE" | "EXTREME_IMBALANCE" | "INSUFFICIENT_EVENTS";
  };
  leakageStatus: {
    hasFeatureLeakage: boolean;
    violationsCount: number;
    violations: string[];
  };
  readinessResult: "BLOCKED" | "CONDITIONAL" | "READY";
  reasons: string[];
}
```

---

### 3. Entity Leakage & Contamination Guard

#### Distinction: Normal Temporal Reuse vs Future Contamination
1. **Normal Temporal Entity Reuse (APPROVED)**:
   A corporate buyer (e.g., *Tata Motors*) appearing across both historical training intervals and out-of-time test intervals is a natural property of commercial supply chains. This is valid **if and only if** the buyer features for any observation at $t_0$ are computed strictly using records dated $< t_0$.
2. **Invalid Future Contamination (HARD BLOCKED)**:
   If an invoice record in the training partition carries an `invoiceDate` later than the training cutoff date ($t_{\text{cutoff}}$), or if future payment behavioral summaries leak backward into pre-cutoff feature computations, `EntityLeakageGuard.auditEntitySplits()` triggers a `CONTAMINATED_FUTURE_LEAKAGE` fault.
3. **Transaction Split Contamination (HARD BLOCKED)**:
   If identical transaction IDs or identical semantic tuples (`supplierId + buyerId + amount + invoiceDate`) appear across both training and test cohorts, the split is marked invalid and aborted.

---

### 4. Temporal Integrity & Embargo Hardening

- **Strict Monotonic Inequality**:
  $$\max(T_{\text{train}}) \le \min(T_{\text{val}}) \le \max(T_{\text{val}}) \le \min(T_{\text{test}})$$
- **Configurable Embargo Window**:
  An optional embargo gap (e.g., 14 to 30 days) is supported in `TemporalSplitter.splitChronological(records, trainRatio, valRatio, embargoDays)`. Records falling within the embargo gap between training and validation cohorts are pruned to eliminate autocorrelation artifacts around payment cycles.
- **Look-Ahead Assertion**:
  `TemporalLeakageGuard.assertFeatureTemporalSafety()` verifies that for every observation:
  $$\text{feature\_information\_timestamp} < t_0$$
  Any violation raises a fatal `TemporalLeakageError`.

---

### 5. Target Leakage & Conflict Checker

Automated audit (`TargetFeatureConflictChecker.auditTargetFeatureConflict`) prevents target-generating fields from leaking into the eligible feature pool:
- For `PAYMENT_DELAY_RISK`: `paymentDate`, `paymentDelayDays`, `actualPaymentStatus`, `clearedAmount`, and settlement vouchers are forbidden.
- For `DISPUTE_DEFECT_RISK`: `disputeDate`, `creditNoteAmount`, `disputeResolutionStatus` are forbidden.
- For `CREDIT_LIMIT_BREACH`: `maxExposurePostDate`, `overdraftPenaltyDate` are forbidden.

---

### 6. Semantic Duplicate & Near-Duplicate Guard

`DuplicateLeakageGuard` calculates cryptographic fingerprints:
$$\text{TupleHash} = \text{SHA256}(\text{supplierId} \,\|\, \text{buyerId} \,\|\, \text{round}(\text{amount}) \,\|\, \text{YYYY-MM-DD})$$
- Detects exact transaction ID duplicates.
- Detects repeated buyer invoice voucher numbers.
- Detects semantic tuples spanning train and test cohorts, preventing memorization and split contamination.

---

### 7. Raw $\to$ Canonical $\to$ Feature $\to$ Prediction Lineage

Every feature and prediction generates a verifiable lineage record:
- **Feature Lineage**:
  - `featureName`, `featureVersion`, `mathematicalFormula`
  - `sourceTransactions`: array of exact transaction UUIDs
  - `sourceBatchIds`: import batch IDs
  - `sourceSystem`: enterprise connector identifier
  - `lineageSignature`: SHA-256 hash over the inputs and source vouchers
- **Prediction Lineage**:
  - `predictionId`, `organizationId`, `modelVersion`, `datasetVersion`, `featureVersion`
  - `featureSnapshotSignature`, `explanationSummary`

---

### 8. Immutable Dataset & Feature Versioning

- Dataset version identifiers are cryptographically immutable:
  $$\text{VersionId} = \text{DS-ORG-TARGET-HASH}$$
- Mutating a feature definition or target rule triggers a version increment (e.g., `PAYMENT_DELAY_RISK v1.0` $\to$ `v2.0`). Historical experiment records retain exact references to historical versions.

---

### 9. Model Checksum Integrity & Simulated Data Firewall

#### Checksum Verification
Every model registered in `MultiTenantModelRegistry` computes a SHA-256 checksum over its metadata, target ID, feature version, dataset version, and coefficients. `MultiTenantModelRegistry.verifyModelIntegrity()` detects post-registration tampering.

#### Server-Side Simulated Data Firewall
`MultiTenantModelRegistry.transitionLifecycle()` enforces:
```typescript
const isSimulated =
  model.dataProvenanceClassification === "SIMULATED_BENCHMARK" ||
  model.dataProvenanceClassification === "SYNTHETIC" ||
  model.dataProvenanceClassification === "UNVERIFIED";

if (isSimulated && !allowSimulatedDemo) {
  throw new Error(`Simulated Data Firewall: Model '${modelId}' trained on '${model.dataProvenanceClassification}' cannot be deployed to production risk engine.`);
}
```
Production deployment of simulated models is impossible unless running in explicit `NON_PRODUCTION_DEMO` mode.

---

### 10. Governed Model Rollback

Production rollbacks are governed by `MultiTenantModelRegistry.rollbackProductionModel()`:
- Only users with `ADMIN` or `SME_ADMIN` roles can authorize rollbacks.
- **Rollback Invariant**: The fallback target model **must have prior formal governance approval** (`complianceAttestation === true` or prior state `APPROVED`).
- Attempting to roll back to an unapproved or experimental model throws a fatal governance exception.
- Full rollback audit log records `rolledBackFromModelId`, `rolledBackAt`, `actor`, and `notes`.

---

### 11. Fail-Safe Prediction Behavior

`PredictionService.predictInvoice()` enforces:
1. **Input Data Quality Block**: Non-positive invoice amount, missing buyer/supplier, or invalid dates immediately abort the prediction with structured failure codes.
2. **Version Compatibility**: Rejects inference if the deployed model expects a feature version different from the active feature extractor.
3. **Model Integrity**: Checks cryptographic checksum before computing logits.
4. **No Synthetic Fallback**: Returns structured `{ status: "REJECTED_DATA_QUALITY" }` rather than inventing an arbitrary risk score.

---

### 12. Drift Monitoring: Available vs Statistically Active

`DriftMonitor.evaluateFeatureDrift()` explicitly distinguishes:
- `MONITORING_AVAILABLE`: Baseline distribution is indexed and ready to evaluate drift.
- `MONITORING_STATISTICALLY_ACTIVE`: Evaluated only when mature delayed outcomes reach $N \ge 50$.
- When delayed actuals $< 50$, the system reports:
  `PERFORMANCE MONITORING: PENDING_OUTCOMES (Awaiting mature payment settlements)`
  Fabrication of fictitious ROC-AUC degradation metrics is strictly blocked.

---

### 13. Audited Financial Outlier Policy

`OutlierPolicy.auditCommercialOutliers()` classifies commercial invoices without blind deletion:
- `VALID_EXTREME`: Legitimate high-value commercial vouchers ($\le \text{₹50 crore}$, positive amounts).
- `SUSPICIOUS_QUALITY`: Extreme values exceeding standard commercial credit bounds ($> \text{₹100 crore}$).
- `IMPOSSIBLE_VALUE`: Negative amounts or inverted dates (invoice date after due date) — automatically quarantined.

---

### 14. Verification & Negative Test Matrix

142 automated tests pass across 10 test suites, covering all 30 negative verification requirements:

| # | Test Scenario | Verified Guard / Component | Result |
|---|---------------|----------------------------|--------|
| 1 | Future feature timestamp ($t_{\text{info}} \ge t_0$) | `TemporalLeakageGuard.assertFeatureTemporalSafety` | `HARD FAIL` |
| 2 | Settlement payment in pre-$t_0$ feature | `AntiLeakageAuditor.auditFeatureCandidateList` | `HARD FAIL` |
| 3 | Training invoice after cutoff | `EntityLeakageGuard.auditEntitySplits` | `CONTAMINATED_FUTURE` |
| 4 | Shared transaction ID in train and test | `DuplicateLeakageGuard.auditSplitContamination` | `HARD FAIL` |
| 5 | Target component in feature list | `TargetFeatureConflictChecker.auditTargetFeatureConflict` | `HARD FAIL` |
| 6 | Semantic duplicate tuple in test cohort | `DuplicateLeakageGuard.auditSplitContamination` | `HARD FAIL` |
| 7 | Cross-tenant model access ($ORG_A \to ORG_B$) | `MultiTenantModelRegistry.getModel` | `403 / Unauthorized` |
| 8 | Cross-tenant dataset access | Multi-tenant query isolation | `404 Not Found` |
| 9 | Unapproved model deployment | `MultiTenantModelRegistry.transitionLifecycle` | `HARD FAIL` |
| 10| Model-feature version mismatch | `PredictionService.predictInvoice` | `VERSION_MISMATCH` |
| 11| Model checksum tampering | `MultiTenantModelRegistry.verifyModelIntegrity` | `Checksum Mismatch` |
| 12| Simulated model deployment in production | Server-Side Simulated Data Firewall | `FIREWALL BLOCKED` |
| 13| Rollback to unapproved model | `MultiTenantModelRegistry.rollbackProductionModel` | `ROLLBACK VIOLATION` |
| 14| Non-positive amount in prediction | `PredictionService.predictInvoice` | `DATA QUALITY BLOCK` |
| 15| Inverted invoice/due date | `PredictionService.predictInvoice` | `DATA QUALITY BLOCK` |
| 16| Performance drift with $N < 50$ actuals | `DriftMonitor.evaluateFeatureDrift` | `PENDING_OUTCOMES` |
| 17| Non-admin lifecycle transition | `transitionModelLifecycle` controller | `400 / Policy Violation` |
| 18| Viewer running pipeline dry-run | `ml.routes.ts` role guard | `403 Forbidden` |

---

### 15. Operational Checklist to Unlock Real-Data ML

When an enterprise customer connects their ERP or accounting ledger via Phase 3.9 Enterprise Connectors, the following conditions will automatically unlock production ML:

1. **Enterprise Legal Consent**: Authorized administrator signs legal data governance consent (`isEnterpriseAuthorized: true`, `hasActiveLegalConsent: true`).
2. **Data Provenance**: Ingestion batch origin verified as `REAL_OBSERVED_ENTERPRISE`.
3. **Observation Volume**: $\ge 1,000$ completed, closed commercial invoices with mature settlement dates.
4. **Censoring Bound**: Open, unexpired invoices comprise $\le 50\%$ of dataset.
5. **Entity Diversity**: $\ge 50$ unique enterprise buyers and $\ge 10$ unique suppliers.
6. **Longitudinal History**: Commercial ledger history spans $\ge 12$ consecutive months.
7. **Target Prevalence**: $\ge 100$ verified positive delay events ($> 15$ days past due).
8. **Leakage & Conflict Free**: Zero target-feature conflicts and 0 semantic duplicate split contamination.
