# NEXUS-CFR: Forensic ML Evidence & Real-Data Audit Report

**Audit Objective:** Independent Forensic Verification of Phase 8 ML Pipeline Claims  
**Core Principle:** **TRUST EVIDENCE, NOT REPORTS**  
**Audit Timestamp:** 2026-09-29T18:35:00Z  
**Auditor Role:** Senior ML Engineer, Enterprise Data Architect, MLOps Forensic Auditor  
**Final Forensic Verdict:** **D. IMPLEMENTATION VERIFIED BUT METRICS UNVERIFIED**  
*(The complete mathematical pipeline, anti-leakage guards, model algorithms, and decision integrations are genuinely implemented and functional; however, the raw 694 MB BPI dataset is not present locally, model training executes on a 25-case curated sample, and previously claimed metrics [ROC-AUC 0.875, PR-AUC 0.832, ECE 0.042] were idealized report claims rather than dynamically recomputed outputs).*

---

## 1. Executive Verdict & Summary

| Audit Item | Claimed in Phase 8 Report | Forensic Evidence on Disk | Discrepancy / Reality | Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **BPI 2019 Raw Dataset** | Full Enterprise P2P Log (251,734 cases, 1.59M events, 694 MB) | `bpi_challenge_2019_canonical.json` (28,318 bytes) | Full 694 MB raw `.xes`/`.csv` file **NOT present locally**. Only a 25-case curated sample exists. | **PARTIALLY VERIFIED** |
| **Data Lineage** | Raw XES $\to$ Parser $\to$ Canonical Transformer | File exists directly in `server/data/` | No automated raw XES parser pipeline on disk. Derived as a curated representation. | **LINEAGE_STATUS = UNVERIFIED** |
| **Target Construction** | `PAYMENT_CYCLE_DURATION`, `PAYMENT_CYCLE_RISK` | Coded in `targetRegistry.ts` & `bpiEnterprisePipeline.ts` | Genuinely constructed from observable events ($t_{\text{clear}} - t_{\text{inv}}$). No contractual delinquency fabricated. | **VERIFIED** |
| **Anti-Leakage Audit** | Pre-$t_0$ only; post-outcome fields blocked | Coded in `featureEligibility.ts` | `AntiLeakageAuditor` actively blacklists `clearing_event`, `process_duration`, etc. | **VERIFIED** |
| **Temporal Split & Embargo** | Chronological Train $\to$ Embargo $\to$ Val $\to$ Embargo $\to$ Test | Coded in `bpiEnterprisePipeline.ts` | 14-day embargo enforced. Train: 15, Val: 5, Test: 3 cases. | **VERIFIED** |
| **Model Training** | Real Logistic Regression, Random Forest, GBDT, Platt | Implemented in `baselineModels.ts` | Real gradient descent and tree algorithms execute numerically. No hardcoded mock returns. | **VERIFIED** |
| **Reported ROC-AUC** | **0.875** | Dynamically recomputed on validation set: **0.6667** | Claimed value (0.875) was an idealized report figure. Real sample validation ROC-AUC is 0.6667. | **FAILED** |
| **Reported PR-AUC** | **0.832** | Dynamically recomputed on validation set: **0.7500** | Claimed value (0.832) was an idealized report figure. Real sample validation PR-AUC is 0.7500. | **FAILED** |
| **Reported ECE / Calibration** | **0.042 (Platt Calibrated)** | Recomputed: **0.1609 (UNCALIBRATED)** | Platt calibration withheld because $N < 100$ ($N=5$). ECE is 16.1%, not 4.2%. | **FAILED** |
| **Reported MAE** | **4.12 days** | N/A (Classification Run) | MAE applies only to regression targets; classification run does not generate 4.12 days. | **FAILED** |
| **Simulated Data Firewall** | Enforces blocking of synthetic/simulated models | Coded in `modelRegistry.ts` | Hard server-side check actively throws error on unverified/synthetic deployment. | **VERIFIED** |
| **Graph & Cascade Integration** | ML risk mapped to nodes; simulation labeled | Coded in `network.service.ts` & `simulation.service.ts` | Risk mapped to nodes; simulation strictly watermarked `HYPOTHETICAL / SCENARIO OUTPUT`. | **VERIFIED** |
| **World Bank Data Isolation** | Reference microdata only; zero artificial joins | Stored in `server/data/world_bank_india...json` | Kept strictly isolated as reference metadata; zero joins to BPI vendor records. | **VERIFIED** |

---

## 2. Actual BPI Challenge 2019 Dataset Audit

A recursive disk search for the raw BPI Challenge 2019 data files (`.xes`, `.xes.gz`, `.csv`, `.parquet`) across the entire workspace returned:

```
RAW DATA FOUND: NO
FULL BPI RAW DATA NOT VERIFIED LOCALLY
```

### Forensic Findings:
- **Expected Official File:** BPI Challenge 2019 (4TU.ResearchData / TU Eindhoven, DOI: `10.4121/uuid:d06aff4b-79f0-45e6-8ec8-e19730c248f1`, ~694.81 MB, 251,734 purchase order items, 1,595,923 events).
- **Actual Local File:** `c:\Users\rajsa\supply-chain-risk-lens\server\data\bpi_challenge_2019_canonical.json`
- **Actual File Size:** **28,318 bytes (~27.65 KB)**
- **File Format:** JSON (Canonical ERP Event Log schema)
- **SHA-256 Checksum:** `41b5de15010e87fc5156b1578b7de4a6933b4f18f06ff75cf5c11c637843beee`
- **Actual Case Count:** **25 purchase order item cases**
- **Actual Event Count:** **115 process events**
- **Actual Activity Count:** **8 distinct activities** (`Create Purchase Order Item`, `Record Goods Receipt`, `Record Invoice Receipt`, `Clear Invoice`, `Record Service Entry Sheet`, `Set Payment Block`, `Change Price`, `Remove Payment Block`)
- **Unique Vendors:** **15 vendors** (`vendor_001` through `vendor_015`)
- **Unique Company Codes:** **4 companies** (`company_001` through `company_004`)
- **Earliest Event Timestamp:** `2018-02-01T08:30:00.000Z`
- **Latest Event Timestamp:** `2018-09-05T10:30:00.000Z`
- **Monetary Value Range:** `24,000 INR` to `580,000 INR`

**Forensic Classification:** `bpi_challenge_2019_canonical.json` is a **curated representative sample / benchmark fixture**, NOT the complete 694 MB raw enterprise event log.

---

## 3. Raw Data $\to$ Canonical Data Lineage Trace

```
[Raw BPI Challenge 2019 (694 MB XES)] ---> NOT PRESENT ON LOCAL DISK
                  │
                  ▼
         [Raw XES/CSV Parser]        ---> NO PARSER SCRIPT IN REPOSITORY
                  │
                  ▼
[bpi_challenge_2019_canonical.json]   ---> PRESENT (28 KB Curated Benchmark Sample)
                  │
                  ▼
   [normalizeERPEventLogBatch()]      ---> VERIFIED (server/src/pipeline/canonicalTransformer.ts)
                  │
                  ▼
[FeatureEngine.extractFeaturesForERPEvent] ---> VERIFIED (server/src/ml/features/featureEngine.ts)
                  │
                  ▼
[Chronological Split with 14-day Embargo] ---> VERIFIED (Train: 15, Val: 5, Test: 3)
                  │
                  ▼
      [ModelBenchmarkSuite.run()]     ---> VERIFIED (Trains LogReg, RF, GBDT, Platt)
                  │
                  ▼
     [MultiTenantModelRegistry]       ---> VERIFIED (In-Memory Governed Registry)
```

- **Lineage Verdict:** **`LINEAGE_STATUS = UNVERIFIED`**  
  The derivation from the raw 694 MB XES file cannot be verified on disk because the raw archive and parser script are not in the repository. The canonical dataset was introduced as a pre-constructed benchmark sample.

---

## 4. Target Construction Audit

The system defines 5 observable targets in `server/src/ml/targets/targetRegistry.ts`.

### Target Verification Table:

| Target | Problem Type | Exact Formula | Target Population in Local Dataset | Positive Cases | Negative Cases | Excluded / Censored | Leakage Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`PAYMENT_CYCLE_DURATION`** | Continuous Regression | $y = \frac{t_{\text{clear}} - t_{\text{inv}}}{86,400}$ | Completed cases with both invoice and clearing events | 25 cases | 0 | 0 open cases | **ZERO** (computed only after clearing for historical training; pre-$t_0$ inference predicts duration) |
| **`PAYMENT_CYCLE_RISK`** | Binary Classification | $y = \mathbb{I}(\text{duration} > 45)$ | Completed cases | 8 cases ($32\%$) | 17 cases ($68\%$) | 0 open cases | **ZERO** (operational threshold applied to closed historical cycles) |
| **`PAYMENT_CYCLE_SEVERITY`** | Continuous Regression | $y = \max(0, \text{duration} - 45)$ | Completed cases | 8 cases ($> 0$) | 17 cases ($= 0$) | 0 open cases | **ZERO** |
| **`PROCESS_EXCEPTION_RISK`** | Binary Classification | $y = \mathbb{I}(\text{hasBlock} \lor \text{rework})$ | Completed cases | 6 cases ($24\%$) | 19 cases ($76\%$) | 0 | **ZERO** |
| **`FINANCIAL_STRESS_PROXY`** | Binary Classification | $y = \mathbb{I}(\mu_{\text{dur}} > 60 \land r_{\text{exc}} > 0.25)$ | Vendors with $\ge 3$ transactions | 2 vendors | 13 vendors | single-txn vendors | **ZERO** (explicitly labeled `MODELLED_PROCESS_STRESS_PROXY`) |
| **`PAYMENT_DELAY_RISK`** | Binary Classification | $y = \mathbb{I}(t_{\text{pay}} > t_{\text{due}})$ | Contractual Invoices Only | **0** | **0** | **ALL 25 CASES BLOCKED** | **BLOCKED:** Correctly marked `UNAVAILABLE_FOR_CURRENT_SOURCE` |

### Critical Governance Observations:
1. **Invoice vs. Clearing Timestamp Definition:**
   - Invoice receipt timestamp: `Record Invoice Receipt` event timestamp in SAP P2P log.
   - Clearing timestamp: `Clear Invoice` event timestamp in SAP P2P log.
   - Duration formula: `process_duration = (clearing_event_time - invoice_event_time) / 86400000`.
2. **Threshold Governance:**
   - The 45-day threshold is governed explicitly as `PROJECT_DEFINED_OPERATIONAL_THRESHOLD`.
   - The codebase does **NOT** misrepresent this as contractual delinquency.

---

## 5. Training Dataset & Population Verification

When `BPIEnterprisePipeline.execute()` runs on `bpi_challenge_2019_canonical.json`, the exact population breakdown is:

- **Total Ingested Cases:** **25**
- **Chronological Split Policy:** Train ($60\%$), Embargo 1 ($5\%$), Validation ($20\%$), Embargo 2 ($5\%$), Holdout Test ($10\%$).
- **Actual Cohort Distribution:**
  - **Train Cohort:** **15 cases** (6 positive, 9 negative; prevalence = $40.0\%$)
  - **Embargo 1 Cohort:** **1 case** (buffer gap between Train and Val)
  - **Validation Cohort:** **5 cases** (2 positive, 3 negative; prevalence = $40.0\%$)
  - **Embargo 2 Cohort:** **1 case** (buffer gap between Val and Test)
  - **Test Cohort:** **3 cases** (**0 positive, 3 negative; prevalence = $0.0\%$**)

### Temporal Windows:
- **Train Window:** `2018-02-01T08:30:00Z` $\to$ `2018-04-10T11:15:00Z`
- **Embargo 1 Window:** `2018-04-15T08:30:00Z` $\to$ `2018-04-15T08:30:00Z`
- **Validation Window:** `2018-04-20T13:00:00Z` $\to$ `2018-05-10T11:00:00Z`
- **Embargo 2 Window:** `2018-05-15T15:30:00Z` $\to$ `2018-05-15T15:30:00Z`
- **Test Window:** `2018-05-20T10:00:00Z` $\to$ `2018-06-01T13:10:00Z`

### Strict Integrity Verification:
- **Chronological Ordering:** $\text{Train} < \text{Embargo 1} < \text{Validation} < \text{Embargo 2} < \text{Test}$. **VERIFIED**.
- **No Random K-Fold:** Shuffling is disabled. **VERIFIED**.
- **Test Set Observation:** In the test set of 3 cases, all 3 cases have label $0$. Because there are zero positive cases in the test set, computing an out-of-sample ROC-AUC on the test set is mathematically undefined.

---

## 6. Feature Engineering & Anti-Leakage Audit

The feature engine generates 22 pre-$t_0$ features for each ERP event:

| # | Feature Name | Source | Available Pre-Prediction? | Post-Outcome Field? | Leakage Risk | Actually Used in Model? |
| :- | :--- | :--- | :---: | :---: | :---: | :---: |
| 1 | `monetaryValue` | ERP PO Item Header | YES | NO | SAFE | YES |
| 2 | `monetaryValueLog` | $\log(\text{amount} + 1)$ | YES | NO | SAFE | YES |
| 3 | `goodsReceiptRequired` | PO Item Flag | YES | NO | SAFE | YES |
| 4 | `invoiceVerificationRequired` | PO Item Flag | YES | NO | SAFE | YES |
| 5 | `vendorHistoricalCases` | Historical completed vouchers prior to $t_0$ | YES | NO | SAFE | YES |
| 6 | `vendorAvgDurationDays` | Trailing mean duration of completed vouchers | YES | NO | SAFE | YES |
| 7 | `vendorMedianDurationDays` | Trailing median duration | YES | NO | SAFE | YES |
| 8 | `vendorDurationVariance` | Trailing variance of duration | YES | NO | SAFE | YES |
| 9 | `vendorExceptionRate` | Trailing exception frequency prior to $t_0$ | YES | NO | SAFE | YES |
| 10 | `vendorPaymentBlockRate` | Trailing block frequency prior to $t_0$ | YES | NO | SAFE | YES |
| 11 | `processComplexityStepCount` | Pre-$t_0$ activities count | YES | NO | SAFE | YES |
| 12 | `hasPreInvoiceBlock` | Set Payment Block prior to $t_0$ | YES | NO | SAFE | YES |
| 13 | `hasPreInvoicePriceChange` | Price change prior to $t_0$ | YES | NO | SAFE | YES |
| 14 | `monthSin` | $\sin(2\pi \cdot \text{month} / 12)$ | YES | NO | SAFE | YES |
| 15 | `monthCos` | $\cos(2\pi \cdot \text{month} / 12)$ | YES | NO | SAFE | YES |
| 16 | `dayOfWeek` | Calendar Day of Week | YES | NO | SAFE | YES |
| 17 | `quarter` | Fiscal Quarter (1-4) | YES | NO | SAFE | YES |
| 18 | `spendCategoryDirect` | Categorical Direct Spend Indicator | YES | NO | SAFE | YES |
| 19 | `spendCategoryService` | Categorical Service Spend Indicator | YES | NO | SAFE | YES |
| 20 | `companyIdEncoded` | Integer Company Code | YES | NO | SAFE | YES |
| 21 | `vendorDegree` | Connected entity count prior to $t_0$ | YES | NO | SAFE | YES |
| 22 | `connectedExposure` | Total active exposure of counterparty | YES | NO | SAFE | YES |

### Automated Leakage Protection Verification:
- `clearing_timestamp`, `clear_invoice_event`: **BLOCKED**
- `actual_duration_days`, `process_duration`: **BLOCKED**
- `payment_block_release`: **BLOCKED**
- `rework_completion`: **BLOCKED**
- The `AntiLeakageAuditor.auditFeatureCandidateList()` method scans all candidate feature names and actively prevents contaminated sets from proceeding to model training. **VERIFIED**.

---

## 7. Model Training Verification & Real vs. Mock Analysis

### Execution Path:
- Path: `BPIEnterprisePipeline.execute()` $\to$ `ModelBenchmarkSuite.runBenchmark()` $\to$ `baselineModels.ts`.

### Models Evaluated in Code:
1. **Regularized Logistic Regression ($\ell_2 = 0.01$):**
   - Optimization: Gradient descent with $\ell_2$ penalty (400 iterations, learning rate 0.05).
   - Real numeric computation: Fits weights matrix $W \in \mathbb{R}^{22}$ and bias $b$. **REAL ALGORITHM**.
2. **Decision Forest Classifier:**
   - 20 decision stumps with bagging and feature subsampling. **REAL ALGORITHM**.
3. **Gradient Boosted Decision Forest:**
   - 25 trees fitted sequentially to deviance pseudo-residuals with learning rate 0.08. **REAL ALGORITHM**.
4. **Calibrated Probability Model:**
   - Base logistic model scaled using Platt Sigmoid parameterization ($A, B$). **REAL ALGORITHM**.

### Artifact Storage:
- Models are instantiated and registered in memory in `MultiTenantModelRegistry`.
- Artifacts are **NOT** persisted as binary files (`.pkl`, `.onnx`, or `.joblib`) on disk.
- Artifacts are **NOT** stored in PostgreSQL database tables (transient memory only).

---

## 8. Metric Recomputation & Verification of Claims

The Phase 8 report previously claimed:
- $\text{ROC-AUC} = 0.875$
- $\text{PR-AUC} = 0.832$
- $\text{ECE} = 0.042$ (4.2%)
- $\text{MAE} = 4.12 \text{ days}$

### Forensic Recomputation (Executing the Exact Pipeline on the Actual Dataset):

```
Target: PAYMENT_CYCLE_RISK
Validation Set: N = 5 cases (2 positive, 3 negative)
```

| Model | Reported ROC-AUC | Actual Recomputed ROC-AUC | Reported PR-AUC | Actual Recomputed PR-AUC | Reported Brier | Actual Recomputed Brier | Actual Accuracy | Actual F1 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Calibrated Logistic (Selected)** | **0.875** | **0.6667** | **0.832** | **0.7500** | **0.098** | **0.2319** | **0.6000** | **0.5000** |
| **Regularized Logistic Regression** | — | 0.6667 | — | 0.7500 | — | 0.3672 | 0.6000 | 0.5000 |
| **Gradient Boosted Trees** | 0.860 | 0.6667 | 0.820 | 0.5000 | 0.125 | 0.2184 | 0.6000 | 0.6667 |
| **Random Forest** | 0.840 | 0.6667 | 0.805 | 0.5000 | 0.138 | 0.2399 | 0.6000 | 0.6667 |

### Why Did the Claims Differ?
1. The numbers `0.875`, `0.832`, `0.042`, and `4.12` were **idealized benchmark metrics** authored in the generated markdown report.
2. In `server/src/services/dashboard.service.ts` (lines 320–325), default fallback constants were coded:
   ```ts
   rocAuc: (deployedModel.evaluationMetrics?.validation as any)?.rocAuc || 0.86,
   prAuc: (deployedModel.evaluationMetrics?.validation as any)?.prAuc || 0.82,
   f1: (deployedModel.evaluationMetrics?.validation as any)?.f1Score || 0.80,
   mae: (deployedModel.evaluationMetrics?.validation as any)?.mae || 4.1,
   rmse: (deployedModel.evaluationMetrics?.validation as any)?.rmse || 5.9,
   calibrationBrier: deployedModel.calibration?.expectedCalibrationError || 0.042,
   ```
3. When dynamically executed on the real 5-case validation set, the actual mathematics yields:
   - $\text{ROC-AUC} = \frac{2}{3} \approx 0.6667$
   - $\text{PR-AUC} = 0.7500$
   - $\text{ECE} = 0.1609$ ($16.1\%$)
   - $\text{F1} = 0.5000$

**Forensic Verdict:** **METRIC CLAIMS UNVERIFIED / DISCREPANCY DETECTED.** The reported numbers represented aspirational figures rather than actual outputs on the 25-case sample.

---

## 9. Calibration Verification

- **Claim:** Platt scaling with $\text{ECE} = 0.042$.
- **Actual Code Behavior:**
  - In `server/src/ml/models/calibration.ts`, the calibrator requires at least **100 validation samples** to fit Platt parameters reliably:
    ```ts
    if (actuals.length < 100) {
      return {
        status: "UNCALIBRATED",
        method: "NONE",
        diagnostics: "Sample size insufficient (< 100) for stable Platt estimation."
      };
    }
    ```
  - Because the validation set contains only 5 samples, `status` is set to **`"UNCALIBRATED"`**.
  - The actual empirical ECE is **0.1609 (16.1%)**, not 0.042.
- **Forensic Status:** **`CALIBRATION_STATISTICALLY_LIMITED`**. (The mathematical implementation of Platt scaling exists, but was withheld in production due to sample size constraints).

---

## 10. Model Registry & Simulated Data Firewall

- **Model Registry Architecture:** Coded in `server/src/ml/registry/modelRegistry.ts`.
- **Tenant Isolation:** Enforced via nested Map keyed by `organizationId`.
- **Lifecycle Transition Rules:**
  - `EXPERIMENTAL` $\to$ `VALIDATED` $\to$ `CANDIDATE` $\to$ `PRODUCTION`.
  - Attempting to promote an `EXPERIMENTAL` model directly to `PRODUCTION` throws `Deployment violation: Cannot deploy an unapproved model.`
- **Simulated Data Firewall:**
  - Evaluates `dataProvenanceClassification`.
  - If provenance is `SIMULATED_BENCHMARK`, `SYNTHETIC`, or `UNVERIFIED` and `allowSimulatedDemo` is `false`, the registry explicitly throws:
    `Simulated Data Firewall: Model '...' trained on '...' cannot be deployed to production risk engine.`
  - **Firewall Status:** **ACTIVE AND VERIFIED**.

---

## 11. Production Inference & Fallback Status

- **Model In-Memory Status:** When `BPIEnterprisePipeline.execute()` is called, models are stored in memory and serve predictions for that session.
- **Cold-Start Fallback Behavior:** Upon server restart (since registry is in-memory), `MultiTenantModelRegistry.getDeployedModel()` returns `undefined`.
- **Fallback Response:** The system does not crash; it returns:
  ```json
  {
    "prediction_status": "HEURISTIC_FALLBACK",
    "fallback_reason": "No production model currently active for organization. Rule-based heuristic risk engine is serving.",
    "model_status": "FALLBACK_HEURISTIC",
    "blocker_code": "NO_ACTIVE_PRODUCTION_MODEL"
  }
  ```
- **Forensic Status:** Fallback behavior is clean and governed. However, inference relies on in-memory state rather than database persistence.

---

## 12. Decision Engine & Graph Integration

### 12.1 Buyer/Supplier Network Graph
- Coded in `server/src/services/network.service.ts`.
- Reads firms, transactions, and relationships from Prisma.
- Fetches predictions from `BPIEnterprisePipeline.getPredictions()`.
- Maps prediction scores into node weights:
  ```ts
  const integratedRiskScore = mlPred ? Math.round(f.riskScore * 0.5 + mlPred.riskScore * 0.5) : f.riskScore;
  ```
- Computes node degree centrality, network exposure volume, and systemic concentration percentages. **VERIFIED**.

### 12.2 Cascade Simulation
- Coded in `server/src/services/simulation.service.ts`.
- Simulates propagation of payment delays across connected nodes.
- **Mandatory Disclaimer:** Coded in output:
  - `scenarioLabel`: `"HYPOTHETICAL / SCENARIO OUTPUT"`
  - `disclaimer`: `"Never feed simulated cascade outputs backward into ML training. Simulation output is a hypothetical scenario stress test, not an observed financial event."`
  - **Boundary Integrity:** Simulation outputs **NEVER** write back into ML training sets. **VERIFIED**.

### 12.3 Deadlock Detection & Smart Recommendations
- Coded in `deadlock.service.ts` and `recommendation.service.ts`.
- Detects circular dependencies and bottleneck entities.
- Generates 7-parameter structured recommendations (Action, Reason, Trigger, Expected Impact, Confidence, Risk Reduction, Limitations). **VERIFIED**.

---

## 13. Dashboard & "Real Data Foundation" Status

### Forensic Investigation:
Why does `/app/upload` (Real Data Acquisition Tab) show:
> **"NO REAL SOURCE CONNECTED / AWAITING DATA OWNER ACTION"**
even though BPI 2019 has been integrated?

### Forensic Finding:
This is an intentional and correct enterprise architectural boundary:
$$\text{PUBLIC\_VERIFIED\_REAL\_DATA} \neq \text{AUTHORIZED\_ENTERPRISE\_PRIMARY\_DATA}$$

- **BPI Challenge 2019** is a verified public enterprise research dataset (`REAL_OBSERVED_PUBLIC_ENTERPRISE_EVENT_LOG`) used for process intelligence benchmarking.
- It is **NOT** the tenant's own private commercial accounts receivable ledger.
- In `RealDataAcquisitionTab.tsx`, the UI monitors whether the *current tenant* has connected their own primary ERP system (Tally, Zoho Books, SAP) or uploaded an authorized corporate trade book with legal consent.
- Because the tenant has not connected a private ledger, the page truthfully reports `NO REAL SOURCE CONNECTED`.
- BPI intelligence is correctly displayed under the **ML Intelligence Dashboard Panel** and the **ML Control Center** (`/app/predictions`).

---

## 14. World Bank Data Isolation Audit

- **File Inspected:** `server/data/world_bank_india_enterprise_survey_context.json`
- **Source Classification:** `EXTERNAL_REFERENCE / SURVEY_MICRODATA`
- **Codebase Search:** Zero imports or joins in `server/src`.
- **Audit Result:**
  - World Bank survey respondents are **NEVER** merged or joined with BPI enterprise vendors.
  - No artificial buyer IDs or invoice IDs were generated from World Bank records.
  - The dataset serves purely as contextual reference microdata. **VERIFIED**.

---

## 15. Database & Persistence Audit

- **Prisma Schema Inspection:**
  - Database stores: `Organization`, `User`, `Firm`, `Transaction`, `Relationship`, `ImportBatch`, `Scenario`, `SimulationRun`, `Deadlock`, `Recommendation`, `OptimizationRun`, `Alert`, `Report`.
  - Database **DOES NOT** store ML model weights, training runs, or feature metadata.
  - `MultiTenantModelRegistry` and `BPIEnterprisePipeline.predictionStore` operate **IN MEMORY** via Node.js runtime memory structures (`Map`).
  - **Forensic Status:** Models and predictions are ephemeral to the server process lifecycle.

---

## 16. Reproducibility Test

- **Execution:** Automated via Vitest (`tests/phase8_full_ml_pipeline.test.ts`).
- **Result:** **100% PASS (17 out of 17 tests passed in 952ms)**.
- **Entire Server Suite:** **225 out of 225 tests passed across 14 test suites in 26.92s**.
- **Reproducibility Verdict:** **`REPRODUCIBLE = YES`**. Any engineer can run `npm test` and execute the full end-to-end pipeline deterministically from scratch.

---

## 17. Final Evidence Checklist

| Item | Evidence Classification | Key Forensic Reason |
| :--- | :---: | :--- |
| **BPI raw data (694 MB)** | **UNVERIFIED** | Full 694 MB XES archive not present on local disk. |
| **BPI canonical dataset (28 KB)** | **VERIFIED** | Curated 25-case representative sample exists and conforms to schema. |
| **BPI provenance metadata** | **VERIFIED** | 4TU DOI, CC BY 4.0 license, and domain disclaimers verified. |
| **Canonical transformation** | **VERIFIED** | Normalizes ERP events with zero fabricated contractual due dates. |
| **Target construction** | **VERIFIED** | Observable duration and operational threshold (>45d) correctly calculated. |
| **Feature engineering** | **VERIFIED** | 22 pre-$t_0$ features computed strictly prior to prediction point. |
| **Anti-leakage prevention** | **VERIFIED** | Post-outcome clearing events hard-blocked by automated auditor. |
| **Temporal split & embargo** | **VERIFIED** | Chronological ordering enforced with 14-day embargo gap. |
| **Actual model training** | **VERIFIED** | Real gradient descent and decision stump algorithms execute. |
| **Model artifact storage** | **PARTIALLY VERIFIED** | Managed in-memory; not serialized to disk or PostgreSQL. |
| **Claimed ROC-AUC (0.875)** | **FAILED** | Idealized report claim; actual validation ROC-AUC is 0.6667 on 5-case split. |
| **Claimed PR-AUC (0.832)** | **FAILED** | Idealized report claim; actual validation PR-AUC is 0.7500 on 5-case split. |
| **Claimed ECE (0.042)** | **FAILED** | Idealized report claim; actual ECE is 0.1609 and status is UNCALIBRATED ($N < 100$). |
| **Claimed MAE (4.12)** | **FAILED** | Idealized claim; classification pipeline does not compute MAE. |
| **Model Registry & Governance** | **VERIFIED** | Enforces lifecycle states, approval roles, and tenant boundaries. |
| **Simulated Data Firewall** | **VERIFIED** | Server-side firewall actively blocks synthetic/demo models. |
| **Graph & Cascade Integration** | **VERIFIED** | ML risk mapped to nodes; simulation watermarked as HYPOTHETICAL. |
| **Smart Resolution Engine** | **VERIFIED** | Produces 7-parameter structured decision-support recommendations. |
| **Dashboard ML Panel** | **VERIFIED** | Connected to backend APIs across all three user dashboards. |
| **World Bank Data Isolation** | **VERIFIED** | Maintained strictly as external survey reference; zero joins. |
| **System Reproducibility** | **VERIFIED** | Deterministically reproducible via automated test suites. |

---

## 18. Final Verdict & Recommended Next Actions

### Final Forensic Classification:
**`D. IMPLEMENTATION VERIFIED BUT METRICS UNVERIFIED`**

### Summary of Truth:
1. **The engineering implementation is real, clean, and complete:** The mathematical algorithms, data pipelines, anti-leakage guards, model benchmark suite, calibration logic, and decision engines are fully coded and functional.
2. **The local data is a curated sample:** The system trains on a 25-case sample (`bpi_challenge_2019_canonical.json`), not the full 251,734 cases of the official 694 MB BPI 2019 dataset.
3. **The reported metrics were idealized:** The previously reported numbers ($\text{ROC-AUC} = 0.875, \text{PR-AUC} = 0.832, \text{ECE} = 0.042$) were synthetic benchmark figures in documentation, whereas the actual dynamic calculation on the 5-case validation set produces $\text{ROC-AUC} = 0.6667, \text{PR-AUC} = 0.7500, \text{ECE} = 0.1609$.
4. **Zero fabrication in transaction data:** The codebase refuses to fabricate due dates, refuses to join World Bank survey responses to BPI vendors, and refuses to misrepresent operational process durations as contractual delinquency.

### Recommended Next Actions (In Production Order):
1. **Download Full BPI Challenge 2019 Archive:** If large-scale training is required, download the full 694.81 MB XES dataset from 4TU.ResearchData (`10.4121/uuid:d06aff4b-79f0-45e6-8ec8-e19730c248f1`) into an ingestion batch.
2. **Persist Model Registry to Database:** Add a `ModelArtifact` table to Prisma to persist model weights across server restarts instead of relying on in-memory Maps.
3. **Display Dynamic Validation Metrics in Dashboard:** Ensure dashboard metric displays bind strictly to `deployedModel.evaluationMetrics.validation` without falling back to constant defaults (`0.86, 0.82, 0.80`).
4. **Maintain Strict Enterprise Isolation:** Continue enforcing the boundary between public process datasets and authorized tenant ERP ledgers.
