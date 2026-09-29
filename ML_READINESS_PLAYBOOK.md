# NEXUS-CFR ML Readiness & Production Onboarding Playbook

**Operational Directive:** Execution procedure when authorized primary enterprise transaction data arrives.

---

## The 17-Step Autonomous Handshake

```
               ENTERPRISE DATA ARRIVAL
                         │
                         ▼
Step 1:  Verify Corporate Authorization & Legal Processing Consent
Step 2:  Verify Cryptographic Provenance & Origin Source Stamp
Step 3:  Snapshot Raw Payloads to Tamper-Evident Ledger Storage
Step 4:  Ingest via Phase 3.9 Connectors (Tally, Zoho, SAP, QuickBooks, TReDS)
Step 5:  Normalize into CanonicalInvoiceContract v3.9
Step 6:  Deduplicate via SHA-256 Voucher Idempotency Hashes
Step 7:  Execute Data Quality Pipeline (Completeness, Validity, Consistency)
Step 8:  Run 20-Point Objective ML Readiness Gate (MLReadinessGate)
Step 9:  Assess Right-Censoring Rate & Apply Exclusion Criteria
Step 10: Run Automated Anti-Leakage Feature Audit
Step 11: Build Reproducible Versioned ML Dataset (MLDatasetBuilder)
Step 12: Partition Cohorts Chronologically (Train 60% / Val 20% / Test 20%)
Step 13: Train Baseline Interpretable Regularized Model
Step 14: Evaluate Out-of-Time Performance (ROC-AUC, PR-AUC, Brier, MAE)
Step 15: Fit Probability Calibration (Platt Scaling if Val N >= 100)
Step 16: Extract Global Feature Importance & Local Attribution Vectors
Step 17: Register Artifact in Multi-Tenant Model Registry
                         │
                         ▼
        FORMAL CRO / ADMIN GOVERNANCE SIGN-OFF
                         │
                         ▼
                 DEPLOY TO PRODUCTION
```

---

## Step-by-Step Operational Instructions

### Step 1: Ingest & Normalize via Canonical Contract
- Authenticate via `/api/connectors` using authorized credentials (OAuth2 / Mutual TLS / Gateway).
- Normalize raw vouchers into `CanonicalInvoiceContract`:
  - `invoice_number`, `sme_id`, `buyer_id`, `invoice_amount` (>0), `invoice_date`, `due_date` (> invoice_date).
- Never allow manual editing of raw ingested ledgers.

### Step 2: Evaluate 20-Point Readiness Gate
- Execute `GET /api/ml/readiness`.
- Verify the following mandatory thresholds:
  1. `sourceClassification` = `REAL_OBSERVED_ENTERPRISE`.
  2. `isEnterpriseAuthorized` = `true`.
  3. Completed vouchers $\ge 1,000$.
  4. Unique corporate buyers $\ge 50$.
  5. Longitudinal span $\ge 12$ months.
  6. Right-censoring rate $\le 50\%$.
  7. Automated leakage scan = `CLEAN`.
- If status is `LOCKED`, inspect `exactBlockers` in the diagnostic report and rectify data feed.

### Step 3: Target Construction & Censoring Filtering
- **Settled Invoices**:
  $$\text{label} = \begin{cases} 1 & \text{if } \text{paymentDate} > \text{dueDate} \\ 0 & \text{otherwise} \end{cases}$$
- **Open Invoices**:
  - If $\text{currentDate} > \text{dueDate}$: Delinquent ($\text{label} = 1$), duration censored.
  - If $\text{currentDate} \le \text{dueDate}$: **Right-censored observation**. Exclude from binary delay training.
  - *Strict Warning:* Never impute zero delay or due date clearing for open invoices.

### Step 4: Temporal Partitioning
- Sort records chronologically by `invoiceDate`.
- Partition into non-overlapping epochs:
  - Train Set: First 60% of timeline.
  - Validation Set: Middle 20% of timeline.
  - Out-of-Time Test Set: Final 20% of timeline.
- Verify that $\max(t_{\text{train}}) \le \min(t_{\text{val}}) \le \max(t_{\text{val}}) \le \min(t_{\text{test}})$.

### Step 5: Feature Extraction Strictly Pre-$t_0$
- Active features: `invoiceAmount`, `creditPeriodDays`, `buyerHistoricalDelayMean30d`, `buyerHistoricalDelayMean90d`, `buyerOverdueRatioPreT0`, `supplierTrailingVolume90d`, `amountRelativeToBuyerAvg`, `networkBuyerInDegreePreT0`, `networkSupplierConcentrationPreT0`.
- Only consider completed events where $\text{clearingTimestamp} < t_0$.
- Generate immutable SHA-256 snapshot hash for feature vector.

### Step 6: Model Fitting & Evaluation
- Fit baseline L2-regularized Logistic Regression and Decision Forest.
- Evaluate on Out-of-Time holdout:
  - Primary Metric for Class Imbalance: **PR-AUC (Average Precision)**.
  - Discrimination: **Trapezoidal ROC-AUC**.
  - Probability Accuracy: **Brier Score**.
  - Duration Severity: **MAE & RMSE**.
- Do not report unweighted accuracy as the primary metric.

### Step 7: Governance Sign-off & Production Promotion
- Model is registered in state `EXPERIMENTAL`.
- Compliance Officer / Chief Risk Officer inspects Out-of-Time metrics and fairness diagnostics.
- Transition lifecycle via `POST /api/ml/models/:id/transition`:
  - `EXPERIMENTAL` $\to$ `APPROVED` (Requires `ADMIN` or `SME_ADMIN`).
  - `APPROVED` $\to$ `DEPLOYED` (Activates real-time inference in `PredictionService`).

### Step 8: Continuous Monitoring & Drift Alerting
- Run periodic drift audit via `GET /api/ml/monitoring`.
- Compute Population Stability Index (PSI) per feature:
  - If $\text{PSI} \ge 0.25$, flag model for automatic retraining.
- Update realized performance as historical credit horizons mature.
