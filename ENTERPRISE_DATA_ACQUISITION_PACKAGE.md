# NEXUS-CFR — ENTERPRISE DATA ACQUISITION PACKAGE
## INSTRUCTIONS FOR SME FINANCE, ACCOUNTING & IT TEAMS
### PHASE 7: GENUINE PRIMARY ENTERPRISE DATA ONBOARDING

**System:** NEXUS-CFR — SME Financial Risk & Supply Chain Resilience  
**Mission:** Enable secure, governed ingestion of real historical accounts receivable/payable transaction ledgers without exposing sensitive personal identifiable information (PII).

---

## 1. Overview & Purpose

NEXUS-CFR trains credit resilience and cash-flow shock prediction models strictly on **authorized, real-world commercial transaction lifecycles**. 

To onboard your organization, your finance or accounting team must provide an export of historical sales/purchase invoices covering settled and open commercial vouchers.

---

## 2. Privacy, Security & Data Minimization Guarantees

NEXUS-CFR is designed under strict data minimization and regulatory compliance principles:

### What We Strictly Require:
- Transaction / Invoice Identifier
- Transaction Amounts (Gross Total, Outstanding Balance)
- Transaction Dates (Invoice Date, Due Date, Payment Settled Date)
- Agreed Credit Terms (Credit Period in Days)
- Commercial Status (PAID, SETTLED, OVERDUE, PENDING, OPEN)

### What We DO NOT Collect or Require:
> [!IMPORTANT]
> **DO NOT INCLUDE ANY OF THE FOLLOWING SENSITIVE ITEMS IN YOUR EXPORT:**
> - ✕ Customer or vendor personal names
> - ✕ Physical billing/shipping addresses
> - ✕ Telephone numbers or personal email addresses
> - ✕ Bank account numbers, IFSC codes, or SWIFT details
> - ✕ Individual PAN, Aadhaar, or Social Security numbers
> - ✕ Passwords, API tokens, or ERP credentials

### Anonymization & Pseudonymization Encouraged:
You may replace proprietary customer and vendor names with internal anonymous surrogate identifiers (e.g., replace *"Tata Motors Ltd"* with `BUYER-OEM-01`, and replace *"ABC Enterprises"* with `SME-AUTO-01`).

---

## 3. Data Export Specification & Column Dictionary

The export should be formatted as a standard UTF-8 CSV or JSON file containing the following columns:

| Column Name | Data Type | Mandatory? | Description & Allowed Format |
|---|---|---|---|
| `transaction_id` | String | **YES** | Unique voucher or invoice number (e.g., `INV-2024-001`). |
| `sme_id` | String | **YES** | Identifier of the selling enterprise or business unit (e.g., `SME-01`). |
| `buyer_id` | String | **YES** | Identifier of the debtor / corporate buyer (e.g., `BUYER-101`). |
| `supplier_id` | String | *Optional* | Upstream supplier ID if supply-chain network tracing is used. |
| `invoice_amount` | Number | **YES** | Total gross invoice amount in document currency (must be $> 0$). |
| `invoice_date` | Date | **YES** | Invoice issuance date in `YYYY-MM-DD` format (e.g., `2024-01-15`). |
| `due_date` | Date | **YES** | Contractual payment due date in `YYYY-MM-DD` format ($\ge$ `invoice_date`). |
| `payment_date` | Date | *Conditional* | Date payment actually cleared bank. Leave blank/empty for unpaid invoices. |
| `credit_period` | Integer | *Optional* | Agreed credit terms in days (e.g., `30`, `45`, `60`, `90`). Defaults to `due_date - invoice_date`. |
| `outstanding_amount` | Number | *Optional* | Current unpaid balance. `0` for fully paid invoices. |
| `payment_status` | String | **YES** | Allowed: `PAID`, `SETTLED`, `OVERDUE`, `PENDING`, `OPEN`, `WRITTEN_OFF`. |
| `currency` | String | *Optional* | ISO-4217 currency code (e.g., `INR`, `USD`). Defaults to `INR`. |

---

## 4. Corporate Legal Authorization Checklist

Before primary enterprise data can be ingested into NEXUS-CFR, the data owner must declare formal corporate consent. Prepare the following information prior to upload:

1. **Corporate Entity Name:** Legal registered entity name (e.g., *"Apex Precision Engineering Pvt Ltd"*).
2. **Corporate Registration / CIN:** MCA Corporate Identity Number or MSME Udyam Registration number.
3. **Authorized Corporate Signatory:** Full legal name of authorized officer (e.g., CFO, Director, Controller).
4. **Signatory Designation:** Official executive title of the signatory.
5. **Legal Consent Agreement Reference ID:** Internal board resolution ID, data sharing agreement number, or reference token (e.g., *"DSA-2026-APEX-001"*).
6. **Data Scope:** Acknowledgment that data represents commercial accounts receivable/payable ledgers.

---

## 5. Step-by-Step Ingestion Procedure

### Method A: Web Application Workspace (Recommended)
1. Log in to the NEXUS-CFR portal with your tenant administrator credentials.
2. Navigate to **Data Management** -> **Upload & Connect** -> **Real Data Acquisition** tab.
3. Click **[UPLOAD AUTHORIZED DATA EXPORT]**.
4. Fill in the Corporate Authorization modal:
   - Corporate Entity Name
   - Registration Number
   - Signatory Name & Title
   - Consent Reference ID
5. Attach your completed `.csv` export file.
6. Click **Confirm & Ingest Authorized Data**.
7. The platform immediately performs:
   - Cryptographic SHA-256 snapshotting
   - Double-entry reconciliation
   - Data quality audit
   - 20-Point ML Readiness Gate evaluation
8. Review the real data summary breakdown and readiness report.

### Method B: Automated REST API Endpoint
Enterprise ERP systems can transmit signed exports directly via HTTPS:

```bash
curl -X POST https://your-nexus-host/api/connectors/controlled-file/ingest \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "apex_ledger_q1_2026.csv",
    "corporateEntityName": "Apex Precision Engineering Pvt Ltd",
    "corporateRegistrationNumber": "U29253MH2018PTC123456",
    "authorizedSignatoryName": "Rajesh Sharma",
    "signatoryTitle": "Chief Financial Officer",
    "legalConsentReferenceId": "DSA-2026-APEX-001",
    "provenance": "REAL_OBSERVED_ENTERPRISE",
    "rawPayload": "transaction_id,sme_id,buyer_id,supplier_id,invoice_amount,invoice_date,due_date,payment_date,credit_period,outstanding_amount,payment_status,currency\n..."
  }'
```

---

## 6. Understanding Ingestion vs. ML Training

- **Initial Data Acquisition is NEVER Blocked by Statistical Power:**  
  Even if your initial export contains 250 invoices or 15 buyers, the system will **accept, reconcile, and safely store your data** as `REAL_OBSERVED_ENTERPRISE`.
- **Machine Learning Unlock Thresholds:**  
  Supervised training of production models automatically unlocks once cumulative historical ledger depth reaches:
  - $\ge 1,000$ completed invoices
  - $\ge 50$ distinct commercial buyers
  - $\ge 12$ consecutive months of coverage
  - $\ge 100$ delayed payment events
- If statistical power is not yet satisfied, data remains safely governed and the ML gate remains **`LOCKED`** with an exact transparent breakdown of progress.
