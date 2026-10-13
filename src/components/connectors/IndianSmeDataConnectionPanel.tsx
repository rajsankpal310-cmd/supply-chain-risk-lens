import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Layers,
  ArrowRight,
  Server,
  RefreshCw,
  FileCheck,
  Activity,
  ExternalLink,
  Eye,
  EyeOff,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectorService } from "@/services/dataServices";
import { toast } from "sonner";

export interface ProviderSpec {
  id: string;
  name: string;
  category: "ERP" | "FINTECH_TREDS" | "BATCH_FILE";
  authMechanism: string;
  status: "CONNECTED" | "READY_FOR_AUTHORIZATION" | "NOT_CONNECTED" | "AUTHORIZATION_REQUIRED" | "UNAVAILABLE";
  description: string;
  docUrl: string;
  requiredFields: Array<{
    field: string;
    label: string;
    type: "text" | "password" | "number";
    placeholder?: string;
    description: string;
    sensitive?: boolean;
  }>;
}

const PROVIDERS: ProviderSpec[] = [
  {
    id: "CONN-TALLY-PRIME",
    name: "TallyPrime",
    category: "ERP",
    authMechanism: "On-Premises Gateway / XML Server",
    status: "NOT_CONNECTED",
    description: "Ingests real purchase orders, ledger vouchers, and payment dates via direct Tally XML interface.",
    docUrl: "https://nexuscfr.in/docs/connectors/tally",
    requiredFields: [
      { field: "serverHost", label: "Tally Gateway Host/IP", type: "text", placeholder: "192.168.1.100", description: "Internal IP of Tally Server." },
      { field: "serverPort", label: "Tally XML Port", type: "number", placeholder: "9000", description: "Default Tally XML port (e.g. 9000)." },
      { field: "companyName", label: "Tally Company Name", type: "text", placeholder: "Apex Auto Ancillary Pvt Ltd", description: "Exact legal name as registered in Tally." },
    ],
  },
  {
    id: "CONN-ZOHO-BOOKS",
    name: "Zoho Books",
    category: "ERP",
    authMechanism: "OAuth 2.0 (India DC)",
    status: "AUTHORIZATION_REQUIRED",
    description: "Automated extraction of sales invoices, customer credit terms, and payment receipts from Zoho Books API.",
    docUrl: "https://nexuscfr.in/docs/connectors/zoho",
    requiredFields: [
      { field: "clientId", label: "Zoho OAuth Client ID", type: "text", placeholder: "1000.XXXXX", description: "Registered Zoho API Console Client ID." },
      { field: "clientSecret", label: "Zoho OAuth Client Secret", type: "password", sensitive: true, description: "Zoho Client Secret key." },
      { field: "refreshToken", label: "OAuth Refresh Token", type: "password", sensitive: true, description: "Offline access refresh token." },
      { field: "organizationId", label: "Zoho Org ID", type: "text", placeholder: "700192837", description: "Numeric organization ID in Zoho Books." },
    ],
  },
  {
    id: "CONN-QUICKBOOKS-ONLINE",
    name: "QuickBooks Online",
    category: "ERP",
    authMechanism: "Intuit OAuth 2.0",
    status: "AUTHORIZATION_REQUIRED",
    description: "Extracts receivables ledger, payment timing, and invoice line items from Intuit QuickBooks.",
    docUrl: "https://nexuscfr.in/docs/connectors/quickbooks",
    requiredFields: [
      { field: "clientId", label: "Intuit App Client ID", type: "text", description: "Intuit Developer Portal Client ID." },
      { field: "clientSecret", label: "Intuit Client Secret", type: "password", sensitive: true, description: "Intuit OAuth Secret." },
      { field: "realmId", label: "Company Realm ID", type: "text", placeholder: "46208163650", description: "Target QuickBooks company identifier." },
    ],
  },
  {
    id: "CONN-SAP-S4HANA",
    name: "SAP S/4HANA",
    category: "ERP",
    authMechanism: "OData / Mutual TLS / Basic",
    status: "NOT_CONNECTED",
    description: "Enterprise accounts receivable journal extraction via standard S/4HANA OData services.",
    docUrl: "https://nexuscfr.in/docs/connectors/sap",
    requiredFields: [
      { field: "baseUrl", label: "SAP Gateway Base URL", type: "text", placeholder: "https://sap.enterprise.in:44300", description: "OData service root URL." },
      { field: "clientNumber", label: "SAP Client ID", type: "text", placeholder: "100", description: "SAP Mandant client number." },
      { field: "username", label: "Service Technical User", type: "text", description: "Read-only SAP service user." },
      { field: "password", label: "Service Password", type: "password", sensitive: true, description: "Encrypted technical user password." },
    ],
  },
  {
    id: "CONN-FILE-CONTROLLED",
    name: "Controlled SME File Ingestion",
    category: "BATCH_FILE",
    authMechanism: "Consented File Upload (CSV/XLSX)",
    status: "READY_FOR_AUTHORIZATION",
    description: "Secure manual batch upload accompanied by mandatory statutory GSTIN, signatory attestation, and SHA-256 data manifest.",
    docUrl: "https://nexuscfr.in/docs/connectors/file-export",
    requiredFields: [
      { field: "smeLegalName", label: "Reporting SME Legal Name", type: "text", placeholder: "Pragati Precision Engg LLP", description: "Registered trade name of reporting enterprise." },
      { field: "smeGstin", label: "SME 15-Digit GSTIN", type: "text", placeholder: "27AABCU9603R1ZM", description: "Statutory Goods & Services Tax ID." },
      { field: "authorizedSignatoryName", label: "Authorized Signatory Name", type: "text", placeholder: "Ramesh Kulkarni", description: "Director, CFO, or authorized proprietor." },
      { field: "consentAttestation", label: "Legal Consent Attestation", type: "text", placeholder: "true", description: "Confirm explicit consent under MSMED & DPDP framework." },
    ],
  },
  {
    id: "CONN-TREDS-SANDBOX",
    name: "TReDS Institutional Feed (RXIL / M1xchange / Invoicemart)",
    category: "FINTECH_TREDS",
    authMechanism: "RBI-Regulated API Gateway",
    status: "AUTHORIZATION_REQUIRED",
    description: "Direct factoring feed for accepted, discounted, and settled MSME invoices across RBI-licensed TReDS exchanges.",
    docUrl: "https://nexuscfr.in/docs/connectors/treds",
    requiredFields: [
      { field: "exchangeName", label: "TReDS Exchange Platform", type: "text", placeholder: "RXIL", description: "Target exchange (RXIL, M1XCHANGE, or INVOICEMART)." },
      { field: "registeredGstin", label: "Registered Participant GSTIN", type: "text", placeholder: "27AABCU9603R1ZM", description: "Participant MSME GSTIN registered on TReDS." },
      { field: "apiKey", label: "Participant API Key", type: "password", sensitive: true, description: "Licensed sandbox/production API authorization key." },
      { field: "accessTier", label: "Access Tier Mode", type: "text", placeholder: "SANDBOX_PARTICIPANT", description: "SANDBOX_PARTICIPANT or RESTRICTED_PRODUCTION." },
    ],
  },
];

export function IndianSmeDataConnectionPanel() {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<ProviderSpec | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});

  // Query live status from backend
  const statusQuery = useQuery({
    queryKey: ["indian-sme-status"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ml/indian-sme/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  const liveData = statusQuery.data;

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: ({ id, credentials }: { id: string; credentials: Record<string, any> }) =>
      connectorService.testConnector(id, credentials),
    onSuccess: (data) => {
      const res = data?.data || data;
      setTestResult(res);
      queryClient.invalidateQueries({ queryKey: ["indian-sme-status"] });
      queryClient.invalidateQueries({ queryKey: ["connectors-list"] });
      if (res.success) {
        toast.success(`Connection verified for ${selectedProvider?.name}`);
      } else {
        toast.error(`Connection rejected: ${res.message}`);
      }
    },
    onError: (err: any) => {
      setTestResult({
        success: false,
        message: err.message || "Failed to reach connector service",
        missingRequirements: ["Service communication error"],
      });
      toast.error("Connector test failed");
    },
  });

  const handleOpenConfig = (prov: ProviderSpec) => {
    setSelectedProvider(prov);
    setFormData({});
    setTestResult(null);
    setDialogOpen(true);
  };

  const handleTestConnection = () => {
    if (!selectedProvider) return;
    testMutation.mutate({
      id: selectedProvider.id,
      credentials: formData,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Reality Governance Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Real Indian SME Data Connection Hub</h2>
              <p className="text-sm text-muted-foreground">
                Governed enterprise connector boundary for authentic MSME accounting & TReDS transaction streams.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-xs px-3 py-1 font-mono uppercase bg-amber-500/10 text-amber-400 border-amber-500/20"
          >
            {liveData?.dataConnectionStatus || "AWAITING_AUTHORIZATION"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => statusQuery.refetch()}
            disabled={statusQuery.isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Visual Onboarding Pipeline */}
      <Card className="p-5 border-border bg-card/40">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Enterprise Data & ML Lifecycle Progression
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
          {[
            { step: "DATA SOURCE", status: "CONFIGURED", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
            { step: "AUTHORIZATION", status: "REQUIRED", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
            { step: "DATA QUALITY", status: "PRE-AUDITED", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
            { step: "ML READINESS", status: "GOVERNED GATE", color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
            { step: "MODEL STATUS", status: liveData?.activeModel ? "DEPLOYED" : "AWAITING DATA", color: "text-teal-400 border-teal-500/30 bg-teal-500/10" },
            { step: "PREDICTION", status: "PRE-t0 LAGS", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
            { step: "NETWORK IMPACT", status: "TENANT ISOLATED", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
            { step: "RESOLUTION", status: "DECISION SUPPORT", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border flex flex-col justify-between items-center transition-all ${item.color}`}
            >
              <span className="font-bold text-[10px] tracking-wider">{item.step}</span>
              <span className="text-[10px] opacity-80 mt-1 font-mono">{item.status}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PROVIDERS.map((prov) => {
          return (
            <Card key={prov.id} className="p-5 border-border bg-card/60 flex flex-col justify-between hover:border-primary/40 transition-all">
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-1.5">
                      {prov.name}
                      {prov.category === "FINTECH_TREDS" && (
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono">
                          TReDS
                        </span>
                      )}
                    </h4>
                    <span className="text-xs text-muted-foreground font-mono">{prov.authMechanism}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 ${
                      prov.status === "CONNECTED"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : prov.status === "READY_FOR_AUTHORIZATION"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : prov.status === "AUTHORIZATION_REQUIRED"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {prov.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{prov.description}</p>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <a
                  href={prov.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  Docs <ExternalLink className="w-3 h-3" />
                </a>
                <Button
                  size="sm"
                  variant={prov.status === "CONNECTED" ? "secondary" : "default"}
                  onClick={() => handleOpenConfig(prov)}
                >
                  Configure & Test
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 4. Configuration and Credential Test Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Configure {selectedProvider?.name} Connector
            </DialogTitle>
            <DialogDescription>
              Enter legitimate enterprise credentials. Never simulate connection — credentials are validated against live
              protocols.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedProvider?.requiredFields.map((field) => (
              <div key={field.field} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.field} className="text-xs font-medium">
                    {field.label}
                  </Label>
                  {field.sensitive && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowSensitive((prev) => ({ ...prev, [field.field]: !prev[field.field] }))
                      }
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {showSensitive[field.field] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showSensitive[field.field] ? "Hide" : "Show"}
                    </button>
                  )}
                </div>
                <Input
                  id={field.field}
                  type={field.sensitive && !showSensitive[field.field] ? "password" : field.type}
                  placeholder={field.placeholder || `Enter ${field.label}`}
                  value={formData[field.field] || ""}
                  onChange={(e) => setFormData({ ...formData, [field.field]: e.target.value })}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">{field.description}</p>
              </div>
            ))}

            {/* Test Connection Output */}
            {testResult && (
              <div
                className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                  testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-destructive/10 border-destructive/30 text-destructive-foreground"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-destructive" />}
                  {testResult.success ? "Connection Verified" : "Connection Blocked / Not Connected"}
                </div>
                <p className="text-[11px] opacity-90">{testResult.message}</p>
                {testResult.missingRequirements && testResult.missingRequirements.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <span className="font-semibold block mb-1">Missing Requirements:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      {testResult.missingRequirements.map((req: string, i: number) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTestConnection}
              disabled={testMutation.isPending}
              className="gap-1.5"
            >
              {testMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Testing Protocol...
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  Test Live Connection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
