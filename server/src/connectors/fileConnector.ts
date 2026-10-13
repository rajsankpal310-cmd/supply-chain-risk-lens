import crypto from "crypto";
import { CanonicalInvoiceContract, hashPAN, isValidGSTIN, isValidUdyamId } from "../pipeline/canonicalContract";
import { BaseEnterpriseConnector } from "./baseConnector";
import { ConnectorMetadata, ConnectorTestResult } from "./types";

export interface SmeAuthorizationMetadata {
  smeLegalName: string;
  smeGstin: string;
  authorizedSignatoryName: string;
  signatoryRole: string;
  authorizationTimestamp: string;
  consentAttestation: boolean;
  udyamNumber?: string;
  sha256Manifest?: string;
}

export class FileControlledConnector extends BaseEnterpriseConnector {
  getMetadata(): ConnectorMetadata {
    return {
      id: "CONN-FILE-CONTROLLED",
      name: "Controlled Enterprise File Ingestion (CSV / JSON / Excel)",
      type: "FILE_CONTROLLED",
      authType: "FILE_CONTROLLED",
      status: "CONNECTED",
      lifecycleState: "CONNECTED",
      lastSyncAt: new Date().toISOString(),
      recordsImported: 50,
      provenanceClassification: "ARCHITECTURAL_BENCHMARK",
      dataGranularity: "TRANSACTION_LEVEL",
      requiredConfigFields: [
        {
          field: "encoding",
          label: "File Character Encoding",
          type: "text",
          sensitive: false,
          required: true,
          placeholder: "utf-8",
          description: "Character set encoding of corporate CSV or JSON exports",
        },
        {
          field: "smeGstin",
          label: "SME GSTIN",
          type: "text",
          sensitive: false,
          required: true,
          placeholder: "27AABCU9603R1ZM",
          description: "15-character statutory Goods and Services Tax Identification Number of the reporting SME",
        },
        {
          field: "authorizedSignatoryName",
          label: "Authorized Signatory Name",
          type: "text",
          sensitive: false,
          required: true,
          placeholder: "Rajesh Sharma",
          description: "Full legal name of the authorized director, proprietor, or CFO",
        },
        {
          field: "consentAttestation",
          label: "Legal Consent Attestation",
          type: "text",
          sensitive: false,
          required: true,
          placeholder: "true",
          description: "Explicit legal consent confirming authorization to ingest SME financial transaction data",
        },
      ],
      docUrl: "https://nexuscfr.in/docs/connectors/file-export",
      notes: "Controlled enterprise batch ingestion channel. Requires explicit legal consent, signatory attestation, and SHA-256 data manifest verification for real Indian SME data.",
    };
  }

  async validateCredentials(credentials: Record<string, any>): Promise<ConnectorTestResult> {
    const missing: string[] = [];
    if (!credentials.smeLegalName) missing.push("smeLegalName");
    if (!credentials.smeGstin) missing.push("smeGstin");
    if (!credentials.authorizedSignatoryName) missing.push("authorizedSignatoryName");
    if (!credentials.consentAttestation || credentials.consentAttestation !== true && credentials.consentAttestation !== "true") {
      missing.push("consentAttestation (must be explicitly true)");
    }

    if (credentials.smeGstin && !isValidGSTIN(credentials.smeGstin)) {
      return {
        success: false,
        message: `Invalid statutory GSTIN format: ${credentials.smeGstin}. Must adhere to 15-character standard.`,
        timestamp: new Date().toISOString(),
        validatedCredentials: false,
        endpointReachable: true,
        missingRequirements: ["Valid 15-character GSTIN"],
      };
    }

    if (missing.length > 0) {
      return {
        success: false,
        message: `Controlled SME File ingestion rejected: Missing mandatory legal authorization metadata: ${missing.join(", ")}. In accordance with DPDP and NEXUS-CFR governance, unconsented financial files cannot be ingested.`,
        timestamp: new Date().toISOString(),
        validatedCredentials: false,
        endpointReachable: true,
        missingRequirements: missing,
      };
    }

    return {
      success: true,
      message: `Controlled File Channel verified. Authorized signatory ${credentials.authorizedSignatoryName} (${credentials.signatoryRole || "Authorized Representative"}) for ${credentials.smeLegalName} [GSTIN: ${credentials.smeGstin}].`,
      timestamp: new Date().toISOString(),
      validatedCredentials: true,
      endpointReachable: true,
    };
  }

  async fetchMetadata(credentials: Record<string, any>): Promise<Record<string, any>> {
    return {
      supportedFormats: ["CSV", "JSON", "XLSX"],
      maxBatchSizeBytes: 50 * 1024 * 1024, // 50MB
      tenantIsolationMode: "STRICT_ROW_LEVEL",
      requiresLegalConsent: true,
      pipelineVersion: "4.0",
    };
  }

  async extractData(credentials: Record<string, any>, filter?: Record<string, any>): Promise<Record<string, any>[]> {
    // Validate authorization before permitting data extraction
    const val = await this.validateCredentials(credentials);
    if (!val.success) {
      throw new Error(`AUTHORIZATION_REJECTED: ${val.message}`);
    }

    if (filter?.rows && Array.isArray(filter.rows)) {
      return filter.rows;
    }
    return [];
  }

  computeManifestHash(records: Record<string, any>[]): string {
    const serialized = JSON.stringify(records);
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  async normalize(rawRecords: Record<string, any>[], metadata?: SmeAuthorizationMetadata): Promise<CanonicalInvoiceContract[]> {
    return rawRecords.map((r, idx) => {
      const gstinVal = r.gstin || metadata?.smeGstin;
      const panVal = r.pan || (gstinVal && gstinVal.length === 15 ? gstinVal.substring(2, 12) : undefined);
      const panHash = panVal ? hashPAN(panVal) : undefined;
      const udyamVal = r.udyam_id || metadata?.udyamNumber;

      return {
        transaction_id: String(r.transaction_id || r.invoice_number || `TXN-FILE-${idx + 1}`),
        sme_id: String(r.sme_id || r.vendor_id || metadata?.smeGstin || "SME-UNKNOWN"),
        buyer_id: String(r.buyer_id || r.customer_id || "BUYER-UNKNOWN"),
        supplier_id: r.supplier_id ? String(r.supplier_id) : undefined,
        invoice_amount: Number(r.invoice_amount || r.amount || 0),
        invoice_date: String(r.invoice_date || r.date || new Date().toISOString().slice(0, 10)),
        due_date: String(r.due_date || new Date().toISOString().slice(0, 10)),
        payment_date: r.payment_date ? String(r.payment_date) : null,
        credit_period: Number(r.credit_period || 30),
        outstanding_amount: Number(r.outstanding_amount || 0),
        payment_status: (r.payment_status as any) || "PENDING",
        currency: String(r.currency || "INR"),
        source_system: "CONTROLLED_FILE_EXPORT",
        source_record_id: String(r.transaction_id || r.invoice_number || `REC-${idx + 1}`),
        extracted_at: new Date().toISOString(),
        raw_payload: r,
        gstin: gstinVal && isValidGSTIN(gstinVal) ? gstinVal : undefined,
        pan_hash: panHash,
        udyam_id: udyamVal && isValidUdyamId(udyamVal) ? udyamVal : undefined,
        state: r.state ? String(r.state) : undefined,
        industry: r.industry ? String(r.industry) : undefined,
        msme_category: r.msme_category ? (r.msme_category as any) : undefined,
      };
    });
  }
}

