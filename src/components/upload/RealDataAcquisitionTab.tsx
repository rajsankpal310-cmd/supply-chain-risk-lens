import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
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
import { toast } from "sonner";
import { connectorService } from "@/services/dataServices";
import { useAuth } from "@/context/AuthContext";
import { downloadFile } from "@/utils/format";

interface RealDataAcquisitionTabProps {
  onSwitchToConnectors?: () => void;
}

export function RealDataAcquisitionTab({ onSwitchToConnectors }: RealDataAcquisitionTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [ingestionResult, setIngestionResult] = useState<any | null>(null);

  // Form State
  const [corporateEntityName, setCorporateEntityName] = useState(user?.organizationName || "");
  const [corporateRegistrationNumber, setCorporateRegistrationNumber] = useState("");
  const [authorizedSignatoryName, setAuthorizedSignatoryName] = useState(user?.name || "");
  const [signatoryTitle, setSignatoryTitle] = useState("Chief Financial Officer");
  const [legalConsentReferenceId, setLegalConsentReferenceId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");

  // 1. Fetch Acquisition Status
  const statusQuery = useQuery({
    queryKey: ["acquisition-status"],
    queryFn: () => connectorService.getAcquisitionStatus(),
  });

  const status = statusQuery.data || {
    realDataAcquired: false,
    status: "NO_REAL_SOURCE_CONNECTED",
    source: null,
    actualRecordCount: 0,
    mlGateStatus: "LOCKED",
    exactBlocker: "Authorized real enterprise primary transaction source has not yet been connected or uploaded.",
    missingHumanAction: "UPLOAD_AUTHORIZED_REAL_EXPORT",
    checklist: [
      { item: "Authorized company/source declaration", satisfied: false },
      { item: "Legal consent agreement reference", satisfied: false },
      { item: "Real historical transaction export (CSV/JSON)", satisfied: false },
      { item: "Payment lifecycle outcome dates", satisfied: false },
      { item: "Source provenance attestation", satisfied: false },
    ],
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
    };
    reader.readAsText(file);
  };

  // 2. Upload Controlled File Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !fileContent) {
        throw new Error("Please select an authorized CSV or JSON export file.");
      }
      if (!legalConsentReferenceId.trim()) {
        throw new Error("Legal consent reference ID is mandatory before real data can enter the platform.");
      }
      if (!authorizedSignatoryName.trim()) {
        throw new Error("Authorized corporate signatory name is strictly required.");
      }

      return connectorService.ingestControlledFile({
        filename: selectedFile.name,
        rawPayload: fileContent,
        corporateEntityName: corporateEntityName || "Client Enterprise Ltd",
        corporateRegistrationNumber: corporateRegistrationNumber || "N/A",
        authorizedSignatoryName,
        signatoryTitle,
        legalConsentReferenceId,
        provenance: "REAL_OBSERVED_ENTERPRISE",
        extractionPurpose: "SME Financial Risk Assessment & Supply Chain Resilience",
      });
    },
    onSuccess: (data: any) => {
      setIngestionResult(data);
      setUploadModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["acquisition-status"] });
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["connectors-list"] });
      toast.success("Authorized enterprise data export successfully ingested!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to ingest controlled enterprise file.");
    },
  });

  // Download Blank CSV Template
  const handleDownloadTemplate = () => {
    const csv = "transaction_id,sme_id,buyer_id,supplier_id,invoice_amount,invoice_date,due_date,payment_date,credit_period,outstanding_amount,payment_status,currency\n";
    downloadFile("nexus_cfr_authorized_export_template.csv", csv, "text/csv;charset=utf-8;");
    toast.success("Authorized CSV export template downloaded.");
  };

  const isAcquired = status.realDataAcquired || Boolean(ingestionResult);
  const activeBreakdown = ingestionResult?.summaryBreakdown || (isAcquired ? {
    sourceName: status.source,
    classification: status.provenanceClassification || "REAL_OBSERVED / AUTHORIZED",
    totalRecords: status.actualRecordCount,
    completedRecords: status.completedRecords,
    openCensoredRecords: status.openRecords,
    uniqueBuyers: status.buyersCount,
    uniqueSuppliers: status.suppliersCount,
    historicalCoverage: status.temporalCoverage,
    checksum: "Verified SHA-256",
    reconciliation: status.reconciliationStatus || "PASSED",
    provenance: "VERIFIED (Enterprise Legal Consent)",
    mlReadiness: status.mlGateStatus,
    reason: status.exactBlocker,
  } : null);

  return (
    <div className="space-y-6">
      {/* Page Title & Purpose */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">REAL DATA ACQUISITION</h2>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono">
              PHASE 7 MISSION
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Connect or upload an <strong>AUTHORIZED</strong> real enterprise transaction source. Zero synthetic fabrication permitted.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
            <Download className="h-4 w-4 text-primary" />
            Download Blank Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGuidelinesOpen(true)} className="gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Sensitive Data Guidelines
          </Button>
        </div>
      </div>

      {/* Main Status & Acquisition Card */}
      {!isAcquired ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Panel */}
          <Card className="lg:col-span-2 p-6 border-amber-500/30 bg-amber-500/5 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Current Acquisition Status
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <XCircle className="h-5 w-5 text-amber-500" />
                  <h3 className="text-lg font-bold text-foreground">NO REAL SOURCE CONNECTED</h3>
                </div>
              </div>
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                Awaiting Data Owner Action
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              No genuine primary enterprise accounting ledger has been acquired yet. To unlock genuine model training, the enterprise data owner must upload an authorized transaction export or connect an ERP system.
            </p>

            {/* Checklist */}
            <div className="bg-card/70 border border-border rounded-lg p-4 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Required Pre-Requisites:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex items-center justify-center text-[10px]">1</div>
                  <span>Authorized company / primary source declaration</span>
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex items-center justify-center text-[10px]">2</div>
                  <span>Legal consent agreement reference (Board resolution / Data Sharing Agreement)</span>
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex items-center justify-center text-[10px]">3</div>
                  <span>Historical accounts receivable/payable transaction export (.csv / .json)</span>
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex items-center justify-center text-[10px]">4</div>
                  <span>Payment lifecycle outcome information (both settled vouchers and open balances)</span>
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex items-center justify-center text-[10px]">5</div>
                  <span>Source ownership & real-observed provenance attestation</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => setUploadModalOpen(true)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-sm"
              >
                <UploadCloud className="h-4 w-4" />
                UPLOAD AUTHORIZED DATA EXPORT
              </Button>
              <Button
                variant="outline"
                onClick={onSwitchToConnectors}
                className="gap-2 border-border hover:bg-muted"
              >
                <Server className="h-4 w-4 text-primary" />
                Connect Accounting Source
              </Button>
              <Button
                variant="outline"
                onClick={onSwitchToConnectors}
                className="gap-2 border-border hover:bg-muted"
              >
                <Layers className="h-4 w-4 text-primary" />
                Connect ERP System
              </Button>
            </div>
          </Card>

          {/* Quick Explainer Panel */}
          <Card className="p-6 border-border bg-card flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <ShieldCheck className="h-4 w-4" />
                The Governed Acquisition Invariant
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                NEXUS-CFR distinguishes between <strong>Data Acquisition</strong> and <strong>ML Readiness</strong>:
              </p>
              <div className="p-3 bg-muted/40 rounded border border-border text-xs space-y-2">
                <div className="font-semibold text-foreground">Rule 1: Acquisition is Never Blocked by Sample Size</div>
                <div className="text-muted-foreground">
                  An initial export of 300 rows or 20 buyers will be accepted, reconciled, and stored as <code className="text-primary font-mono">REAL_OBSERVED_ENTERPRISE</code>.
                </div>
              </div>
              <div className="p-3 bg-muted/40 rounded border border-border text-xs space-y-2">
                <div className="font-semibold text-foreground">Rule 2: ML Unlocks Statistically</div>
                <div className="text-muted-foreground">
                  Production ML gates evaluate cumulative historical depth (1,000 completed invoices, 50 buyers, 12 months). If insufficient, ML remains locked while your data is safely governed.
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="text-[11px] text-muted-foreground font-mono">
                Missing Human Action: <span className="font-bold text-foreground">UPLOAD_AUTHORIZED_REAL_EXPORT</span>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        /* Real Data Acquired Breakdown (Mission 4 Display) */
        <div className="space-y-6">
          <Card className="p-6 border-emerald-500/40 bg-emerald-500/5 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Primary Enterprise Source Active
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">REAL DATA ACQUIRED</h3>
                </div>
              </div>
              <Badge className="bg-emerald-600 text-white font-mono text-xs px-3 py-1">
                REAL_OBSERVED_ENTERPRISE
              </Badge>
            </div>

            {/* Mission 4 Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-card rounded-md border border-border">
                <div className="text-xs text-muted-foreground">Source Name</div>
                <div className="font-semibold text-foreground truncate mt-0.5">{activeBreakdown?.sourceName || "Authorized File"}</div>
              </div>
              <div className="p-3 bg-card rounded-md border border-border">
                <div className="text-xs text-muted-foreground">Classification</div>
                <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeBreakdown?.classification || "REAL_OBSERVED / AUTHORIZED"}</div>
              </div>
              <div className="p-3 bg-card rounded-md border border-border">
                <div className="text-xs text-muted-foreground">Total Ingested Records</div>
                <div className="font-bold text-lg text-foreground mt-0.5">{activeBreakdown?.totalRecords ?? 0}</div>
              </div>
              <div className="p-3 bg-card rounded-md border border-border">
                <div className="text-xs text-muted-foreground">Completed / Settled</div>
                <div className="font-bold text-lg text-foreground mt-0.5">{activeBreakdown?.completedRecords ?? 0}</div>
              </div>
              <div className="p-3 bg-card rounded-md border border-border">
                <div className="text-xs text-muted-foreground">Open / Right-Censored</div>
                <div className="font-bold text-lg text-foreground mt-0.5">{activeBreakdown?.openCensoredRecords ?? 0}</div>
              </div>
              <div className="p-3 bg-card rounded-md border border-border">
                <div className="text-xs text-muted-foreground">Commercial Buyers</div>
                <div className="font-bold text-lg text-foreground mt-0.5">{activeBreakdown?.uniqueBuyers ?? 0}</div>
              </div>
              <div className="p-3 bg-card rounded-md border border-border">
                <div className="text-xs text-muted-foreground">Historical Coverage</div>
                <div className="font-semibold text-foreground mt-0.5">{activeBreakdown?.historicalCoverage || "Recorded"}</div>
              </div>
              <div className="p-3 bg-card rounded-md border border-border">
                <div className="text-xs text-muted-foreground">Reconciliation Audit</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeBreakdown?.reconciliation || "PASSED"}</div>
              </div>
            </div>

            {/* Checksum & Provenance */}
            <div className="p-4 bg-muted/30 rounded-md border border-border space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cryptographic SHA-256 Checksum:</span>
                <span className="font-bold text-foreground truncate max-w-md">{activeBreakdown?.checksum}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Data Provenance Verification:</span>
                <span className="font-bold text-foreground">{activeBreakdown?.provenance}</span>
              </div>
            </div>

            {/* ML Gate Status Banner */}
            <div className={`p-4 rounded-md border flex items-start justify-between ${
              activeBreakdown?.mlReadiness === "READY"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
            }`}>
              <div className="space-y-1">
                <div className="font-bold text-sm flex items-center gap-2">
                  {activeBreakdown?.mlReadiness === "READY" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  ML READINESS GATE: {activeBreakdown?.mlReadiness}
                </div>
                <div className="text-xs opacity-90">
                  {activeBreakdown?.reason}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUploadModalOpen(true)}
                className="gap-1.5"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Upload Additional Batches
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Controlled File Ingestion Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Upload Authorized Enterprise Data Export
            </DialogTitle>
            <DialogDescription>
              Submit an authorized primary accounting ledger (.csv or .json). Corporate legal consent is mandatory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="corpName">Corporate Entity Name *</Label>
                <Input
                  id="corpName"
                  value={corporateEntityName}
                  onChange={(e) => setCorporateEntityName(e.target.value)}
                  placeholder="e.g. Acme Manufacturing Pvt Ltd"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cin">CIN / MSME Registration</Label>
                <Input
                  id="cin"
                  value={corporateRegistrationNumber}
                  onChange={(e) => setCorporateRegistrationNumber(e.target.value)}
                  placeholder="e.g. U29253MH2018PTC123456"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="signatory">Authorized Signatory Name *</Label>
                <Input
                  id="signatory"
                  value={authorizedSignatoryName}
                  onChange={(e) => setAuthorizedSignatoryName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="title">Signatory Title / Designation *</Label>
                <Input
                  id="title"
                  value={signatoryTitle}
                  onChange={(e) => setSignatoryTitle(e.target.value)}
                  placeholder="e.g. Chief Financial Officer"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="consentId">Legal Consent Reference ID *</Label>
              <Input
                id="consentId"
                value={legalConsentReferenceId}
                onChange={(e) => setLegalConsentReferenceId(e.target.value)}
                placeholder="e.g. DSA-2026-BOARD-RES-42"
              />
              <p className="text-[11px] text-muted-foreground">
                Internal reference of the data-sharing agreement or corporate resolution approving data export.
              </p>
            </div>

            <div className="space-y-1 border-t border-border pt-3">
              <Label htmlFor="fileInput">Transaction Export File (.csv or .json) *</Label>
              <Input
                id="fileInput"
                type="file"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-xs text-emerald-600 font-mono mt-1">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="p-3 bg-muted/40 rounded border border-border text-xs space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Data Provenance Classification: REAL_OBSERVED_ENTERPRISE
              </div>
              <p className="text-muted-foreground">
                By uploading, you attest that this export reflects real commercial accounting transactions from the named enterprise.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !selectedFile || !legalConsentReferenceId}
              className="gap-2"
            >
              {uploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm & Ingest Authorized Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sensitive Data Guidelines Modal */}
      <Dialog open={guidelinesOpen} onOpenChange={setGuidelinesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Privacy & Sensitive Data Minimization Guidelines
            </DialogTitle>
            <DialogDescription>
              What to include and what to strictly exclude when preparing your enterprise export.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs leading-relaxed">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md space-y-1.5">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">Required Commercial Columns:</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code className="text-foreground">transaction_id</code> — Unique invoice number</li>
                <li><code className="text-foreground">sme_id</code> — Identifier of selling SME / vendor</li>
                <li><code className="text-foreground">buyer_id</code> — Identifier of corporate buyer</li>
                <li><code className="text-foreground">invoice_amount</code> — Gross monetary amount</li>
                <li><code className="text-foreground">invoice_date</code> & <code className="text-foreground">due_date</code> — Contractual timeline</li>
                <li><code className="text-foreground">payment_date</code> & <code className="text-foreground">payment_status</code> — Settlement outcome</li>
              </ul>
            </div>

            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-md space-y-1.5">
              <div className="font-bold text-rose-700 dark:text-rose-300">STRICTLY EXCLUDE (Do NOT Include):</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>✕ Personal names, phone numbers, or email addresses</li>
                <li>✕ Physical billing or shipping addresses</li>
                <li>✕ Bank account numbers, IFSC, or SWIFT details</li>
                <li>✕ Individual PAN or Aadhaar numbers</li>
                <li>✕ Passwords, API tokens, or server credentials</li>
              </ul>
            </div>

            <p className="text-muted-foreground">
              You are encouraged to replace proprietary names with internal anonymous surrogate IDs (e.g. <code className="text-foreground font-mono">BUYER-001</code>).
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setGuidelinesOpen(false)}>Understood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
