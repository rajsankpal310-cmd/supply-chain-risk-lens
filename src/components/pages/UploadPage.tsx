import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { EXPECTED_COLUMNS, transactionService, uploadService } from "@/services/dataServices";
import type { ValidationSummary } from "@/types";
import { downloadFile } from "@/utils/format";

const STEPS = ["Upload file", "Map columns", "Validate", "Import"] as const;
const MAX_MB = 10;

export function UploadPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState<number | null>(null);

  const parse = useMutation({
    mutationFn: (f: File) => uploadService.parseFile(f),
    onSuccess: (data) => {
      setParsed(data);
      const auto: Record<string, string> = {};
      for (const col of EXPECTED_COLUMNS) {
        const norm = col.replace(/_/g, "");
        const match = data.headers.find((h) => h.toLowerCase().replace(/[^a-z]/g, "").includes(norm.slice(0, 7)));
        if (match) auto[col] = match;
      }
      setMapping(auto);
      setStep(1);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });

  const validate = useMutation({
    mutationFn: () => uploadService.validate(parsed!.rows, mapping),
    onSuccess: (data) => {
      setSummary(data);
      setStep(2);
    },
    onError: () => toast.error("Validation failed"),
  });

  const doImport = useMutation({
    mutationFn: async () => {
      setProgress(0);
      for (let p = 10; p <= 90; p += 20) {
        await new Promise((r) => setTimeout(r, 220));
        setProgress(p);
      }
      const res = await transactionService.importTransactions(summary?.validRows ?? 0);
      setProgress(100);
      return res;
    },
    onSuccess: (res) => {
      setImported(res.imported);
      setStep(3);
      toast.success(`${res.imported} transactions imported`);
    },
    onError: () => toast.error("Import failed"),
  });

  if (!can("data:upload")) {
    return (
      <EmptyState
        title="You don't have upload access"
        description="Your current role can view analysis but cannot import transaction data. Switch to the SME Admin demo role to try importing."
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
    parse.mutate(f);
  }

  function reset() {
    setStep(0);
    setFile(null);
    setParsed(null);
    setMapping({});
    setSummary(null);
    setImported(null);
    setProgress(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload transaction data"
        description="Import invoices from CSV or Excel. Columns are mapped and validated before anything is added to your dataset."
        actions={
          <Button variant="outline" onClick={() => downloadFile("nexus-cfr-template.csv", uploadService.sampleTemplateCsv(), "text/csv")}>
            <Download className="size-4" aria-hidden />
            Download template
          </Button>
        }
      />

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              i === step ? "border-primary bg-primary/10 text-primary" : i < step ? "border-border text-muted-foreground" : "border-border/60 text-muted-foreground/60"
            }`}
          >
            <span className="font-mono text-xs">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card className="p-6">
          <div
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
            className={`grid place-items-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <UploadCloud className="text-muted-foreground size-10" aria-hidden />
            <p className="mt-4 text-sm font-medium">Drag and drop your file here</p>
            <p className="text-muted-foreground mt-1 text-xs">CSV, XLSX or XLS · up to {MAX_MB} MB</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={(e) => handleFiles(e.target.files)}
              aria-label="Choose a transaction file"
            />
            <Button className="mt-5" onClick={() => inputRef.current?.click()} disabled={parse.isPending}>
              {parse.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {parse.isPending ? "Reading file…" : "Browse files"}
            </Button>
          </div>

          <div className="text-muted-foreground mt-6 grid gap-2 text-xs sm:grid-cols-2">
            <p>Required columns: transaction id, sme id, buyer id, invoice amount, invoice date, due date, payment status.</p>
            <p>Optional columns: supplier id, payment date, credit period, outstanding amount.</p>
          </div>
        </Card>
      )}

      {step === 1 && parsed && (
        <Card className="gap-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="text-primary size-4" aria-hidden />
              <span className="font-medium">{file?.name}</span>
              <span className="text-muted-foreground">· {parsed.rows.length} rows</span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="size-4" aria-hidden />
              Change file
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {EXPECTED_COLUMNS.map((col) => (
              <div key={col}>
                <Label htmlFor={`map-${col}`} className="text-muted-foreground mb-1 block text-xs">
                  {col.replace(/_/g, " ")}
                </Label>
                <Select value={mapping[col] ?? "__none"} onValueChange={(v) => setMapping((m) => ({ ...m, [col]: v === "__none" ? "" : v }))}>
                  <SelectTrigger id={`map-${col}`}>
                    <SelectValue placeholder="Not mapped" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not mapped</SelectItem>
                    {parsed.headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Preview (first 5 rows)</h3>
            <div className="border-border/70 overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {parsed.headers.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.rows.slice(0, 5).map((r, i) => (
                    <TableRow key={i}>
                      {parsed.headers.map((h) => (
                        <TableCell key={h} className="text-muted-foreground whitespace-nowrap">
                          {r[h]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={() => validate.mutate()} disabled={validate.isPending}>
              {validate.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Validate data
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && summary && (
        <Card className="gap-5 p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total rows" value={summary.totalRows} />
            <Stat label="Valid rows" value={summary.validRows} tone="good" />
            <Stat label="Rows with errors" value={summary.invalidRows} tone="bad" />
            <Stat label="Duplicates" value={summary.duplicates} tone={summary.duplicates ? "bad" : undefined} />
          </div>

          {summary.invalidRows > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="text-risk-high size-4" aria-hidden />
                Rows needing attention
              </h3>
              <ul className="border-border/70 divide-border/70 max-h-64 divide-y overflow-y-auto rounded-xl border">
                {summary.rows
                  .filter((r) => !r.valid)
                  .slice(0, 20)
                  .map((r, i) => (
                    <li key={i} className="px-4 py-2.5 text-sm">
                      <span className="font-mono text-xs">{Object.values(r.raw)[0]}</span>
                      <span className="text-risk-high ml-2 text-xs">{r.errors.join(" · ")}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back to mapping
            </Button>
            <Button onClick={() => doImport.mutate()} disabled={summary.validRows === 0 || doImport.isPending}>
              {doImport.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Import {summary.validRows} valid rows
            </Button>
          </div>

          {doImport.isPending && <Progress value={progress} className="mt-2" />}
        </Card>
      )}

      {step === 3 && (
        <Card className="items-center gap-4 p-10 text-center">
          <CheckCircle2 className="text-risk-low mx-auto size-12" aria-hidden />
          <h2 className="text-lg font-semibold">{imported} transactions imported</h2>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            Risk scores and predictions have been recalculated on the demo dataset. Review the impact on your dashboard or explore the imported
            invoices.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate({ to: "/app/dashboard" })}>View dashboard</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/app/transactions" })}>
              View transactions
            </Button>
            <Button variant="ghost" onClick={reset}>
              Upload another file
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" | undefined }) {
  return (
    <div className="border-border/70 rounded-xl border p-4">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold ${tone === "good" ? "text-risk-low" : tone === "bad" ? "text-risk-high" : ""}`}>{value}</p>
    </div>
  );
}
