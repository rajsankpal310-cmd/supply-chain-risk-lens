import { FileControlledConnector } from "./fileConnector";
import {
  QuickBooksConnector,
  SapConnector,
  TallyConnector,
  TredsSandboxConnector,
  ZohoBooksConnector,
} from "./erpConnectors";
import { ConnectorMetadata, ConnectorTestResult, IEnterpriseConnector } from "./types";

export interface TenantConnectorConfig {
  organizationId: string;
  connectorId: string;
  status: ConnectorMetadata["status"];
  lifecycleState: ConnectorMetadata["lifecycleState"];
  credentials: Record<string, any>;
  lastTestedAt: string | null;
  lastSyncAt: string | null;
  recordsImported: number;
  auditLog: Array<{
    timestamp: string;
    action: string;
    actor: string;
    details: string;
  }>;
}

export class ConnectorRegistry {
  private static catalog: Map<string, IEnterpriseConnector> = new Map([
    ["CONN-FILE-CONTROLLED", new FileControlledConnector()],
    ["CONN-TALLY-PRIME", new TallyConnector()],
    ["CONN-ZOHO-BOOKS", new ZohoBooksConnector()],
    ["CONN-QUICKBOOKS-ONLINE", new QuickBooksConnector()],
    ["CONN-SAP-S4HANA", new SapConnector()],
    ["CONN-TREDS-SANDBOX", new TredsSandboxConnector()],
  ]);

  // Tenant-scoped configurations: Map<organizationId:connectorId, TenantConnectorConfig>
  private static tenantConfigs: Map<string, TenantConnectorConfig> = new Map();

  static getConnector(connectorId: string): IEnterpriseConnector | undefined {
    return this.catalog.get(connectorId);
  }

  static getTenantKey(organizationId: string, connectorId: string): string {
    return `${organizationId}:${connectorId}`;
  }

  static listConnectorsForTenant(organizationId: string): (ConnectorMetadata & { isConfigured: boolean })[] {
    const list: (ConnectorMetadata & { isConfigured: boolean })[] = [];

    for (const [id, connector] of this.catalog.entries()) {
      const baseMeta = connector.getMetadata();
      const tenantKey = this.getTenantKey(organizationId, id);
      const tenantConfig = this.tenantConfigs.get(tenantKey);

      if (tenantConfig) {
        list.push({
          ...baseMeta,
          status: tenantConfig.status,
          lifecycleState: tenantConfig.lifecycleState,
          lastSyncAt: tenantConfig.lastSyncAt,
          recordsImported: tenantConfig.recordsImported,
          isConfigured: true,
        });
      } else {
        list.push({
          ...baseMeta,
          isConfigured: id === "CONN-FILE-CONTROLLED",
        });
      }
    }

    return list;
  }

  static getConnectorDetail(organizationId: string, connectorId: string) {
    const connector = this.catalog.get(connectorId);
    if (!connector) return null;

    const baseMeta = connector.getMetadata();
    const tenantKey = this.getTenantKey(organizationId, connectorId);
    const tenantConfig = this.tenantConfigs.get(tenantKey);

    const maskedCredentials: Record<string, string> = {};
    if (tenantConfig?.credentials) {
      for (const [key, val] of Object.entries(tenantConfig.credentials)) {
        maskedCredentials[key] = String(val).length > 4 ? "********" : "****";
      }
    }

    return {
      metadata: {
        ...baseMeta,
        status: tenantConfig?.status || baseMeta.status,
        lifecycleState: tenantConfig?.lifecycleState || baseMeta.lifecycleState,
        lastSyncAt: tenantConfig?.lastSyncAt || baseMeta.lastSyncAt,
        recordsImported: tenantConfig?.recordsImported || baseMeta.recordsImported,
      },
      configuredCredentials: maskedCredentials,
      auditHistory: tenantConfig?.auditLog || [],
    };
  }

  static async testConnection(
    organizationId: string,
    connectorId: string,
    credentials: Record<string, any>,
    actorEmail: string
  ): Promise<ConnectorTestResult> {
    const connector = this.catalog.get(connectorId);
    if (!connector) {
      throw new Error(`Unsupported connector ID: ${connectorId}`);
    }

    const testResult = await connector.validateCredentials(credentials);
    const tenantKey = this.getTenantKey(organizationId, connectorId);
    let tenantConfig = this.tenantConfigs.get(tenantKey);

    if (!tenantConfig) {
      tenantConfig = {
        organizationId,
        connectorId,
        status: testResult.success ? "CONNECTED" : "NOT_CONNECTED",
        lifecycleState: testResult.success ? "CONNECTED" : "AWAITING_AUTHORIZATION",
        credentials,
        lastTestedAt: testResult.timestamp,
        lastSyncAt: null,
        recordsImported: 0,
        auditLog: [],
      };
    } else {
      tenantConfig.status = testResult.success ? "CONNECTED" : "NOT_CONNECTED";
      tenantConfig.lifecycleState = testResult.success ? "CONNECTED" : "AWAITING_AUTHORIZATION";
      tenantConfig.lastTestedAt = testResult.timestamp;
      tenantConfig.credentials = { ...tenantConfig.credentials, ...credentials };
    }

    tenantConfig.auditLog.unshift({
      timestamp: testResult.timestamp,
      action: "TEST_CONNECTION",
      actor: actorEmail,
      details: testResult.message,
    });

    this.tenantConfigs.set(tenantKey, tenantConfig);
    return testResult;
  }
}
