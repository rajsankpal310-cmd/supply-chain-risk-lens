# NEXUS-CFR — Phase 3.9: Primary Data Access & Enterprise Ingestion Architecture

## Executive Summary & Engineering Mandate

Phase 3.8 conclusively established that in the global open data domain, genuine transaction-level accounts receivable records with identifiable commercial counterparties, billing amounts, due dates, and settlement timestamps are **confidential corporate proprietary assets protected by banking secrecy, trade secrets doctrine, and data privacy legislation** (such as India's Digital Personal Data Protection Act 2023 and EU GDPR). Public datasets circulating on Kaggle or GitHub are synthetically generated or curriculum educational exercises.

Therefore, Phase 3.9 solves the actual remaining bottleneck by building the **Production-Ready Enterprise Ingestion Layer** through which genuine primary corporate data can enter NEXUS-CFR:

> **MISSION:** Transform  
> *"ML BLOCKED because primary transaction data is unavailable"*  
> into  
> *"ML BLOCKED only because no authorized enterprise dataset has yet been connected, while the complete secure ingestion architecture is ready for such data."*

---

## 1. Why Public Transaction Data is Insufficient

| Attribute | Public / Synthetic Benchmarks (e.g. Kaggle / IBM Sample) | Enterprise Primary Transaction Ledgers (e.g. ERP / TReDS) |
| :--- | :--- | :--- |
| **Authenticity** | `SYNTHETIC` or `SIMULATED` parametric generations. | `REAL_OBSERVED` primary banking and accounting records. |
| **Legal Status** | Test assignments, tutorials, hackathon datasets. | Legally binding commercial invoices and bank clearings. |
| **Counterparty Realism** | Pseudonymized dummy IDs without GSTIN/PAN tax validity. | Verified corporate entities with legal tax registrations. |
| **Statistical Sufficiency** | Artificially uniform or small ($N=50$ to $N=2,467$). | Longitudinal ($N \ge 10,000+$ over multi-year cycles). |
| **Right-Censoring** | Often artificially settled (missing payment dates naive zero). | Real-time observation window with genuine open receivables. |
| **Scientific Validity** | **Zero predictive generalizability**; creates false ML claims. | **Statistically defensible foundation** for credit risk ML. |

---

## 2. Primary Data Strategy & Architecture

NEXUS-CFR adopts a provider-agnostic, decoupled ingestion pipeline:

```
[ Enterprise Source: Tally / SAP / Zoho / QuickBooks / TReDS / File Drop ]
                                    │
                                    ▼
                         [ AUTHENTICATION GATE ]
             (OAuth2 / Mutual TLS / API Key / Local Gateway)
                                    │
                                    ▼
                       [ CONTROLLED EXTRACTION ]
                       (Delta / Incremental Fetch)
                                    │
                                    ▼
                         [ CANONICAL MAPPING ]
              (Provider Schema -> CanonicalInvoiceContract)
                                    │
                                    ▼
                    [ BUSINESS & QUALITY VALIDATION ]
            (Deterministic Rules: Dates, Amounts, Statuses)
                                    │
                                    ▼
                        [ DUPLICATE DETECTION ]
               (Exact Voucher & Potential Duplicate Audit)
                                    │
                                    ▼
                        [ PROVENANCE PERSISTENCE ]
              (Immutable ImportBatch, SHA-256 Hash, Actor)
                                    │
                                    ▼
                     [ MULTI-TENANT DATABASE STORE ]
            (PostgreSQL nexuscfr with Organization Scoping)
                                    │
                                    ▼
                         [ ML READINESS GATE ]
            (Re-evaluates N >= 1,000 & Out-of-Time Windows)
```

---

## 3. Canonical Transaction Contract

All external provider schemas map strictly into the immutable `CanonicalInvoiceContract` before entering the ingestion pipeline. No provider forces custom schema logic onto the core database.

### Schema Specification
```typescript
export interface CanonicalInvoiceContract {
  transaction_id: string;        // Unique invoice / voucher identifier
  sme_id: string;                // Operating SME / vendor identifier
  buyer_id: string;              // Customer / debtor enterprise identifier
  supplier_id?: string;          // Optional parent supplier identifier
  invoice_amount: number;        // Gross billing amount (strictly > 0)
  invoice_date: string;          // ISO 8601 date string (YYYY-MM-DD)
  due_date: string;              // ISO 8601 maturity date (>= invoice_date)
  payment_date?: string | null;  // ISO 8601 actual clearing date (nullable)
  credit_period: number;         // Contractual credit days (due_date - invoice_date)
  outstanding_amount: number;    // Current unpaid balance
  payment_status: "PAID" | "PENDING" | "OVERDUE" | "DISPUTED";
  currency: string;              // ISO 4217 Currency code (e.g. INR)
  source_system: string;         // Provider identifier (e.g. TALLY_PRIME, ZOHO_BOOKS)
  source_record_id: string;      // Raw system document ID / voucher key
  extracted_at: string;          // ISO 8601 extraction timestamp
  raw_payload?: Record<string, any>; // Preserved original payload for auditability
}
```

### Provider Schema Mapping Registry
NEXUS-CFR includes deterministic mappings in `server/src/pipeline/canonicalContract.ts`:
- **TallyPrime (TDL/XML):** `VOUCHERNUMBER` $\to$ `transaction_id`, `PARTYNAME` $\to$ `buyer_id`, `AMOUNT` $\to$ `invoice_amount`, `DATE` (YYYYMMDD) $\to$ `invoice_date`.
- **Zoho Books API v3:** `invoice_id` $\to$ `transaction_id`, `customer_id` $\to$ `buyer_id`, `total` $\to$ `invoice_amount`, `due_date` $\to$ `due_date`.
- **Intuit QuickBooks Online:** `DocNumber` $\to$ `transaction_id`, `CustomerRef.value` $\to$ `buyer_id`, `TotalAmt` $\to$ `invoice_amount`.
- **SAP S/4HANA OData:** `AccountingDocument` $\to$ `transaction_id`, `Customer` $\to$ `buyer_id`, `AmountInCompanyCodeCurrency` $\to$ `invoice_amount`.
- **TReDS Sandbox (RXIL/M1xchange):** `FactoringUnitId` $\to$ `transaction_id`, `BuyerGstin` $\to$ `buyer_id`, `FactoredAmount` $\to$ `invoice_amount`.
- **Controlled Enterprise File Export:** Direct mapping via interactive column profile inspector.

---

## 4. Source Connector Model & Current Status

In accordance with our zero-fabrication principle, connectors are classified with their genuine status:

| Connector Identifier | Name / Provider | Auth Protocol | Current Status | Integration Level | Evidence & Prerequisites |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CONN-FILE-CONTROLLED` | **Controlled Enterprise File Ingestion** | File Drop / Batch API | `CONNECTED` | **IMPLEMENTED** | Fully operational. Ingests CSV/JSON files with schema detection and Grade A quality scoring. |
| `CONN-TALLY-PRIME` | **TallyPrime Gateway** | On-Premise XML Gateway | `NOT_CONNECTED` | **READY FOR CONNECTION** | Implemented connector specification. Awaiting corporate gateway on `http://localhost:9000`. |
| `CONN-ZOHO-BOOKS` | **Zoho Books Cloud API** | OAuth2 v3 | `NOT_CONNECTED` | **READY FOR CONNECTION** | Implemented OAuth2 client specification. Awaiting enterprise Client ID/Secret and refresh token. |
| `CONN-QUICKBOOKS-ONLINE` | **Intuit QuickBooks Online** | OAuth2 v3 | `NOT_CONNECTED` | **READY FOR CONNECTION** | Implemented Intuit accounting specification. Awaiting Intuit App developer credentials. |
| `CONN-SAP-S4HANA` | **SAP S/4HANA Cloud** | Mutual TLS / OData | `NOT_CONNECTED` | **READY FOR CONNECTION** | Implemented OData Journal Entry specification. Awaiting SAP Communication Scenario setup. |
| `CONN-TREDS-SANDBOX` | **TReDS Factoring Exchange Sandbox** | API Key / REST | `NOT_CONNECTED` | **READY FOR CONNECTION** | Implemented TReDS factoring specification. Awaiting RBI participant API keys. |

---

## 5. Security & Tenant Isolation Model

1. **Strict Tenant Credential Partitioning:**
   - Every connector configuration is stored under `Map<organizationId:connectorId, TenantConnectorConfig>`.
   - Organization A (`ORG-001`) can never view, test, or trigger connectors configured by Organization Real (`ORG-003`).
2. **Credential Masking:**
   - Sensitive fields (`clientSecret`, `apiKey`, `clientCert`) are masked with `********` whenever queried over the API.
   - Raw secrets are never logged in terminal output or transmitted to the frontend.
3. **Audit Logging:**
   - All connection tests, configuration modifications, and synchronization executions create an immutable audit record documenting `timestamp`, `action`, `actor`, and `details`.

---

## 6. Data Lifecycle State Machine

```
[ DISCOVERED ]
      │
      ▼
[ AWAITING_AUTHORIZATION ] ──(Invalid Credentials)──> [ FAILED ]
      │
      ▼ (Credentials Validated)
[ CONNECTED ]
      │
      ▼ (Sync Triggered)
[ EXTRACTION_IN_PROGRESS ]
      │
      ▼ (Pipeline Processing)
[ VALIDATED ] ──(Quality Score < 70)──> [ REJECTED ]
      │
      ▼ (Approved & Persisted)
[ IMPORTED ]
      │
      ▼ (Revocation / Disconnect)
[ REVOKED / DISCONNECTED ]
```

---

## 7. Machine Learning Gate Governance Status

```
┌────────────────────────────────────────────────────────────────────────┐
│ ML READINESS GATE: LOCKED                                              │
│ STATUS: LOCKED                                                         │
│ VERDICT: ML BLOCKED — VERIFIED REAL DATA INSUFFICIENT;                 │
│          PRIMARY DATA NOT YET CONNECTED;                               │
│          STATISTICALLY CONSTRAINED FOR PRODUCTION TRAINING             │
└────────────────────────────────────────────────────────────────────────┘
```

- **Why ML Remains Locked:**
  The ingestion architecture is complete and production-ready. However, no authorized enterprise ERP connector has yet supplied live primary customer records. The current testbed ledger ($N=50$) is an architectural benchmark.
- **Conditions Required to Unlock ML in Phase 4:**
  1. An enterprise connector (Tally, Zoho, SAP, QuickBooks, or TReDS) is connected.
  2. Primary transaction volume reaches $N \ge 1,000$ completed invoices.
  3. Counterparty diversity reaches $\ge 50$ distinct commercial buyers.
  4. Temporal history spans $\ge 12-24$ continuous months.
  5. Survival analysis or duration models handle right-censored open invoices without naive zero-delay imputation.
  6. Out-of-time chronological validation is strictly enforced.
