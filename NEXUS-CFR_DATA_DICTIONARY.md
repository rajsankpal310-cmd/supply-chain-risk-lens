# NEXUS-CFR Enterprise Data Dictionary & Feature Specification
**Machine-Readable Canonical Transaction Contract & Leakage Governance Standard**
*Phase 5 Architecture Specification*

---

## 1. Overview
This data dictionary defines the canonical invoice transaction contract for NEXUS-CFR. Every ingested record from ERP systems (TallyPrime, Zoho Books, SAP S/4HANA, QuickBooks Online), factoring exchanges (TReDS), or controlled enterprise file exports must strictly map to these definitions.

---

## 2. Canonical Transaction Fields Specification

### 2.1 `transaction_id`
- **Data Type:** `String (1-128 chars)`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** Unique business or voucher identification string assigned by the issuing ERP system (e.g. Invoice Number, Voucher Number).
- **Valid Range:** Non-empty, alphanumeric string with standard delimiters (`-`, `/`, `_`, `.`).
- **Timestamp Meaning:** Static business identifier.
- **ML Eligibility:** **EXCLUDED FROM FEATURES** (High-cardinality identity token; uninformative for generalization).
- **Leakage Classification:** `METADATA_ONLY` — Safe identifier.

---

### 2.2 `sme_id`
- **Data Type:** `String (UUID or standard entity code)`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** Unique identifier of the selling SME entity within the NEXUS-CFR multi-tenant boundary.
- **Valid Range:** Must exist in tenant's Firm registry or map to verified supplier profile.
- **Timestamp Meaning:** Entity master record key.
- **ML Eligibility:** **ELIGIBLE FOR HISTORICAL AGGREGATES ONLY** (e.g., SME historical delay frequency pre-$t_0$).
- **Leakage Classification:** `ENTITY_RESTRICTED` — Direct categorical encoding prohibited to prevent entity leakage; aggregate historical statistics strictly pre-$t_0$ permitted.

---

### 2.3 `buyer_id`
- **Data Type:** `String (1-128 chars)`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** Unique debtor or buyer enterprise counterparty identifier (normalized to GSTIN or ERP master ID).
- **Valid Range:** Verified corporate tax identifier or isolated customer master key.
- **Timestamp Meaning:** Entity master record key.
- **ML Eligibility:** **ELIGIBLE FOR HISTORICAL AGGREGATES ONLY** (e.g., buyer 90-day historical default rate pre-$t_0$).
- **Leakage Classification:** `ENTITY_RESTRICTED` — Direct identity token prohibited in cross-validation splits to avoid memorizing individual corporate solvency.

---

### 2.4 `supplier_id`
- **Data Type:** `String (1-128 chars)`
- **Mandatory / Optional:** **OPTIONAL** (Defaults to `sme_id` if single-tier vendor).
- **Semantic Meaning:** Explicit vendor ID when invoice involves sub-tier supplier factoring or marketplace intermediary.
- **Valid Range:** Non-empty string.
- **Timestamp Meaning:** Entity master record key.
- **ML Eligibility:** **METADATA**
- **Leakage Classification:** `ENTITY_RESTRICTED`.

---

### 2.5 `invoice_amount`
- **Data Type:** `Float (64-bit IEEE 754)`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** Gross monetary value of the commercial invoice including statutory taxes.
- **Valid Range:** `0.01` to `1,000,000,000.00` (Strictly positive; negative values rejected; zero quarantined).
- **Timestamp Meaning:** Transaction value established at `invoice_date`.
- **ML Eligibility:** **ELIGIBLE PRE-T0 FEATURE** (Subject to log-transformation and financial outlier clipping).
- **Leakage Classification:** `LEAKAGE_FREE_PRE_T0` — Known at invoice issuance.

---

### 2.6 `invoice_date`
- **Data Type:** `ISO 8601 Date String (YYYY-MM-DD)`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** Legal date on which the invoice was generated and transmitted to the counterparty.
- **Valid Range:** Valid calendar date between `2000-01-01` and `current_date` (future dates strictly quarantined).
- **Timestamp Meaning:** Event occurrence timestamp ($t_{\text{issue}}$).
- **ML Eligibility:** **ELIGIBLE FOR TEMPORAL PARTITIONING & CALENDAR FEATURES** (e.g., day of week, month of year).
- **Leakage Classification:** `TEMPORAL_ANCHOR` — Foundation for feature look-back horizons.

---

### 2.7 `due_date`
- **Data Type:** `ISO 8601 Date String (YYYY-MM-DD)`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** Contractual payment deadline agreed in commercial terms (Net 30, Net 60, etc.).
- **Valid Range:** Must satisfy `due_date >= invoice_date`.
- **Timestamp Meaning:** Contractual maturity timestamp ($t_{\text{due}}$).
- **ML Eligibility:** **ELIGIBLE PRE-T0 FEATURE** (Derived `credit_period_days = due_date - invoice_date`).
- **Leakage Classification:** `LEAKAGE_FREE_PRE_T0` — Fixed at contract initiation.

---

### 2.8 `payment_date`
- **Data Type:** `ISO 8601 Date String (YYYY-MM-DD) or Null`
- **Mandatory / Optional:** **OPTIONAL** (Null for open / unpaid invoices).
- **Semantic Meaning:** Date on which payment clearing or settlement occurred.
- **Valid Range:** When present, must satisfy `payment_date >= invoice_date`.
- **Timestamp Meaning:** Outcome resolution timestamp ($t_{\text{pay}}$).
- **ML Eligibility:** **STRICTLY EXCLUDED FROM PRE-T0 FEATURES; USED EXCLUSIVELY FOR TARGET CONSTRUCTION**.
- **Leakage Classification:** `CRITICAL_TARGET_LEAKAGE` — Prohibited in feature vectors. Any model receiving `payment_date` as a feature is immediately disqualified.

---

### 2.9 `credit_period`
- **Data Type:** `Integer (days)`
- **Mandatory / Optional:** **OPTIONAL / DERIVABLE**
- **Semantic Meaning:** Number of days granted to the debtor for payment (`due_date - invoice_date`).
- **Valid Range:** `0` to `365` days (Values $> 180$ generate quality warnings; negative values quarantined).
- **Timestamp Meaning:** Contract parameter at $t_{\text{issue}}$.
- **ML Eligibility:** **ELIGIBLE PRE-T0 FEATURE**.
- **Leakage Classification:** `LEAKAGE_FREE_PRE_T0`.

---

### 2.10 `outstanding_amount`
- **Data Type:** `Float (64-bit IEEE 754)`
- **Mandatory / Optional:** **OPTIONAL**
- **Semantic Meaning:** Remaining unpaid balance at current observation time.
- **Valid Range:** `0.00` to `invoice_amount`.
- **Timestamp Meaning:** Dynamic state at extraction time.
- **ML Eligibility:** **RESTRICTED** — Can only be used if captured at historical snapshot timestamp $t_0$, never post-$t_0$.
- **Leakage Classification:** `TEMPORAL_LEAKAGE_RISK` — Prohibited in backtested models unless historical delta is mathematically verified.

---

### 2.11 `payment_status`
- **Data Type:** `Categorical String`
- **Mandatory / Optional:** **OPTIONAL**
- **Semantic Meaning:** Ingestion status (`PAID`, `SETTLED`, `OPEN`, `OVERDUE`, `DISPUTED`, `WRITTEN_OFF`).
- **Valid Range:** One of standard enum tokens.
- **Timestamp Meaning:** Status at observation date.
- **ML Eligibility:** **EXCLUDED FROM PREDICTIVE FEATURES** (Direct proxy for outcome label).
- **Leakage Classification:** `CRITICAL_TARGET_LEAKAGE`.

---

### 2.12 `currency`
- **Data Type:** `String (3-letter ISO 4217)`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** Monetary billing denomination (Default: `INR`).
- **Valid Range:** Standard ISO currency codes.
- **Timestamp Meaning:** Contract currency.
- **ML Eligibility:** **METADATA** (Filtered for single-currency consistency or normalized using historical exchange rates).
- **Leakage Classification:** `LEAKAGE_FREE_PRE_T0`.

---

### 2.13 `source_system`
- **Data Type:** `String (1-64 chars)`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** Originating ERP or accounting connector (`TALLYPRIME`, `ZOHO_BOOKS`, `SAP_S4HANA`, `QUICKBOOKS_ONLINE`, `TREDS_SANDBOX`, `CONTROLLED_FILE_EXPORT`).
- **Valid Range:** Supported provider registry token.
- **Timestamp Meaning:** Provenance descriptor.
- **ML Eligibility:** **GOVERNANCE METADATA ONLY**.
- **Leakage Classification:** `PROVENANCE_RESTRICTED`.

---

### 2.14 `source_record_id`
- **Data Type:** `String (1-128 chars)`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** Primary key within the native ERP database (e.g., Tally GUID, Zoho invoice_id, SAP AccountingDocument).
- **Valid Range:** Non-empty string.
- **Timestamp Meaning:** Source system identifier.
- **ML Eligibility:** **EXCLUDED**.
- **Leakage Classification:** `METADATA_ONLY`.

---

### 2.15 `extracted_at`
- **Data Type:** `ISO 8601 Timestamp String`
- **Mandatory / Optional:** **MANDATORY**
- **Semantic Meaning:** System timestamp when the data ingestion connector extracted the raw voucher.
- **Valid Range:** Accurate UTC timestamp.
- **Timestamp Meaning:** Ingestion pipeline anchor ($t_{\text{ingest}}$).
- **ML Eligibility:** **AUDIT ONLY**.
- **Leakage Classification:** `METADATA_ONLY`.
