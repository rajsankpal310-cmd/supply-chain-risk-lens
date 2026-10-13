import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCode,
  Info,
  Layers,
  Link2,
  Link2Off,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { connectorService } from "@/services/dataServices";

export function EnterpriseConnectorsTab() {
  const queryClient = useQueryClient();
  const [selectedConnector, setSelectedConnector] = useState<any | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedProviderKey, setSelectedProviderKey] = useState<string>("TALLY_PRIME");
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<any | null>(null);

  // 1. Fetch connectors list
  const connectorsQuery = useQuery({
    queryKey: ["connectors-list"],
    queryFn: () => connectorService.listConnectors(),
  });

  // 2. Fetch canonical contract and provider mappings
  const contractQuery = useQuery({
    queryKey: ["connector-contract"],
    queryFn: () => connectorService.getContract(),
  });

  // 3. Test connector mutation
  const testMutation = useMutation({
    mutationFn: ({ id, credentials }: { id: string; credentials: Record<string, any> }) =>
      connectorService.testConnector(id, credentials),
    onSuccess: (data) => {
      const res = data?.data || data;
      setTestResult(res);
      queryClient.invalidateQueries({ queryKey: ["connectors-list"] });
    },
    onError: (err: any) => {
      setTestResult({
        success: false,
        message: err.message || "Failed to reach connector service",
        missingRequirements: ["Service communication error"],
      });
    },
  });

  const connectors: any[] = connectorsQuery.data?.data || connectorsQuery.data || [];
  const mappings = contractQuery.data?.data?.registry || contractQuery.data?.registry || {};

  const handleOpenConfig = (connector: any) => {
    setSelectedConnector(connector);
    setConfigForm({});
    setTestResult(null);
    setTestDialogOpen(true);
  };

  const handleRunTest = () => {
    if (!selectedConnector) return;
    testMutation.mutate({
      id: selectedConnector.id,
      credentials: configForm,
    });
  };

  const handleViewMapping = (providerType: string) => {
    const keyMap: Record<string, string> = {
      TALLY: "TALLY_PRIME",
      ZOHO_BOOKS: "ZOHO_BOOKS",
      QUICKBOOKS: "QUICKBOOKS_ONLINE",
      SAP_S4HANA: "SAP_S4HANA",
      TREDS_SANDBOX: "TREDS_SANDBOX",
      FILE_CONTROLLED: "CONTROLLED_FILE_EXPORT",
    };
    setSelectedProviderKey(keyMap[providerType] || "TALLY_PRIME");
    setMappingDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Primary Header Banner */}
      <Card className="border-blue-500/40 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Data Connections
                </span>
                <Badge variant="outline" className="text-[10px] border-blue-500/50 bg-blue-500/20 text-blue-700 dark:text-blue-300">
                  Active
                </Badge>
              </div>
              <h2 className="text-base font-semibold text-foreground mt-0.5">
                Accounting & ERP Connections
              </h2>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => connectorsQuery.refetch()}
            disabled={connectorsQuery.isFetching}
            className="text-xs gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={connectorsQuery.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
            Check Connection Status
          </Button>
        </div>

        <div className="pt-2 border-t border-blue-500/20 text-xs text-muted-foreground leading-relaxed">
          Connect your accounting or ERP system to automatically bring transaction data into NEXUS-CFR.
          Data is verified and kept isolated to your organization. Sources without configured credentials remain safely marked as <strong className="text-foreground">Not Connected</strong>.
        </div>
      </Card>

      {/* 2. Connectors Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connectorsQuery.isLoading ? (
          <Card className="col-span-full p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span>Checking available accounting & ERP connections...</span>
          </Card>
        ) : (
          connectors.map((c) => {
            const isConnected = c.status === "CONNECTED";
            const displayStatus = isConnected
              ? "Connected"
              : c.status === "CONFIGURED"
              ? "Needs Setup"
              : c.status === "ERROR"
              ? "Unavailable"
              : "Not Connected";

            const classificationLabel =
              c.provenanceClassification === "REAL_OBSERVED_ENTERPRISE"
                ? "Verified Company Data"
                : c.provenanceClassification === "ARCHITECTURAL_BENCHMARK"
                ? "Reference Dataset"
                : c.provenanceClassification || "Standard Source";

            return (
              <Card key={c.id} className="p-4 space-y-3.5 flex flex-col justify-between border-border/80">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Server className="size-3.5 text-primary" />
                        {c.name}
                      </h3>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {c.authType === "OAUTH2" ? "OAuth Integration" : c.authType === "API_KEY" ? "API Key Access" : "Direct Export / Upload"}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        isConnected
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] gap-1 font-medium"
                          : displayStatus === "Needs Setup"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] gap-1 font-medium"
                          : "bg-muted text-muted-foreground border-border/60 text-[10px] gap-1 font-medium"
                      }
                    >
                      {isConnected ? <Link2 className="size-3" /> : <Link2Off className="size-3" />}
                      {displayStatus}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                    {c.notes}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-medium block">Data Source</span>
                      <span className="text-foreground text-[11px] font-medium">{classificationLabel}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-medium block">Records Synced</span>
                      <span className="font-semibold text-foreground text-[11px]">{c.recordsImported || 0} transactions</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 flex-1 gap-1"
                    onClick={() => handleOpenConfig(c)}
                  >
                    <Plug className="size-3" />
                    Configure & Connect
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 px-2"
                    title="View Technical Data Mapping"
                    onClick={() => handleViewMapping(c.type)}
                  >
                    <FileCode className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* 3. Security & Verification Overview (Progressive Disclosure) */}
      <Card className="p-5 space-y-3 bg-muted/20 border-border/80">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Data Protection & Quality Verification
          </h3>
          <Badge variant="outline" className="text-[10px]">Enterprise Secure</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          How data from external accounting software is verified and protected before risk analysis:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1 text-xs">
          <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 space-y-1">
            <span className="font-bold text-primary text-[11px]">1. Secure Access</span>
            <p className="text-[11px] text-muted-foreground leading-tight">
              OAuth2 or encrypted credentials with tenant-isolated storage and masked secrets.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 space-y-1">
            <span className="font-bold text-primary text-[11px]">2. Standard Mapping</span>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Automatically maps invoices, payments, and dates without altering your original files.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 space-y-1">
            <span className="font-bold text-primary text-[11px]">3. Quality Check</span>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Validates amounts, checks for duplicates, and flags incomplete transaction dates.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 space-y-1">
            <span className="font-bold text-primary text-[11px]">4. Audit Trail</span>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Records permanent import records, user attribution, and source verification timestamps.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 space-y-1">
            <span className="font-bold text-primary text-[11px]">5. Risk Analysis</span>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Data is immediately available for portfolio risk scoring and delay predictions.
            </p>
          </div>
        </div>
      </Card>

      {/* 4. Configuration & Connection Test Modal */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Plug className="size-4 text-primary" />
              Configure & Test: {selectedConnector?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Verify endpoint connectivity and test tenant authentication credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {selectedConnector?.requiredConfigFields?.map((field: any) => (
              <div key={field.field} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.field} className="text-[11px] font-medium">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {field.sensitive && (
                    <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
                      <Lock className="size-2.5" /> Sensitive
                    </span>
                  )}
                </div>
                <Input
                  id={field.field}
                  type={field.type === "password" ? "password" : "text"}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                  value={configForm[field.field] || ""}
                  onChange={(e) =>
                    setConfigForm((prev) => ({ ...prev, [field.field]: e.target.value }))
                  }
                  className="text-xs h-8"
                />
                <p className="text-[10px] text-muted-foreground">{field.description}</p>
              </div>
            ))}

            {/* Test Execution Result Banner */}
            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  testResult.success
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {testResult.success ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="size-3.5 text-amber-500" />
                  )}
                  {testResult.success ? "Connection Verified" : "Connection Not Established"}
                </div>
                <p className="text-[11px] leading-snug">{testResult.message}</p>
                {testResult.missingRequirements && testResult.missingRequirements.length > 0 && (
                  <div className="pt-1 text-[10px] space-y-0.5">
                    <span className="font-semibold block">Missing Requirements:</span>
                    <ul className="list-disc list-inside">
                      {testResult.missingRequirements.map((req: string, idx: number) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex sm:justify-between items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">
              Status: {selectedConnector?.status}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setTestDialogOpen(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                className="text-xs gap-1.5"
                disabled={testMutation.isPending}
                onClick={handleRunTest}
              >
                {testMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                Run Live Connection Test
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Canonical Provider Mapping Specification Modal */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCode className="size-4 text-primary" />
              Canonical Schema Mapping: {mappings[selectedProviderKey]?.providerName || selectedProviderKey}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Deterministic mapping registry transforming raw external provider schemas into the NEXUS-CFR canonical contract.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">
                Version: {mappings[selectedProviderKey]?.version || "1.0"}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-mono">
                Provider ID: {mappings[selectedProviderKey]?.providerId || selectedProviderKey}
              </Badge>
            </div>

            <div className="rounded-lg border border-border/70 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Raw Provider Field</TableHead>
                    <TableHead className="text-xs">Canonical Target</TableHead>
                    <TableHead className="text-xs">Field Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings[selectedProviderKey]?.rawKeyFields?.map((f: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs text-foreground font-semibold">
                        {f.rawField}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-primary">
                        {f.canonicalTarget}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-64 leading-tight">
                        {f.description}
                        {f.transformationNote && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                            Note: {f.transformationNote}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setMappingDialogOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
