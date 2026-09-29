import { CanonicalInvoiceContract } from "../pipeline/canonicalContract";

export type ConnectorType =
  | "TALLY"
  | "ZOHO_BOOKS"
  | "QUICKBOOKS"
  | "SAP_S4HANA"
  | "TREDS_SANDBOX"
  | "FILE_CONTROLLED";

export type ConnectorAuthType =
  | "ON_PREM_GATEWAY"
  | "OAUTH2"
  | "API_KEY"
  | "MUTUAL_TLS"
  | "FILE_CONTROLLED";

export type ConnectorStatus =
  | "NOT_CONNECTED"
  | "AWAITING_AUTH"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR";

export type ConnectorLifecycleState =
  | "DISCOVERED"
  | "AWAITING_AUTHORIZATION"
  | "CONNECTED"
  | "EXTRACTION_IN_PROGRESS"
  | "VALIDATED"
  | "IMPORTED"
  | "FAILED"
  | "REVOKED"
  | "DISCONNECTED";

export interface ConnectorFieldSpec {
  field: string;
  label: string;
  type: "text" | "password" | "url" | "number" | "file";
  sensitive: boolean;
  required: boolean;
  placeholder?: string;
  description: string;
}

export interface ConnectorMetadata {
  id: string;
  name: string;
  type: ConnectorType;
  authType: ConnectorAuthType;
  status: ConnectorStatus;
  lifecycleState: ConnectorLifecycleState;
  lastSyncAt: string | null;
  recordsImported: number;
  provenanceClassification: "REAL_OBSERVED" | "ARCHITECTURAL_BENCHMARK" | "SIMULATED";
  dataGranularity: "TRANSACTION_LEVEL";
  requiredConfigFields: ConnectorFieldSpec[];
  docUrl: string;
  notes: string;
}

export interface ConnectorTestResult {
  success: boolean;
  message: string;
  timestamp: string;
  validatedCredentials: boolean;
  endpointReachable: boolean;
  missingRequirements?: string[];
}

export interface IEnterpriseConnector {
  getMetadata(): ConnectorMetadata;
  validateCredentials(credentials: Record<string, any>): Promise<ConnectorTestResult>;
  fetchMetadata(credentials: Record<string, any>): Promise<Record<string, any>>;
  extractData(credentials: Record<string, any>, filter?: Record<string, any>): Promise<Record<string, any>[]>;
  normalize(rawRecords: Record<string, any>[]): Promise<CanonicalInvoiceContract[]>;
}
