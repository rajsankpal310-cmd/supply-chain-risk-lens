import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileCheck,
  FileText,
  History,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { ProvenanceBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { CANONICAL_SCHEMA, EXPECTED_COLUMNS, uploadService } from "@/services/dataServices";
import type { QualityScorecard, ValidationSummary } from "@/types";
import { downloadFile, formatDate, formatINR } from "@/utils/format";

const STEPS = [
  "1. Upload Data",
  "2. Review Data",
  "3. Validate",
  "4. Import",
  "5. Ready",
] as const;

const MAX_MB = 100;

export function UploadPage() {
  const { can, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [activeTab, setActiveTab] = useState<"pipeline" | "history">("pipeline");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [schemaProfiles, setSchemaProfiles] = useState<any[]>([]);
  const [datasetProfile, setDatasetProfile] = useState<any | null>(null);
  const [mappingCandidates, setMappingCandidates] = useState<any[]>([]);
  const [requiredStatus, setRequiredStatus] = useState({
    totalRequired: 4,
    mappedRequired: 0,
    needsReviewCount: 0,
    isReadyForValidation: false,
  });
  const [optionalStatus, setOptionalStatus] = useState({ totalOptional: 12, mappedOptional: 0 });
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<(ValidationSummary & { scorecard?: QualityScorecard }) | null>(null);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  // Progressive disclosure toggle for technical validation & mapping details
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showMappingAdjuster, setShowMappingAdjuster] = useState(true);
  const [showSourceDetails, setShowSourceDetails] = useState(false);

  // Data Source Details (Sensible business defaults)
  const [sourceType, setSourceType] = useState<"PRIMARY_TRANSACTION" | "PUBLIC_DATASET" | "EXTERNAL_REFERENCE" | "DEMO_ONLY">("PRIMARY_TRANSACTION");
  const [sourceName, setSourceName] = useState("Primary Company Invoices");
  const [sourceOrg, setSourceOrg] = useState(user?.organizationName || "Operational Workspace");
  const [sourceUrl, setSourceUrl] = useState("");
  const [datasetVersion, setDatasetVersion] = useState("2026.Q3");
  const [license, setLicense] = useState("Internal Proprietary Commercial");
  const [dataGranularity, setDataGranularity] = useState("TRANSACTION_LEVEL");

  // Fetch past import batches
  const batchesQuery = useQuery({
    queryKey: ["import-batches"],
    queryFn: () => uploadService.getImportBatches(1, 20),
  });

  // Step 1 -> 2: Parse file and review data using Universal Semantic Mapping
  const parseAndInspect = useMutation({
    mutationFn: async (f: File) => {
      const parsedData = await uploadService.parseFile(f);
      // Sample bounded 50 rows for multi-signal profiling
      const sampleRows = parsedData.rows.slice(0, 50);
      const inspection = await uploadService.inspectSchema(parsedData.headers, sampleRows);
      return { parsedData, inspection };
    },
    onSuccess: ({ parsedData, inspection }) => {
      setParsed(parsedData);
      setSchemaProfiles(inspection.profiles || []);
      setDatasetProfile(inspection.datasetProfile || null);
      setMappingCandidates(inspection.mappingCandidates || []);
      setRequiredStatus(
        inspection.requiredFieldsStatus || {
          totalRequired: 4,
          mappedRequired: 0,
          needsReviewCount: 0,
          isReadyForValidation: false,
        }
      );
      setOptionalStatus(
        inspection.optionalFieldsStatus || {
          totalOptional: 12,
          mappedOptional: 0,
        }
      );

      // Use the pure semantic mapping suggested by UniversalMappingEngine - no substring guessing
      const autoMapping: Record<string, string> = { ...(inspection.suggestedMapping || {}) };
      setMapping(autoMapping);
      setStep(1); // Move to Step 2: Review Data
      toast.success(`Found ${parsedData.rows.length} records. Semantic analysis complete.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });

  const handleMappingChange = (canonicalKey: string, sourceCol: string) => {
    const val = sourceCol === "__unmapped__" ? "" : sourceCol;
    const newMapping = { ...mapping };
    if (val) {
      newMapping[canonicalKey] = val;
    } else {
      delete newMapping[canonicalKey];
    }
    setMapping(newMapping);

    setMappingCandidates((prev) =>
      prev.map((c) => {
        if (c.canonicalField === canonicalKey) {
          return {
            ...c,
            sourceColumn: val || null,
            confidence: val ? 100 : 0,
            tier: val ? "HIGH" : "UNCERTAIN",
            reason: val ? "Selected by user override." : "Unmapped by user.",
            needsReview: false,
          };
        }
        return c;
      })
    );

    const direction = datasetProfile?.detectedRelationshipDirection;
    let totalReq = 4;
    let mappedReq = 0;

    const hasTxn = Boolean(newMapping["transaction_id"]);
    const hasAmt = Boolean(newMapping["invoice_amount"]);
    const hasDate = Boolean(newMapping["invoice_date"]);
    const hasSupplier = Boolean(newMapping["supplier_id"] || newMapping["supplier_name"]);
    const hasBuyer = Boolean(newMapping["buyer_id"] || newMapping["buyer_name"]);
    const hasSme = Boolean(newMapping["sme_id"]);

    if (direction === "SUPPLIER_TO_BUYER" || (hasSupplier && hasBuyer && !hasSme)) {
      totalReq = 5;
      if (hasTxn) mappedReq++;
      if (hasSupplier) mappedReq++;
      if (hasBuyer) mappedReq++;
      if (hasAmt) mappedReq++;
      if (hasDate) mappedReq++;
    } else if (direction === "SUPPLIER_TO_SME" || (hasSupplier && (hasSme || !hasBuyer))) {
      totalReq = 4;
      if (hasTxn) mappedReq++;
      if (hasSupplier) mappedReq++;
      if (hasAmt) mappedReq++;
      if (hasDate) mappedReq++;
    } else {
      totalReq = 4;
      if (hasTxn) mappedReq++;
      if (hasBuyer || hasSme) mappedReq++;
      if (hasAmt) mappedReq++;
      if (hasDate) mappedReq++;
    }

    const boundedMapped = Math.min(mappedReq, totalReq);

    setRequiredStatus((prev) => ({
      ...prev,
      totalRequired: totalReq,
      mappedRequired: boundedMapped,
      isReadyForValidation: boundedMapped >= totalReq,
    }));
  };

  // Step 2 -> 3: Validate dataset
  const validate = useMutation({
    mutationFn: () => uploadService.validate(parsed!.rows, mapping),
    onSuccess: (data) => {
      setSummary(data);
      setStep(2); // Move to Step 3: Validate
      if (data.validRows === 0) {
        toast.warning(`Validation completed: 0 valid records (${data.invalidRows} records require correction).`);
      } else if (data.invalidRows > 0) {
        toast.info(`Validation complete: ${data.validRows} valid records, ${data.invalidRows} records flagged.`);
      } else {
        toast.success(`Validation check complete: ${data.validRows} valid records ready.`);
      }
    },
    onError: (err: any) => {
      const msg = err?.message || err?.error?.message || "Validation failed. Please review your data columns.";
      toast.error(msg);
    },
  });

  // Step 3 -> 4 -> 5: Import into PostgreSQL
  const doImport = useMutation({
    mutationFn: async () => {
      setStep(3); // Step 4: Import in progress
      setProgress(0);
      for (let p = 20; p <= 80; p += 20) {
        await new Promise((r) => setTimeout(r, 120));
        setProgress(p);
      }

      const res = await uploadService.importTransactions({
        rows: parsed!.rows,
        mapping,
        sourceType,
        sourceName,
        sourceOrg,
        sourceUrl: sourceUrl || undefined,
        datasetVersion: datasetVersion || undefined,
        license: license || undefined,
        dataGranularity,
        fileSize: file?.size,
      });

      setProgress(100);
      return res;
    },
    onSuccess: (res) => {
      setImported(res.imported);
      setBatchId(res.batchId);
      setStep(4); // Step 5: Ready for Risk Analysis
      queryClient.invalidateQueries();
      toast.success(`${res.imported} transactions saved to active ledger.`);
    },
    onError: (err: any) => {
      const msg = err?.message || err?.error?.message || "Import failed";
      toast.error(msg);
      setStep(2); // return to validation step on failure
    },
  });

  if (!can("data:upload")) {
    return (
      <EmptyState
        title="Upload access restricted"
        description="Your current role can view risk analyses but cannot upload transaction data. Contact your SME Admin to import company files."
      />
    );
  }

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const ok = /\.(csv|xlsx|xls)$/i.test(f.name);
    if (!ok) {
      toast.error("Only CSV or Excel files are supported (.csv, .xlsx, .xls)");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error("File is too large. Maximum supported size is 100 MB.");
      return;
    }
    setFile(f);
    if (!sourceName || sourceName === "Primary Company Invoices") {
      setSourceName(f.name);
    }
    parseAndInspect.mutate(f);
  }

  function reset() {
    setStep(0);
    setFile(null);
    setParsed(null);
    setSchemaProfiles([]);
    setMapping({});
    setSummary(null);
    setImported(null);
    setBatchId(null);
    setProgress(0);
    setShowTechnicalDetails(false);
    setShowMappingAdjuster(false);
  }

  const scorecard = summary?.scorecard;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          title="Upload Company Data"
          description="Upload your transaction data to assess financial and supply-chain risk."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={activeTab === "pipeline" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("pipeline")}
            className="text-xs gap-1.5 font-semibold"
          >
            <UploadCloud className="size-3.5" /> Upload Data
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="text-xs gap-1.5"
          >
            <History className="size-3.5" /> Import History
          </Button>
        </div>
      </div>

      {activeTab === "history" ? (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Database className="size-4 text-primary" />
                Ledger Ingestion History
              </h2>
              <p className="text-xs text-muted-foreground">Historical record of all transaction files imported into your organization.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => batchesQuery.refetch()} disabled={batchesQuery.isFetching}>
              <RefreshCw className={batchesQuery.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
            </Button>
          </div>

          {batchesQuery.isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading import history...
            </div>
          ) : (batchesQuery.data?.items?.length ?? 0) === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No transaction files imported yet. Upload your first CSV or Excel file to get started.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Data Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Total Rows</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead className="text-right">Rejected</TableHead>
                    <TableHead className="text-right">Imported On</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchesQuery.data?.items.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs font-semibold">{b.id.slice(0, 13)}…</TableCell>
                      <TableCell className="text-xs font-medium max-w-44 truncate">{b.sourceName}</TableCell>
                      <TableCell>
                        <ProvenanceBadge sourceType={b.sourceType} dataStatus={b.dataStatus} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{b.recordCount}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-500 font-semibold">{b.acceptedCount}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-destructive">{b.rejectedCount}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatDate(b.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-[10px] font-mono text-emerald-500 border-emerald-500/30">
                          {b.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Step Progress Bar */}
          <ol className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:gap-2 no-scrollbar">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={`flex items-center gap-1.5 shrink-0 sm:shrink rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium transition-all ${
                  i === step
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                    : i < step
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                    : "border-border/60 text-muted-foreground/60"
                }`}
              >
                {i < step ? <CheckCircle2 className="size-3.5 shrink-0" /> : <span className="font-mono text-[11px]">{i + 1}</span>}
                <span className="whitespace-nowrap sm:truncate">{s.replace(/^\d+\.\s*/, "")}</span>
              </li>
            ))}
          </ol>

          {/* STEP 1: UPLOAD DATA */}
          {step === 0 && (
            <Card className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <UploadCloud className="size-5 text-primary" />
                    Upload Company Invoices & Transactions
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upload your invoice or transaction records to evaluate counterparty risks and cash-at-risk.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile("nexus-cfr-template.csv", uploadService.sampleTemplateCsv(), "text/csv")}
                  className="text-xs gap-1.5 shrink-0"
                >
                  <Download className="size-3.5" /> Download CSV Template
                </Button>
              </div>

              {/* Dropzone */}
              <div
                className={`border-border/80 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
                  dragging ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <div className="rounded-full bg-primary/10 p-3.5 text-primary mb-3">
                  <UploadCloud className="size-8" />
                </div>
                <p className="font-semibold text-sm text-foreground">Click to upload or drag & drop</p>
                <p className="text-xs text-muted-foreground mt-1">Supported formats: CSV, Excel (.xlsx, .xls) up to 100MB</p>
                <Button type="button" size="sm" className="mt-4 pointer-events-none">
                  Select File from Computer
                </Button>
              </div>

              {parseAndInspect.isPending && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Reading file & detecting data structure...
                </div>
              )}

              {/* Optional: Data Source Details (Progressive Disclosure) */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowSourceDetails(!showSourceDetails)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  {showSourceDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  Optional: Data Source Details
                </button>

                {showSourceDetails && (
                  <div className="grid gap-3 sm:grid-cols-3 mt-3 p-3.5 rounded-lg border bg-muted/20 text-xs">
                    <div>
                      <Label htmlFor="src-name" className="text-[11px] text-muted-foreground">Data Name</Label>
                      <Input
                        id="src-name"
                        value={sourceName}
                        onChange={(e) => setSourceName(e.target.value)}
                        className="text-xs mt-1"
                        placeholder="e.g. Q3 Sales Ledger"
                      />
                    </div>
                    <div>
                      <Label htmlFor="src-org" className="text-[11px] text-muted-foreground">Organization</Label>
                      <Input
                        id="src-org"
                        value={sourceOrg}
                        onChange={(e) => setSourceOrg(e.target.value)}
                        className="text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="src-type" className="text-[11px] text-muted-foreground">Data Type</Label>
                      <Select value={sourceType} onValueChange={(v: any) => setSourceType(v)}>
                        <SelectTrigger id="src-type" className="text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRIMARY_TRANSACTION">Company Ledger (Verified)</SelectItem>
                          <SelectItem value="PUBLIC_DATASET">Reference Dataset</SelectItem>
                          <SelectItem value="DEMO_ONLY">Demonstration Sample</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Sensitive Data & Privacy Guidelines */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">Sensitive Data & Privacy Guidelines</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Your transaction data is strictly scoped to your organization under multi-tenant isolation.
                  Do NOT include confidential banking passwords, OTPs, or personal identity numbers.
                  Expected ledger columns include: <span className="font-mono text-foreground font-medium">Invoice ID, Buyer Name, Invoice Date, Due Date, Amount, Outstanding Amount, and Status</span>.
                </p>
              </div>
            </Card>
          )}

          {/* STEP 2: REVIEW DATA */}
          {step === 1 && parsed && (
            <Card className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <FileCheck className="size-5 text-primary" />
                    Review Uploaded Data
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Found {parsed.rows.length} records and {parsed.headers.length} columns in {file?.name || "your file"}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="text-xs">
                    Choose Different File
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => validate.mutate()}
                    disabled={validate.isPending}
                    className="text-xs gap-1.5"
                  >
                    {validate.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    Continue to Validation <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Data Summary Stats */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="p-3.5 rounded-lg border bg-card space-y-1">
                  <p className="text-[11px] text-muted-foreground">Total Records</p>
                  <p className="text-lg font-mono font-bold text-foreground">{parsed.rows.length}</p>
                </div>
                <div className="p-3.5 rounded-lg border bg-card space-y-1">
                  <p className="text-[11px] text-muted-foreground">Columns Detected</p>
                  <p className="text-lg font-mono font-bold text-foreground">{parsed.headers.length}</p>
                </div>
                <div className="p-3.5 rounded-lg border bg-card space-y-1">
                  <p className="text-[11px] text-muted-foreground">Required Columns</p>
                  <p className={`text-lg font-mono font-bold ${requiredStatus.isReadyForValidation ? "text-emerald-500" : "text-amber-500"}`}>
                    {Math.min(requiredStatus.mappedRequired, requiredStatus.totalRequired)} of {requiredStatus.totalRequired} Mapped
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border bg-card space-y-1">
                  <p className="text-[11px] text-muted-foreground">Optional Columns</p>
                  <p className="text-lg font-mono font-bold text-blue-500">
                    {optionalStatus.mappedOptional} of {optionalStatus.totalOptional} Mapped
                  </p>
                </div>
              </div>

              {/* Dataset Semantic Profile Banner */}
              {datasetProfile && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-primary" />
                      <h4 className="text-xs font-semibold text-foreground">Dataset Semantic Profile</h4>
                    </div>
                    <Badge variant="outline" className="text-[11px] bg-background">
                      {datasetProfile.detectedRelationshipDirection === "SUPPLIER_TO_BUYER"
                        ? "Supplier → Buyer Relationship"
                        : datasetProfile.detectedRelationshipDirection === "SME_TO_BUYER"
                        ? "SME → Customer Sales Ledger"
                        : datasetProfile.detectedRelationshipDirection === "SUPPLIER_TO_SME"
                        ? "Supplier → SME Procurement Ledger"
                        : "General Transaction Ledger"}
                    </Badge>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
                    <div>
                      <span className="text-[11px] text-foreground font-medium">Dates: </span>
                      {datasetProfile.dateColumns.length > 0 ? datasetProfile.dateColumns.join(", ") : "None detected"}
                    </div>
                    <div>
                      <span className="text-[11px] text-foreground font-medium">Amounts: </span>
                      {datasetProfile.amountColumns.length > 0 ? datasetProfile.amountColumns.join(", ") : "None detected"}
                    </div>
                    <div>
                      <span className="text-[11px] text-foreground font-medium">Parties: </span>
                      {datasetProfile.partyColumns.length > 0 ? datasetProfile.partyColumns.join(", ") : "None detected"}
                    </div>
                  </div>

                  {/* Informational Guidance Alerts */}
                  {!mapping["buyer_id"] && !mapping["buyer_name"] && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="size-3 shrink-0" />
                      Buyer information was not detected in this source. Please map a counterparty if available.
                    </p>
                  )}
                  {!mapping["due_date"] && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Info className="size-3 shrink-0" />
                      Due date not detected in source file; not fabricated. Existing settlement dates will establish baseline timeline.
                    </p>
                  )}
                </div>
              )}

              {/* Sample Data Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sample Data Preview (First 5 Rows)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowMappingAdjuster(!showMappingAdjuster)}
                    className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    {showMappingAdjuster ? "Hide Mapping Details" : "Review Column Mapping"}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/70 max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {parsed.headers.slice(0, 8).map((h) => (
                          <TableHead key={h} className="text-xs font-medium">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.rows.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          {parsed.headers.slice(0, 8).map((h) => (
                            <TableCell key={h} className="text-xs font-mono text-muted-foreground truncate max-w-40">
                              {row[h] || "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Universal Semantic Mapping Engine Section */}
              {showMappingAdjuster && (
                <div className="space-y-4 p-4 rounded-xl border bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                        <FileCheck className="size-4 text-primary" />
                        Universal Semantic Column Mapping
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Inferred business roles using multi-signal data analysis (headers, data types, uniqueness, and value patterns).
                      </p>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {Math.min(requiredStatus.mappedRequired, requiredStatus.totalRequired)} / {requiredStatus.totalRequired} required configured
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {CANONICAL_SCHEMA.map((field) => {
                      const candidate = mappingCandidates.find((c) => c.canonicalField === field.key);
                      const isFieldRequired = candidate?.isRequired ?? field.isRequired;
                      const selectedSource = mapping[field.key] || "";
                      const confidence = candidate?.confidence ?? 0;
                      const tier = candidate?.tier ?? "UNCERTAIN";
                      const reason = candidate?.reason || "Not mapped";
                      const needsReview = candidate?.needsReview ?? false;

                      return (
                        <div key={field.key} className="space-y-1.5 p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor={`map-${field.key}`} className="text-xs font-semibold truncate">
                              {field.label}
                            </Label>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isFieldRequired ? "bg-destructive/10 text-destructive font-medium" : "bg-muted text-muted-foreground"}`}>
                              {isFieldRequired ? "Required" : "Optional"}
                            </span>
                          </div>

                          <Select
                            value={selectedSource || "__unmapped__"}
                            onValueChange={(val) => handleMappingChange(field.key, val)}
                          >
                            <SelectTrigger id={`map-${field.key}`} className="h-8 text-xs">
                              <SelectValue placeholder="— Unmapped —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unmapped__">— Unmapped —</SelectItem>
                              {parsed.headers.map((h) => (
                                <SelectItem key={h} value={h} className="text-xs font-mono">
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="flex items-center justify-between pt-1">
                            {selectedSource ? (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  confidence >= 90
                                    ? "border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                                    : confidence >= 70
                                    ? "border-amber-500 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20"
                                    : "border-orange-500 text-orange-600 bg-orange-50/50 dark:bg-orange-950/20"
                                }`}
                              >
                                {confidence >= 90 ? "High" : confidence >= 70 ? "Medium" : "Needs Review"} ({confidence}%)
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground font-mono">Unmapped</span>
                            )}
                          </div>

                          <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2" title={reason}>
                            {reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                {!requiredStatus.isReadyForValidation && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />
                    Please map required fields (Transaction ID, Amount, Invoice Date, and at least one counterparty).
                  </p>
                )}
                <div className="flex justify-end w-full sm:w-auto">
                  <Button
                    size="sm"
                    onClick={() => validate.mutate()}
                    disabled={validate.isPending || !requiredStatus.isReadyForValidation}
                    className="gap-1.5 text-xs"
                  >
                    {validate.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    Continue to Validation <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* STEP 3: VALIDATE */}
          {step === 2 && summary && (
            <Card className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-500" />
                    Validation Result
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Data structure and business rules checked against standard accounting integrity requirements.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
                    Back to Review
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => doImport.mutate()}
                    disabled={summary.validRows === 0 || doImport.isPending}
                    className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Import {summary.validRows} Records <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Validation Summary Outcome Card */}
              {summary.validRows > 0 ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                    <CheckCircle2 className="size-4" /> Data structure valid & ready for import
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Found <span className="font-semibold text-foreground">{summary.validRows} clean transaction rows</span> ready to be added to your risk analytics workspace.
                    {summary.invalidRows > 0 && ` (${summary.invalidRows} records with issues will be excluded).`}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                    <AlertTriangle className="size-4" /> Data needs attention
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    None of the rows in the file met the minimum required fields (invoice ID, buyer name, amount, or due date). Please check your file formatting.
                  </p>
                </div>
              )}

              {/* Simple Overview Cards */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-3.5 rounded-lg border bg-card space-y-1">
                  <p className="text-[11px] text-muted-foreground">Valid Records</p>
                  <p className="text-xl font-mono font-bold text-emerald-500">{summary.validRows}</p>
                  <p className="text-[10px] text-muted-foreground">Ready to import</p>
                </div>
                <div className="p-3.5 rounded-lg border bg-card space-y-1">
                  <p className="text-[11px] text-muted-foreground">Filtered / Excluded</p>
                  <p className="text-xl font-mono font-bold text-muted-foreground">{summary.invalidRows}</p>
                  <p className="text-[10px] text-muted-foreground">Missing required data</p>
                </div>
                <div className="p-3.5 rounded-lg border bg-card space-y-1">
                  <p className="text-[11px] text-muted-foreground">Data Quality</p>
                  <p className="text-xl font-mono font-bold text-primary">
                    {scorecard ? `${scorecard.overallQualityScore}/100` : "Good"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Structure integrity score</p>
                </div>
              </div>

              {/* Progressive Disclosure: View Validation Details */}
              <div className="border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="text-xs gap-1.5"
                >
                  {showTechnicalDetails ? "Hide Validation Details" : "View Validation Details"}
                </Button>

                {showTechnicalDetails && (
                  <div className="mt-4 space-y-4 p-4 rounded-lg border bg-muted/20 text-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">Detailed Quality Scorecard</p>
                      <p className="text-muted-foreground text-[11px]">
                        Internal validation metrics verifying uniqueness, schema conformance, and date alignment.
                      </p>
                    </div>

                    {scorecard && (
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="p-2.5 rounded bg-card border">
                          <span className="text-muted-foreground text-[10px]">Validity:</span>
                          <p className="font-mono font-semibold">{scorecard.validityRate}%</p>
                        </div>
                        <div className="p-2.5 rounded bg-card border">
                          <span className="text-muted-foreground text-[10px]">Completeness:</span>
                          <p className="font-mono font-semibold">{scorecard.completenessRate}%</p>
                        </div>
                        <div className="p-2.5 rounded bg-card border">
                          <span className="text-muted-foreground text-[10px]">Duplicates:</span>
                          <p className="font-mono font-semibold">{summary.duplicates} rows</p>
                        </div>
                        <div className="p-2.5 rounded bg-card border">
                          <span className="text-muted-foreground text-[10px]">Grade:</span>
                          <p className="font-mono font-semibold text-primary">Class {scorecard.qualityGrade}</p>
                        </div>
                      </div>
                    )}

                    {summary.invalidRows > 0 && scorecard?.rejectionReasons && (
                      <div className="space-y-2 pt-2">
                        <p className="font-semibold text-destructive text-xs">Issues Encountered:</p>
                        <div className="overflow-x-auto max-h-40 rounded border bg-card">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[11px]">Row #</TableHead>
                                <TableHead className="text-[11px]">Field</TableHead>
                                <TableHead className="text-[11px]">Problem</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {scorecard.rejectionReasons.slice(0, 15).map((r: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-mono text-[11px]">#{r.row}</TableCell>
                                  <TableCell className="font-mono text-[11px] text-destructive">{r.field}</TableCell>
                                  <TableCell className="text-[11px] text-muted-foreground">{r.problem}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
                  Back to Review
                </Button>
                <Button
                  size="sm"
                  onClick={() => doImport.mutate()}
                  disabled={summary.validRows === 0 || doImport.isPending}
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Import Data <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 4: IMPORT IN PROGRESS */}
          {step === 3 && (
            <Card className="p-12 space-y-4 text-center">
              <Loader2 className="size-8 animate-spin text-primary mx-auto" />
              <div className="space-y-1">
                <h3 className="font-semibold text-base">Importing Transactions</h3>
                <p className="text-xs text-muted-foreground">
                  Adding verified records to your organization's ledger and recalculating risk profiles...
                </p>
              </div>
              <div className="max-w-md mx-auto space-y-1.5 pt-2">
                <Progress value={progress} className="h-2" />
                <p className="text-[11px] font-mono text-muted-foreground">{progress}% complete</p>
              </div>
            </Card>
          )}

          {/* STEP 5: READY FOR RISK ANALYSIS */}
          {step === 4 && (
            <Card className="p-8 space-y-6 text-center max-w-xl mx-auto border-emerald-500/30">
              <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-8" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-foreground">Data Imported Successfully</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">{imported} transaction records</span> have been added to your organization's ledger.
                  Your workspace is now ready for risk scoring and scenario simulations.
                </p>
              </div>

              {batchId && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/70 bg-muted/30 font-mono text-xs text-muted-foreground">
                  <span>Batch Reference:</span>
                  <span className="text-foreground font-semibold">{batchId.slice(0, 16)}…</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button size="sm" onClick={() => navigate({ to: "/app/dashboard" })} className="text-xs gap-1.5">
                  View Risk Dashboard <ArrowRight className="size-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/transactions" })} className="text-xs gap-1.5">
                  View Transactions
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/simulator" })} className="text-xs gap-1.5">
                  Run Scenario Simulation
                </Button>
                <Button variant="ghost" size="sm" onClick={reset} className="text-xs gap-1.5">
                  <RotateCcw className="size-3.5" /> Upload Another File
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
