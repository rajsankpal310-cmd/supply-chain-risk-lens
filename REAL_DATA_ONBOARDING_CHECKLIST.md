# NEXUS-CFR — Real Data Onboarding Checklist
**Standard Operating Procedure for Primary Enterprise Data Onboarding**
*Governed under Phase 5: Real Authorized Data Acquisition Architecture*

---

## 1. Enterprise Authority & Legal Consent Handshake
Before any enterprise ledger data is connected, extracted, or normalized, the client enterprise must formally execute the following data processing authorization:

- [ ] **Corporate Entity Name:** Registered legal corporate name of the enterprise.
- [ ] **Corporate Identification Number (CIN) / Registration:** Official statutory company registrar identification.
- [ ] **Authorized Legal Signatory:** Full Name, Corporate Title (e.g., CFO, Director of Finance, Controller), Corporate Email, and Department.
- [ ] **Signed Data Processing Consent Reference ID:** Internal or legal consent artifact reference ID (e.g., `CONSENT-IN-2026-XXXX`).
- [ ] **Explicit Extraction Purpose:** Documented financial risk analysis purpose (e.g., *"SME Credit Risk Assessment, Early Warning Indicator Computation, and Supply Chain Resilience Optimization"*).
- [ ] **Authorized Data Scope:** Explicit boundary of tables/ledgers authorized (e.g., *"Sales Vouchers, Credit Notes, Bank Clearing Reconciliations FY 2024-2026"*).
- [ ] **Statutory Retention Policy:** Minimum retention and deletion horizon (Standard: `7_YEARS_STATUTORY_COMPLIANCE`).
- [ ] **Revocation Contact:** Designated email and officer authorized to issue formal data connection revocation.

---

## 2. Primary Accounting & ERP Source System Details
- [ ] **Supported Source Class Selection:**
  - `TALLYPRIME` (v3.0 / v4.0 / v4.1 via XML / ODBC / Export)
  - `ZOHO_BOOKS` (REST API v3 OAuth 2.0)
  - `QUICKBOOKS_ONLINE` (Intuit Accounting API v3 OAuth 2.0)
  - `SAP_S4HANA` (OData API `API_OP_JOURNALENTRY_SRV`)
  - `TREDS_SANDBOX` (RXIL / M1xchange / Invoicemart standard format)
  - `CONTROLLED_FILE_EXPORT` (Cryptographically attested CSV / Excel signed export)
- [ ] **Source Deployment Environment:** On-premise server / Private cloud / Vendor SaaS instance.
- [ ] **ERP Schema Version:** Specific ERP release / schema version (e.g., TallyPrime 4.1, SAP S/4HANA Cloud 2023.2).
- [ ] **Access Credentials (Encrypted / Masked):** Read-only service account credentials or OAuth application client credentials. Under no circumstances are write permissions or administrative master credentials requested.
- [ ] **Extraction Cadence:** Batch one-time historical baseline sync vs scheduled periodic delta synchronization (daily / weekly / monthly).

---

## 3. Mandatory Transaction Fields (`CanonicalInvoiceContract`)
Every extracted commercial voucher must contain non-null values for the following mandatory fields:

| Field Name | Type | Contract Rule | Description |
| :--- | :--- | :--- | :--- |
| `transaction_id` | String | Unique within Source | Primary invoice or voucher number |
| `sme_id` | String | Non-empty | Unique identifier or legal entity of the supplier SME |
| `buyer_id` | String | Non-empty | Unique identifier or commercial ledger name of the buyer |
| `invoice_amount` | Positive Float | `> 0.00` | Total monetary face value of commercial invoice |
| `invoice_date` | Date (ISO 8601) | `YYYY-MM-DD` | Date of invoice issuance |
| `due_date` | Date (ISO 8601) | `>= invoice_date` | Contractual maturity / net payment due date |
| `currency` | String | ISO 4217 (e.g. `INR`) | Statutory billing currency |

---

## 4. Payment Outcome & Clearing Information
To be eligible for supervised ML target formulation (`PAYMENT_DELAY_RISK`, `SEVERE_DELINQUENCY_RISK`), transaction ledgers must include historical settlement outcomes:

- [ ] **Payment Settlement Date (`payment_date`):** Bank clearing date or payment voucher posting date. Must satisfy `payment_date >= invoice_date`.
- [ ] **Payment Status Indicator (`payment_status`):** Explicit categorical state (`PAID`, `SETTLED`, `PARTIALLY_PAID`, `OPEN`, `OVERDUE`, `DISPUTED`, `WRITTEN_OFF`).
- [ ] **Outstanding Balance (`outstanding_amount`):** Current remaining unsettled monetary balance (`0.00` for completed invoices).
- [ ] **Handling of Open Immature Invoices:** Vouchers where `payment_date` is absent and `current_date < due_date` are strictly treated as right-censored observations. They are **never** imputed as defaults or negative outcomes.

---

## 5. Counterparty Identity & Conservative Entity Resolution
To prevent entity leakage and superficial fuzzy matching errors:

- [ ] **Buyer Tax Identifier (GSTIN / PAN / CIN):** Verified 15-character Indian Goods and Services Tax Identification Number or equivalent corporate identifier.
- [ ] **SME Supplier Tax Identifier (GSTIN / PAN):** Verified 15-character GSTIN of the supplier entity.
- [ ] **ERP Master Customer Code:** Internal debtor master ID from the source ERP.
- [ ] **Anti-Fuzzy Invariant:** Entities sharing approximate name strings (e.g. *"Tata Motors Ltd"* vs *"Tata Steel Ltd"*) will **not** be merged automatically without matching tax identifiers. Ambiguous entities remain isolated.

---

## 6. Historical Period & Statistical Sufficiency Criteria
For the incoming dataset to unlock the 20-Point Machine Learning Readiness Gate:

- [ ] **Minimum Settled Invoices:** $\ge 1,000$ completed, mature historical transactions.
- [ ] **Minimum Unique Commercial Buyers:** $\ge 50$ distinct commercial enterprise counterparties.
- [ ] **Minimum Unique SME Suppliers:** $\ge 10$ distinct suppliers.
- [ ] **Temporal Coverage:** Continuous historical ledger spanning $\ge 12$ consecutive months (minimum 1 full working capital operating cycle).
- [ ] **Maximum Buyer Concentration:** Single largest buyer must not exceed $75.0\%$ of total invoice volume (Herfindahl-Hirschman Index $HHI < 0.60$).
- [ ] **Positive Event Maturity:** $\ge 100$ observed delayed payment transactions ($T_{\text{pay}} > T_{\text{due}}$).

---

## 7. Data Handover & Cryptographic Attestation
- [ ] **Extraction Checksum:** SHA-256 payload digest computed at source extraction time.
- [ ] **Raw Snapshot Delivery:** Immutable ingest into `RawSnapshotService` generating verifiable schema fingerprints.
- [ ] **Audit Reconciliation Review:** Successful execution of Stage Accounting Reconciliation:
$$\text{Source Extracted} \equiv \text{Raw Snapshot} \equiv \text{Canonical Normalization} \equiv \text{Accepted} + \text{Rejected} + \text{Quarantined}$$
- [ ] **Data Owner Sign-off:** Formal electronic attestation that the delivered dataset reflects actual observed accounting records with zero synthetic fabrication.
