import { CanonicalInvoiceContract } from "../pipeline/canonicalContract";
import { BaseEnterpriseConnector } from "./baseConnector";
import { ConnectorMetadata, ConnectorTestResult } from "./types";

/**
 * TallyPrime / Tally.ERP 9 Connector
 * Integrates via local/on-premise Tally XML Gateway (HTTP port 9000)
 */
export class TallyConnector extends BaseEnterpriseConnector {
  getMetadata(): ConnectorMetadata {
    return {
      id: "CONN-TALLY-PRIME",
      name: "TallyPrime / Tally.ERP 9 Gateway",
      type: "TALLY",
      authType: "ON_PREM_GATEWAY",
      status: "NOT_CONNECTED",
      lifecycleState: "DISCOVERED",
      lastSyncAt: null,
      recordsImported: 0,
      provenanceClassification: "REAL_OBSERVED",
      dataGranularity: "TRANSACTION_LEVEL",
      requiredConfigFields: [
        {
          field: "gatewayUrl",
          label: "Tally Gateway Endpoint URL",
          type: "url",
          sensitive: false,
          required: true,
          placeholder: "http://127.0.0.1:9000",
          description: "Internal network endpoint for Tally XML Server or Tally Connector Bridge",
        },
        {
          field: "companyName",
          label: "Tally Company Exact Name",
          type: "text",
          sensitive: false,
          required: true,
          placeholder: "Apex Industrial Supplies Ltd (FY 2024-25)",
          description: "Exact company name as loaded in the active Tally session",
        },
      ],
      docUrl: "https://nexuscfr.in/docs/connectors/tally",
      notes: "Requires on-premise Tally instance running with XML Server enabled. Status: NOT CONNECTED (Awaiting enterprise local gateway bridge).",
    };
  }

  async validateCredentials(credentials: Record<string, any>): Promise<ConnectorTestResult> {
    const missing: string[] = [];
    if (!credentials.gatewayUrl) missing.push("gatewayUrl (e.g. http://localhost:9000)");
    if (!credentials.companyName) missing.push("companyName (Exact company name loaded in Tally)");

    if (missing.length > 0) {
      return {
        success: false,
        message: "Tally connection failed: Missing required configuration parameters.",
        timestamp: new Date().toISOString(),
        validatedCredentials: false,
        endpointReachable: false,
        missingRequirements: missing,
      };
    }

    return {
      success: false,
      message: `Tally Gateway at ${credentials.gatewayUrl} is currently unreachable. Ensure TallyPrime is open with 'Enable ODBC/XML Server' set to Yes.`,
      timestamp: new Date().toISOString(),
      validatedCredentials: false,
      endpointReachable: false,
      missingRequirements: ["Live network connection to Tally Gateway on corporate LAN/VPN"],
    };
  }

  async fetchMetadata(credentials: Record<string, any>): Promise<Record<string, any>> {
    return {
      connectorVersion: "2024.1",
      protocol: "TDL/XML",
      supportedVoucherTypes: ["Sales", "Receipt", "Credit Note", "Journal"],
    };
  }

  async extractData(credentials: Record<string, any>, filter?: Record<string, any>): Promise<Record<string, any>[]> {
    throw new Error("Cannot extract data: Tally Gateway is not connected. Configure an active gateway bridge first.");
  }

  async normalize(rawRecords: Record<string, any>[]): Promise<CanonicalInvoiceContract[]> {
    return rawRecords.map((r) => ({
      transaction_id: String(r.VOUCHERNUMBER || r.GUID),
      sme_id: String(r.COMPANYNAME || "SME-TALLY"),
      buyer_id: String(r.PARTYNAME || "BUYER-TALLY"),
      invoice_amount: Math.abs(Number(r.AMOUNT || 0)),
      invoice_date: String(r.DATE ? `${r.DATE.slice(0, 4)}-${r.DATE.slice(4, 6)}-${r.DATE.slice(6, 8)}` : new Date().toISOString().slice(0, 10)),
      due_date: String(r.BILLDUEDATE || new Date().toISOString().slice(0, 10)),
      payment_date: r.CLEARINGDATE ? String(r.CLEARINGDATE) : null,
      credit_period: Number(r.CREDITPERIOD || 30),
      outstanding_amount: Number(r.CLOSINGBALANCE || 0),
      payment_status: Number(r.CLOSINGBALANCE || 0) === 0 ? "PAID" : "PENDING",
      currency: "INR",
      source_system: "TALLY_PRIME",
      source_record_id: String(r.VCHKEY || r.VOUCHERNUMBER),
      extracted_at: new Date().toISOString(),
      raw_payload: r,
    }));
  }
}

/**
 * Zoho Books Connector
 * Integrates via Zoho Books OAuth2 API v3
 */
export class ZohoBooksConnector extends BaseEnterpriseConnector {
  getMetadata(): ConnectorMetadata {
    return {
      id: "CONN-ZOHO-BOOKS",
      name: "Zoho Books Cloud API",
      type: "ZOHO_BOOKS",
      authType: "OAUTH2",
      status: "NOT_CONNECTED",
      lifecycleState: "DISCOVERED",
      lastSyncAt: null,
      recordsImported: 0,
      provenanceClassification: "REAL_OBSERVED",
      dataGranularity: "TRANSACTION_LEVEL",
      requiredConfigFields: [
        {
          field: "clientId",
          label: "Zoho OAuth2 Client ID",
          type: "text",
          sensitive: false,
          required: true,
          description: "OAuth2 Client ID generated in Zoho API Console",
        },
        {
          field: "clientSecret",
          label: "Zoho OAuth2 Client Secret",
          type: "password",
          sensitive: true,
          required: true,
          description: "OAuth2 Client Secret (kept securely in tenant vault)",
        },
        {
          field: "organizationId",
          label: "Zoho Books Organization ID",
          type: "text",
          sensitive: false,
          required: true,
          description: "Zoho Books Tenant Organization ID",
        },
      ],
      docUrl: "https://nexuscfr.in/docs/connectors/zoho-books",
      notes: "Connects directly to Zoho Books API v3. Status: NOT CONNECTED (Requires enterprise OAuth2 token consent).",
    };
  }

  async validateCredentials(credentials: Record<string, any>): Promise<ConnectorTestResult> {
    const missing: string[] = [];
    if (!credentials.clientId) missing.push("clientId");
    if (!credentials.clientSecret) missing.push("clientSecret");
    if (!credentials.organizationId) missing.push("organizationId");

    if (missing.length > 0) {
      return {
        success: false,
        message: "Zoho Books connection failed: Missing required OAuth2 credentials.",
        timestamp: new Date().toISOString(),
        validatedCredentials: false,
        endpointReachable: false,
        missingRequirements: missing,
      };
    }

    return {
      success: false,
      message: "Zoho Books authorization pending. Awaiting OAuth2 consent flow completion by enterprise administrator.",
      timestamp: new Date().toISOString(),
      validatedCredentials: false,
      endpointReachable: true,
      missingRequirements: ["Administrator OAuth2 Consent (RefreshToken)"],
    };
  }

  async fetchMetadata(credentials: Record<string, any>): Promise<Record<string, any>> {
    return { apiVersion: "v3", authScope: "ZohoBooks.invoices.READ" };
  }

  async extractData(credentials: Record<string, any>, filter?: Record<string, any>): Promise<Record<string, any>[]> {
    throw new Error("Cannot extract data: Zoho Books is not authorized. Complete OAuth2 consent first.");
  }

  async normalize(rawRecords: Record<string, any>[]): Promise<CanonicalInvoiceContract[]> {
    return rawRecords.map((r) => ({
      transaction_id: String(r.invoice_id || r.invoice_number),
      sme_id: String(r.organization_id || "SME-ZOHO"),
      buyer_id: String(r.customer_id || r.customer_name),
      invoice_amount: Number(r.total || 0),
      invoice_date: String(r.date || new Date().toISOString().slice(0, 10)),
      due_date: String(r.due_date || new Date().toISOString().slice(0, 10)),
      payment_date: r.last_payment_date ? String(r.last_payment_date) : null,
      credit_period: Number(r.credit_days || 30),
      outstanding_amount: Number(r.balance || 0),
      payment_status: (String(r.status || "unpaid").toUpperCase() as any),
      currency: String(r.currency_code || "INR"),
      source_system: "ZOHO_BOOKS",
      source_record_id: String(r.invoice_id),
      extracted_at: new Date().toISOString(),
      raw_payload: r,
    }));
  }
}

/**
 * Intuit QuickBooks Online Connector
 */
export class QuickBooksConnector extends BaseEnterpriseConnector {
  getMetadata(): ConnectorMetadata {
    return {
      id: "CONN-QUICKBOOKS-ONLINE",
      name: "Intuit QuickBooks Online",
      type: "QUICKBOOKS",
      authType: "OAUTH2",
      status: "NOT_CONNECTED",
      lifecycleState: "DISCOVERED",
      lastSyncAt: null,
      recordsImported: 0,
      provenanceClassification: "REAL_OBSERVED",
      dataGranularity: "TRANSACTION_LEVEL",
      requiredConfigFields: [
        { field: "clientId", label: "Intuit Client ID", type: "text", sensitive: false, required: true, description: "Intuit Developer Client ID" },
        { field: "clientSecret", label: "Intuit Client Secret", type: "password", sensitive: true, required: true, description: "Intuit Developer Client Secret" },
        { field: "realmId", label: "Company Realm ID", type: "text", sensitive: false, required: true, description: "QuickBooks Company / Tenant ID" },
      ],
      docUrl: "https://nexuscfr.in/docs/connectors/quickbooks",
      notes: "Requires Intuit App registration. Status: NOT CONNECTED (Awaiting OAuth2 configuration).",
    };
  }

  async validateCredentials(credentials: Record<string, any>): Promise<ConnectorTestResult> {
    return {
      success: false,
      message: "QuickBooks Online authorization pending. Awaiting Intuit OAuth2 app setup.",
      timestamp: new Date().toISOString(),
      validatedCredentials: false,
      endpointReachable: false,
      missingRequirements: ["Intuit Client Credentials & OAuth2 Redirect Authorization"],
    };
  }

  async fetchMetadata(credentials: Record<string, any>): Promise<Record<string, any>> {
    return { apiVersion: "v3", provider: "Intuit" };
  }

  async extractData(credentials: Record<string, any>, filter?: Record<string, any>): Promise<Record<string, any>[]> {
    throw new Error("Cannot extract data: QuickBooks connector is not authorized.");
  }

  async normalize(rawRecords: Record<string, any>[]): Promise<CanonicalInvoiceContract[]> {
    return rawRecords.map((r) => ({
      transaction_id: String(r.DocNumber || r.Id),
      sme_id: String(r.CompanyId || "SME-QBO"),
      buyer_id: String(r.CustomerRef?.value || r.CustomerRef?.name || "BUYER-QBO"),
      invoice_amount: Number(r.TotalAmt || 0),
      invoice_date: String(r.TxnDate || new Date().toISOString().slice(0, 10)),
      due_date: String(r.DueDate || new Date().toISOString().slice(0, 10)),
      payment_date: r.PaymentDate ? String(r.PaymentDate) : null,
      credit_period: 30,
      outstanding_amount: Number(r.Balance || 0),
      payment_status: Number(r.Balance || 0) === 0 ? "PAID" : "PENDING",
      currency: "INR",
      source_system: "QUICKBOOKS_ONLINE",
      source_record_id: String(r.Id),
      extracted_at: new Date().toISOString(),
      raw_payload: r,
    }));
  }
}

/**
 * SAP S/4HANA OData Financial API Connector
 */
export class SapConnector extends BaseEnterpriseConnector {
  getMetadata(): ConnectorMetadata {
    return {
      id: "CONN-SAP-S4HANA",
      name: "SAP S/4HANA Cloud (Financial API)",
      type: "SAP_S4HANA",
      authType: "MUTUAL_TLS",
      status: "NOT_CONNECTED",
      lifecycleState: "DISCOVERED",
      lastSyncAt: null,
      recordsImported: 0,
      provenanceClassification: "REAL_OBSERVED",
      dataGranularity: "TRANSACTION_LEVEL",
      requiredConfigFields: [
        { field: "odataEndpoint", label: "SAP OData Service Base URL", type: "url", sensitive: false, required: true, description: "SAP S/4HANA Communication Scenario API URL" },
        { field: "companyCode", label: "Company Code (BUKRS)", type: "text", sensitive: false, required: true, description: "SAP 4-character Company Code" },
        { field: "clientCert", label: "X.509 Client Certificate", type: "password", sensitive: true, required: true, description: "Mutual TLS Certificate for SAP Cloud Integration" },
      ],
      docUrl: "https://nexuscfr.in/docs/connectors/sap",
      notes: "Enterprise ERP integration via SAP Communication Scenario SAP_COM_0002. Status: NOT CONNECTED (Awaiting SAP Communication Arrangement).",
    };
  }

  async validateCredentials(credentials: Record<string, any>): Promise<ConnectorTestResult> {
    return {
      success: false,
      message: "SAP S/4HANA connection pending: Communication Arrangement SAP_COM_0002 not configured.",
      timestamp: new Date().toISOString(),
      validatedCredentials: false,
      endpointReachable: false,
      missingRequirements: ["SAP S/4HANA mTLS Client Certificate", "Company Code Communication User"],
    };
  }

  async fetchMetadata(credentials: Record<string, any>): Promise<Record<string, any>> {
    return { odataService: "API_OP_JOURNALENTRY_SRV", format: "JSON" };
  }

  async extractData(credentials: Record<string, any>, filter?: Record<string, any>): Promise<Record<string, any>[]> {
    throw new Error("Cannot extract data: SAP S/4HANA connection is not configured.");
  }

  async normalize(rawRecords: Record<string, any>[]): Promise<CanonicalInvoiceContract[]> {
    return rawRecords.map((r) => ({
      transaction_id: String(r.AccountingDocument),
      sme_id: String(r.CompanyCode || "SME-SAP"),
      buyer_id: String(r.Customer || "BUYER-SAP"),
      invoice_amount: Number(r.AmountInCompanyCodeCurrency || 0),
      invoice_date: String(r.PostingDate || new Date().toISOString().slice(0, 10)),
      due_date: String(r.NetDueDate || new Date().toISOString().slice(0, 10)),
      payment_date: r.ClearingDate ? String(r.ClearingDate) : null,
      credit_period: 45,
      outstanding_amount: r.ClearingDate ? 0 : Number(r.AmountInCompanyCodeCurrency || 0),
      payment_status: r.ClearingDate ? "PAID" : "PENDING",
      currency: String(r.CompanyCodeCurrency || "INR"),
      source_system: "SAP_S4HANA",
      source_record_id: String(r.AccountingDocument),
      extracted_at: new Date().toISOString(),
      raw_payload: r,
    }));
  }
}

/**
 * TReDS Factoring Exchange Sandbox Connector
 */
export class TredsSandboxConnector extends BaseEnterpriseConnector {
  getMetadata(): ConnectorMetadata {
    return {
      id: "CONN-TREDS-SANDBOX",
      name: "TReDS Factoring Exchange Sandbox (RXIL / M1xchange / Invoicemart)",
      type: "TREDS_SANDBOX",
      authType: "API_KEY",
      status: "NOT_CONNECTED",
      lifecycleState: "DISCOVERED",
      lastSyncAt: null,
      recordsImported: 0,
      provenanceClassification: "REAL_OBSERVED",
      dataGranularity: "TRANSACTION_LEVEL",
      requiredConfigFields: [
        { field: "sandboxApiUrl", label: "TReDS Sandbox API Endpoint", type: "url", sensitive: false, required: true, description: "Official TReDS factoring sandbox URL" },
        { field: "apiKey", label: "TReDS Participant API Key", type: "password", sensitive: true, required: true, description: "Licensed participant API key" },
        { field: "participantGstin", label: "Participant GSTIN", type: "text", sensitive: false, required: true, description: "Registered enterprise GSTIN on TReDS" },
      ],
      docUrl: "https://nexuscfr.in/docs/connectors/treds",
      notes: "Direct integration to RBI-regulated TReDS factoring exchanges. Status: NOT CONNECTED (Awaiting TReDS participant credentials).",
    };
  }

  async validateCredentials(credentials: Record<string, any>): Promise<ConnectorTestResult> {
    return {
      success: false,
      message: "TReDS connection pending: Registered participant API Key required.",
      timestamp: new Date().toISOString(),
      validatedCredentials: false,
      endpointReachable: false,
      missingRequirements: ["TReDS Participant API Key & GSTIN Registration"],
    };
  }

  async fetchMetadata(credentials: Record<string, any>): Promise<Record<string, any>> {
    return { platform: "TReDS Sandbox", regulatoryAuthority: "Reserve Bank of India" };
  }

  async extractData(credentials: Record<string, any>, filter?: Record<string, any>): Promise<Record<string, any>[]> {
    throw new Error("Cannot extract data: TReDS sandbox credentials not verified.");
  }

  async normalize(rawRecords: Record<string, any>[]): Promise<CanonicalInvoiceContract[]> {
    return rawRecords.map((r) => ({
      transaction_id: String(r.FactoringUnitId || r.InvoiceNumber),
      sme_id: String(r.SellerGstin || "SME-TREDS"),
      buyer_id: String(r.BuyerGstin || "BUYER-TREDS"),
      invoice_amount: Number(r.FactoredAmount || 0),
      invoice_date: String(r.InvoiceDate || new Date().toISOString().slice(0, 10)),
      due_date: String(r.MaturityDate || new Date().toISOString().slice(0, 10)),
      payment_date: r.SettlementDate ? String(r.SettlementDate) : null,
      credit_period: 45,
      outstanding_amount: r.SettlementStatus === "SETTLED" ? 0 : Number(r.FactoredAmount || 0),
      payment_status: r.SettlementStatus === "SETTLED" ? "PAID" : "PENDING",
      currency: "INR",
      source_system: "TREDS_SANDBOX",
      source_record_id: String(r.FactoringUnitId),
      extracted_at: new Date().toISOString(),
      raw_payload: r,
    }));
  }
}
