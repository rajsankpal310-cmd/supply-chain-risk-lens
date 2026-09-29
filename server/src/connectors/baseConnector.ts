import { CanonicalInvoiceContract } from "../pipeline/canonicalContract";
import { ConnectorMetadata, ConnectorTestResult, IEnterpriseConnector } from "./types";

export abstract class BaseEnterpriseConnector implements IEnterpriseConnector {
  abstract getMetadata(): ConnectorMetadata;
  abstract validateCredentials(credentials: Record<string, any>): Promise<ConnectorTestResult>;
  abstract fetchMetadata(credentials: Record<string, any>): Promise<Record<string, any>>;
  abstract extractData(credentials: Record<string, any>, filter?: Record<string, any>): Promise<Record<string, any>[]>;
  abstract normalize(rawRecords: Record<string, any>[]): Promise<CanonicalInvoiceContract[]>;

  protected maskSecret(secret?: string): string {
    if (!secret || secret.length === 0) return "";
    if (secret.length <= 4) return "********";
    return secret.slice(0, 2) + "********" + secret.slice(-2);
  }
}
