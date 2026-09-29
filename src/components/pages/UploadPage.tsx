import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  History,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  X,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { EXPECTED_COLUMNS, uploadService } from "@/services/dataServices";
import { DataGovernanceAuditTab } from "@/components/upload/DataGovernanceAuditTab";
import { EnterpriseConnectorsTab } from "@/components/upload/EnterpriseConnectorsTab";
import { RealDataAcquisitionTab } from "@/components/upload/RealDataAcquisitionTab";
import type { QualityScorecard, ValidationSummary } from "@/types";
import { downloadFile, formatDate, formatINR } from "@/utils/format";

const STEPS = [
  "1. Provenance",
  "2. Select File",
  "3. Schema & Mapping",
  "4. Quality & Audit",
  "5. Confirm Import",
  "6. Verified Persistence",
] as const;

const MAX_MB = 10;

export function UploadPage() {
  const { can, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [activeTab, setActiveTab] = useState<"acquisition" | "pipeline" | "history" | "audit" | "connectors">("acquisition");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [schemaProfiles, setSchemaProfiles] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<(ValidationSummary & { scorecard?: QualityScorecard }) | null>(null);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  // Provenance Form State
  const [sourceType, setSourceType] = useState<"PRIMARY_TRANSACTION" | "PUBLIC_DATASET" | "EXTERNAL_REFERENCE" | "DEMO_ONLY">("PRIMARY_TRANSACTION");
  const [sourceName, setSourceName] = useState("Primary ERP Ledger");
  const [sourceOrg, setSourceOrg] = useState(user?.organizationName || "Enterprise Operating Unit");
  const [sourceUrl, setSourceUrl] = useState("");
  const [datasetVersion, setDatasetVersion] = useState("2026.Q3");
  const [license, setLicense] = useState("Internal Proprietary Commercial");
  const [dataGranularity, setDataGranularity] = useState("TRANSACTION_LEVEL");

  // Fetch past import batches
  const batchesQuery = useQuery({
    queryKey: ["import-batches"],
    queryFn: () => uploadService.getImportBatches(1, 20),
  });

  // Step 2 -> 3: Parse file and inspect schema
  const parseAndInspect = useMutation({
    mutationFn: async (f: File) => {
      const parsedData = await uploadService.parseFile(f);
      const inspection = await uploadService.inspectSchema(parsedData.headers, parsedData.rows.slice(0, 10));
      return { parsedData, inspection };
    },
    onSuccess: ({ parsedData, inspection }) => {
      setParsed(parsedData);
      setSchemaProfiles(inspection.profiles || []);

      const autoMapping: Record<string, string> = { ...inspection.suggestedMapping };
      // Fallback matching if backend suggested mapping missed any canonical column
      for (const col of EXPECTED_COLUMNS) {
        if (!autoMapping[col]) {
          const norm = col.replace(/_/g, "");
          const match = parsedData.headers.find((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "").includes(norm.slice(0, 6)));
          if (match) autoMapping[col] = match;
        }
      }
      setMapping(autoMapping);
      setStep(2);
      toast.success(`Parsed ${parsedData.rows.length} rows. Schema detected with ${Object.keys(autoMapping).length} mapped columns.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });

  // Step 3 -> 4: Validate dataset with backend quality analyzer
  const validate = useMutation({
    mutationFn: () => uploadService.validate(parsed!.rows, mapping),
    onSuccess: (data) => {
      setSummary(data);
      setStep(3);
      if (data.scorecard) {
        toast.success(`Quality analysis complete: ${data.scorecard.acceptedCount} valid, Quality Score: ${data.scorecard.overallQualityScore}/100`);
      } else {
        toast.success(`Validation complete: ${data.validRows} valid rows.`);
      }
    },
    onError: () => toast.error("Validation failed. Please verify your column mappings."),
  });

  // Step 5: Authoritative PostgreSQL Import
  const doImport = useMutation({
    mutationFn: async () => {
      setProgress(0);
      for (let p = 15; p <= 75; p += 20) {
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
      });

      setProgress(100);
      return res;
    },
    onSuccess: (res) => {
      setImported(res.imported);
      setBatchId(res.batchId);
      setStep(5);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["network"] });
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      toast.success(`${res.imported} verified transactions saved to database with provenance logging.`);
    },
    onError: (err: any) => {
      const msg = err?.message || err?.error?.message || "Import failed";
      toast.error(msg);
    },
  });

  if (!can("data:upload")) {
    return (
      <EmptyState
        title="You don't have upload access"
        description="Your current role can view analysis but cannot import transaction data. Switch to SME_ADMIN to import verified datasets."
      />
    );
  }

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const ok = /\.(csv|xlsx|xls)$/i.test(f.name);
    if (!ok) {
      toast.error("Only CSV or Excel files are supported");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Files must be under ${MAX_MB} MB`);
      return;
    }
    setFile(f);
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
  }

  const scorecard = summary?.scorecard;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          title="Real Data Foundation"
          description="Enterprise ingestion, schema detection, duplicate filtering, semantic validation, and provenance tracking."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={activeTab === "acquisition" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("acquisition")}
            className="text-xs gap-1.5 font-semibold"
          >
            <ShieldCheck className="size-3.5 text-emerald-400" /> Real Data Acquisition
          </Button>
          <Button
            variant={activeTab === "pipeline" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("pipeline")}
            className="text-xs gap-1.5"
          >
            <UploadCloud className="size-3.5" /> Ingestion Pipeline
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="text-xs gap-1.5"
          >
            <History className="size-3.5" /> Ingestion Audit Batches
          </Button>
          <Button
            variant={activeTab === "audit" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("audit")}
            className="text-xs gap-1.5"
          >
            <ShieldAlert className="size-3.5 text-amber-500" /> Data Foundation & ML Readiness
          </Button>
          <Button
            variant={activeTab === "connectors" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("connectors")}
            className="text-xs gap-1.5"
          >
            <Layers className="size-3.5 text-blue-500" /> Enterprise Connectors
          </Button>
        </div>
      </div>

      {activeTab === "acquisition" ? (
        <RealDataAcquisitionTab onSwitchToConnectors={() => setActiveTab("connectors")} />
      ) : activeTab === "connectors" ? (
        <EnterpriseConnectorsTab />
      ) : activeTab === "audit" ? (
        <DataGovernanceAuditTab />
      ) : activeTab === "history" ? (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Database className="size-4 text-primary" />
                PostgreSQL Ingestion Batches & Provenance Log
              </h2>
              <p className="text-xs text-muted-foreground">Historical records of all datasets ingested under your organization.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => batchesQuery.refetch()} disabled={batchesQuery.isFetching}>
              <RefreshCw className={batchesQuery.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
            </Button>
          </div>

          {batchesQuery.isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading batch audit trail...
            </div>
          ) : (batchesQuery.data?.items?.length ?? 0) === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No dataset batches have been imported yet. Use the Ingestion Pipeline to upload your first ERP ledger.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Source Type</TableHead>
                    <TableHead>Dataset Label</TableHead>
                    <TableHead>Source Organization</TableHead>
                    <TableHead className="text-right">Total Rows</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead className="text-right">Rejected</TableHead>
                    <TableHead className="text-right">Ingested At</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchesQuery.data?.items.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs font-semibold">{b.id.slice(0, 13)}…</TableCell>
                      <TableCell>
                        <ProvenanceBadge sourceType={b.sourceType} dataStatus={b.dataStatus} />
                      </TableCell>
                      <TableCell className="text-xs font-medium max-w-44 truncate">{b.sourceName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.sourceOrg || "—"}</TableCell>
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
          {/* Step Progress Pills */}
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  i === step
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                    : i < step
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                    : "border-border/60 text-muted-foreground/60"
                }`}
              >
                {i < step ? <CheckCircle2 className="size-3.5 shrink-0" /> : <span className="font-mono">{i + 1}</span>}
                <span className="truncate">{s.replace(/^\d+\.\s*/, "")}</span>
              </li>
            ))}
          </ol>

          {/* STAGE 0: PROVENANCE METADATA */}
          {step === 0 && (
            <Card className="p-5 space-y-5">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Stage 1: Source Provenance & Classification
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Declare dataset origin, authority, version, and licensing. NEXUS-CFR badges and processes verified ledger records separately from demo or public benchmarks.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="source-type" className="text-xs font-medium">Source Type Classification *</Label>
                  <Select
                    value={sourceType}
                    onValueChange={(v: any) => {
                      setSourceType(v);
                      if (v === "PRIMARY_TRANSACTION") {
                        setSourceName("Primary ERP Ledger");
                        setLicense("Internal Proprietary Commercial");
                      } else if (v === "PUBLIC_DATASET") {
                        setSourceName("World Bank Enterprise Survey");
                        setLicense("Open Data Commons / CC-BY");
                      } else if (v === "EXTERNAL_REFERENCE") {
                        setSourceName("Ministry of MSME / UDYAM");
                        setLicense("Government Regulatory Open Access");
                      } else if (v === "DEMO_ONLY") {
                        setSourceName("Synthetic Demonstration Data");
                        setLicense("NEXUS-CFR Evaluation License");
                      }
                    }}
                  >
                    <SelectTrigger id="source-type" className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRIMARY_TRANSACTION">Primary ERP Transaction (Verified)</SelectItem>
                      <SelectItem value="PUBLIC_DATASET">Public Benchmark Dataset</SelectItem>
                      <SelectItem value="EXTERNAL_REFERENCE">External Registry (UDYAM/TReDS)</SelectItem>
                      <SelectItem value="DEMO_ONLY">Sandbox / Synthetic Demo Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="source-name" className="text-xs font-medium">Dataset Label / Ledger Name *</Label>
                  <Input
                    id="source-name"
                    className="text-xs"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. SAP ERP Q2 Ledger"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="source-org" className="text-xs font-medium">Source Organization *</Label>
                  <Input
                    id="source-org"
                    className="text-xs"
                    value={sourceOrg}
                    onChange={(e) => setSourceOrg(e.target.value)}
                    placeholder="e.g. Apex Manufacturing Consortium"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dataset-version" className="text-xs font-medium">Dataset Version *</Label>
                  <Input
                    id="dataset-version"
                    className="text-xs font-mono"
                    value={datasetVersion}
                    onChange={(e) => setDatasetVersion(e.target.value)}
                    placeholder="2026.Q3"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="license" className="text-xs font-medium">Data License / Agreement</Label>
                  <Input
                    id="license"
                    className="text-xs"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    placeholder="e.g. Proprietary / NDA"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="granularity" className="text-xs font-medium">Data Granularity</Label>
                  <Select value={dataGranularity} onValueChange={setDataGranularity}>
                    <SelectTrigger id="granularity" className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRANSACTION_LEVEL">Transaction Level (Invoice per row)</SelectItem>
                      <SelectItem value="AGGREGATE_PERIODIC">Periodic Aggregate Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile("nexus-cfr-template.csv", uploadService.sampleTemplateCsv(), "text/csv")}
                  className="text-xs gap-1.5"
                >
                  <Download className="size-3.5" /> Download Standard CSV Template
                </Button>
                <Button
                  size="sm"
                  onClick={() => setStep(1)}
                  disabled={!sourceName.trim() || !sourceOrg.trim()}
                  className="gap-2 text-xs"
                >
                  Proceed to File Selection <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </Card>
          )}

          {/* STAGE 1: FILE SELECTION */}
          {step === 1 && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <FileSpreadsheet className="size-4 text-primary" />
                    Stage 2: Select & Upload File
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select a CSV, XLS, or XLSX file up to {MAX_MB}MB containing invoice records.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="text-xs">
                  Back to Provenance
                </Button>
              </div>

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
                <div className="rounded-full bg-primary/10 p-3 text-primary mb-3">
                  <UploadCloud className="size-7" />
                </div>
                <p className="font-semibold text-sm">Drop your invoice CSV or Excel file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse your local computer</p>
                <p className="text-[11px] text-muted-foreground/70 mt-3">Supports UTF-8 CSV, XLSX up to 10MB</p>
              </div>

              {parseAndInspect.isPending && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Parsing file & inspecting column schema...
                </div>
              )}
            </Card>
          )}

          {/* STAGE 2: SCHEMA DETECTION & MAPPING */}
          {step === 2 && parsed && (
            <Card className="p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Database className="size-4 text-primary" />
                    Stage 3: Schema Intelligence & Canonical Mapping
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Found {parsed.headers.length} columns and {parsed.rows.length} records. Match file columns to canonical concepts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
                    Change File
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => validate.mutate()}
                    disabled={validate.isPending || !mapping["sme_id"] || !mapping["buyer_id"] || !mapping["invoice_amount"]}
                    className="text-xs gap-1.5"
                  >
                    {validate.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    Run Quality & Validation Engine <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Detected Column Profiles */}
              {schemaProfiles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detected Source Columns & Type Inference</h3>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {schemaProfiles.map((p) => (
                      <div key={p.header} className="p-2.5 rounded-lg border border-border/70 bg-muted/20 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold truncate max-w-32">{p.header}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {p.inferredType}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Missing: {Math.round(p.missingRate * 100)}%
                        </p>
                        {p.sampleValues?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground truncate font-mono">
                            e.g. {p.sampleValues.slice(0, 2).join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mapping Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canonical Target Concept Mapping</h3>
                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-48">Canonical Concept</TableHead>
                        <TableHead className="w-24">Required</TableHead>
                        <TableHead>Mapped Source Header</TableHead>
                        <TableHead>Sample Data Preview</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {EXPECTED_COLUMNS.map((col) => {
                        const isReq = ["sme_id", "buyer_id", "invoice_amount", "invoice_date", "due_date"].includes(col);
                        const mappedHeader = mapping[col] || "";
                        const sampleVal = mappedHeader && parsed.rows[0] ? parsed.rows[0][mappedHeader] : "—";

                        return (
                          <TableRow key={col}>
                            <TableCell className="font-mono text-xs font-medium">
                              {col}
                            </TableCell>
                            <TableCell>
                              {isReq ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Required</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Optional</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={mappedHeader || "__unmapped__"}
                                onValueChange={(val) => {
                                  setMapping((prev) => ({
                                    ...prev,
                                    [col]: val === "__unmapped__" ? "" : val,
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs w-60">
                                  <SelectValue placeholder="Select column..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__unmapped__">— Unmapped —</SelectItem>
                                  {parsed.headers.map((h) => (
                                    <SelectItem key={h} value={h} className="text-xs">
                                      {h}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-64">
                              {sampleVal}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          )}

          {/* STAGE 3: QUALITY SCORECARD & VALIDATION AUDIT */}
          {step === 3 && summary && (
            <Card className="p-5 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert className="size-4 text-primary" />
                    Stage 4: Data Quality Scorecard & Explainable Audit
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Deterministic checks for missing fields, invalid amounts/dates, exact/potential duplicates, and state consistency.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="text-xs">
                    Adjust Mapping
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setStep(4)}
                    disabled={summary.validRows === 0}
                    className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Proceed to Import Confirmation <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Quality Metric Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="p-3.5 rounded-lg border border-border/70 bg-card space-y-1">
                  <p className="text-[11px] text-muted-foreground">Total Ingested</p>
                  <p className="text-xl font-mono font-bold">{summary.totalRows}</p>
                  <p className="text-[10px] text-muted-foreground">Rows submitted</p>
                </div>

                <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Valid / Accepted</p>
                  <p className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">{summary.validRows}</p>
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">Ready for PostgreSQL</p>
                </div>

                <div className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 space-y-1">
                  <p className="text-[11px] text-destructive font-medium">Rejected Records</p>
                  <p className="text-xl font-mono font-bold text-destructive">{summary.invalidRows}</p>
                  <p className="text-[10px] text-destructive/80">Violated business rules</p>
                </div>

                <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1">
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Exact Duplicates</p>
                  <p className="text-xl font-mono font-bold text-amber-600 dark:text-amber-400">{summary.duplicates}</p>
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80">Filtered out</p>
                </div>

                <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-primary font-medium">Quality Score</p>
                    {scorecard && (
                      <Badge variant="outline" className="text-[10px] font-bold border-primary text-primary">
                        Grade {scorecard.qualityGrade}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-mono font-bold text-primary">
                    {scorecard ? `${scorecard.overallQualityScore}/100` : `${Math.round((summary.validRows / Math.max(1, summary.totalRows)) * 100)}%`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Weighted composite</p>
                </div>
              </div>

              {/* Progress & Formula Breakdown */}
              {scorecard && (
                <div className="p-4 rounded-lg border border-border/70 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">Quality Breakdown & Rates:</span>
                    <span className="text-muted-foreground text-[11px] font-mono">{scorecard.summaryMessage}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-4 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Validity Rate:</span>
                        <span className="font-mono font-semibold">{scorecard.validityRate}%</span>
                      </div>
                      <Progress value={scorecard.validityRate} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Completeness:</span>
                        <span className="font-mono font-semibold">{scorecard.completenessRate}%</span>
                      </div>
                      <Progress value={scorecard.completenessRate} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Duplicate Rate:</span>
                        <span className="font-mono font-semibold">{scorecard.duplicateRate}%</span>
                      </div>
                      <Progress value={scorecard.duplicateRate} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Consistency:</span>
                        <span className="font-mono font-semibold">{scorecard.consistencyRate}%</span>
                      </div>
                      <Progress value={scorecard.consistencyRate} className="h-1.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Rejection Reasons Table */}
              {summary.invalidRows > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />
                    Isolated Rejection Details ({summary.invalidRows} records)
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-destructive/20 max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row #</TableHead>
                          <TableHead className="w-36">Failed Field</TableHead>
                          <TableHead>Problem Description & Violated Rule</TableHead>
                          <TableHead>Actionable Remediation / Expected Format</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scorecard?.rejectionReasons ? (
                          scorecard.rejectionReasons.slice(0, 50).map((r: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">#{r.row}</TableCell>
                              <TableCell className="font-mono text-xs text-destructive font-medium">{r.field}</TableCell>
                              <TableCell className="text-xs text-foreground">{r.problem}</TableCell>
                              <TableCell className="text-xs text-muted-foreground font-mono">{r.expectedFormat} (e.g. {r.example})</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          summary.rows
                            .filter((r: any) => !r.valid)
                            .slice(0, 30)
                            .map((r: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-xs">#{i + 1}</TableCell>
                                <TableCell className="font-mono text-xs text-destructive">Record</TableCell>
                                <TableCell className="text-xs">{r.errors.join(", ")}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">—</TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* STAGE 4: IMPORT CONFIRMATION */}
          {step === 4 && summary && (
            <Card className="p-5 space-y-5">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Stage 5: Import Confirmation & Authority Review
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Confirm transaction insertion into PostgreSQL under the authenticated organization.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-border/70 bg-muted/20 space-y-3 text-xs">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Target Organization:</span>
                    <span className="font-semibold text-foreground">{user?.organizationName || "Your Organization"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Provenance Classification:</span>
                    <ProvenanceBadge sourceType={sourceType} />
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Ledger Name:</span>
                    <span className="font-medium">{sourceName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Dataset Version:</span>
                    <span className="font-mono">{datasetVersion}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Valid Records to Ingest:</span>
                    <span className="font-mono font-bold text-emerald-500">{summary.validRows} transactions</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Rejected / Filtered:</span>
                    <span className="font-mono text-destructive">{summary.invalidRows} records</span>
                  </div>
                </div>

                <div className="p-3 rounded bg-background/50 border border-border/70 text-[11px] text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Info className="size-3.5 text-primary" /> Automatic Post-Ingestion Processing:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Counterparties (`smeId`, `buyerId`) not yet in database will be safely auto-registered in your organization.</li>
                    <li>Risk scores and cash-buffer metrics for all affected firms will be automatically recalculated.</li>
                    <li>Supply chain network graph topologies will update dynamically with the new exposure ties.</li>
                    <li>An immutable `ImportBatch` audit trail will be permanently recorded in PostgreSQL.</li>
                  </ul>
                </div>
              </div>

              {doImport.isPending && (
                <div className="space-y-2 py-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Persisting transactions & recalculating firm risks...</span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(3)} disabled={doImport.isPending} className="text-xs">
                  Back to Quality Report
                </Button>
                <Button
                  size="sm"
                  onClick={() => doImport.mutate()}
                  disabled={doImport.isPending}
                  className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4"
                >
                  {doImport.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
                  Confirm & Commit to PostgreSQL
                </Button>
              </div>
            </Card>
          )}

          {/* STAGE 5: VERIFIED PERSISTENCE & AUDIT CONFIRMATION */}
          {step === 5 && (
            <Card className="p-6 space-y-5 text-center">
              <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-7" />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">Ingestion Complete & Provenance Verified</h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {imported} transactions have been successfully ingested into PostgreSQL under organization{" "}
                  <span className="font-semibold text-foreground">{user?.organizationName}</span>.
                </p>
              </div>

              {batchId && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/70 bg-muted/30 font-mono text-xs text-muted-foreground">
                  <span>Batch ID:</span>
                  <span className="text-foreground font-semibold">{batchId}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <Button size="sm" onClick={() => navigate({ to: "/app/transactions" })} className="text-xs gap-1.5">
                  View Transactions Ledger <ArrowRight className="size-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/network" })} className="text-xs gap-1.5">
                  View Network Graph
                </Button>
                <Button variant="ghost" size="sm" onClick={reset} className="text-xs gap-1.5">
                  <RotateCcw className="size-3.5" /> Ingest Another File
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
