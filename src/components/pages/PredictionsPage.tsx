import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Eye, Info, RefreshCw, Search, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { RiskBadge } from "@/components/common/badges";
import { DataTable, TablePagination, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, LoadingSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { predictionService } from "@/services/analyticsServices";
import type { Prediction, RiskLevel } from "@/types";
import { formatDate } from "@/utils/format";

import { MlControlCenter } from "@/components/ml/MlControlCenter";

const TYPES = ["ALL", "PAYMENT_DELAY", "FINANCIAL_STRESS"] as const;
const RISKS: (RiskLevel | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function PredictionsPage() {
  const [viewMode, setViewMode] = useState<"control_center" | "portfolio">("portfolio");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [risk, setRisk] = useState<RiskLevel | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<keyof Prediction>("probability");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedPred, setSelectedPred] = useState<Prediction | null>(null);
  const pageSize = 10;

  const predsQuery = useQuery({
    queryKey: ["predictions"],
    queryFn: predictionService.getPredictions,
    placeholderData: keepPreviousData,
  });

  const filteredPreds = useMemo(() => {
    if (!predsQuery.data) return [];
    const term = search.trim().toLowerCase();
    return predsQuery.data.filter((p) => {
      if (type !== "ALL" && p.type !== type) return false;
      if (risk !== "ALL" && p.riskLevel !== risk) return false;
      if (term) {
        if (!p.firmName.toLowerCase().includes(term) && !p.id.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [predsQuery.data, search, type, risk]);

  const sortedPreds = useMemo(() => {
    return [...filteredPreds].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredPreds, sortBy, sortDir]);

  const paginatedPreds = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedPreds.slice(start, start + pageSize);
  }, [sortedPreds, page, pageSize]);

  function toggleSort(key: string) {
    const k = key as keyof Prediction;
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(k);
      setSortDir("desc");
    }
  }

  function resetFilters() {
    setSearch("");
    setType("ALL");
    setRisk("ALL");
    setPage(1);
  }

  const columns: Column<Prediction>[] = [
    { key: "id", header: "ID", sortable: true, render: (p) => <span className="font-mono text-xs">{p.id}</span> },
    {
      key: "firmName",
      header: "Firm",
      sortable: true,
      render: (p) => (
        <Link to="/app/firms/$id" params={{ id: p.firmId }} className="hover:text-primary font-medium">
          {p.firmName}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Prediction Type",
      sortable: true,
      render: (p) => (
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${p.type === "PAYMENT_DELAY" ? "bg-amber-500/15 text-amber-600" : "bg-blue-500/15 text-blue-600"}`}>
          {p.type.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "probability",
      header: "Probability",
      sortable: true,
      align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          <div className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
            <div className={`h-full ${p.probability > 75 ? "bg-risk-critical" : p.probability > 50 ? "bg-risk-high" : "bg-primary"}`} style={{ width: `${p.probability}%` }} />
          </div>
          <span className="font-mono text-xs font-semibold">{p.probability}%</span>
        </div>
      ),
    },
    {
      key: "expectedDelayDays",
      header: "Expected Delay",
      sortable: true,
      align: "right",
      render: (p) => <span className="font-mono">{p.expectedDelayDays != null ? `${p.expectedDelayDays} days` : "N/A"}</span>,
    },
    { key: "confidence", header: "Confidence", sortable: true, align: "right", render: (p) => <span className="font-mono text-xs">{p.confidence}%</span> },
    { key: "predictedDate", header: "Target Date", sortable: true, render: (p) => <span className="font-mono text-xs">{p.predictedDate ? formatDate(p.predictedDate) : "—"}</span> },
    { key: "riskLevel", header: "Risk Level", sortable: true, align: "right", render: (p) => <RiskBadge level={p.riskLevel} /> },
    {
      key: "inferenceType" as any,
      header: "Risk Model",
      render: (p: any) => (
        <Badge
          variant="outline"
          className={
            p.inferenceType === "APPROVED_ML_MODEL"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium"
              : "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-medium"
          }
        >
          {p.inferenceType === "APPROVED_ML_MODEL" ? "Validated Model" : "Standard Model"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <Button variant="ghost" size="icon" aria-label="View Details" onClick={() => setSelectedPred(p)}>
          <Eye className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Predictions"
        description="Forecast payment delays and working-capital stress events across your counterparties."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => predsQuery.refetch()} disabled={predsQuery.isFetching}>
              <RefreshCw className={predsQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={viewMode === "portfolio" ? "default" : "outline"}
          size="sm"
          className="text-xs font-semibold"
          onClick={() => setViewMode("portfolio")}
        >
          Predicted Risk Ledger
        </Button>
        <Button
          variant={viewMode === "control_center" ? "default" : "outline"}
          size="sm"
          className="text-xs font-semibold"
          onClick={() => setViewMode("control_center")}
        >
          Advanced: ML & Governance Control Center
        </Button>
      </div>

      {viewMode === "control_center" && <MlControlCenter />}

      {viewMode === "portfolio" && (
        <>
          <Card className="gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="pred-search" className="text-muted-foreground mb-1 block text-xs">Search Firm</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                id="pred-search"
                placeholder="Search firm name or ID…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pred-type" className="text-muted-foreground mb-1 block text-xs">Prediction Type</Label>
            <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
              <SelectTrigger id="pred-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t === "ALL" ? "All types" : t.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pred-risk" className="text-muted-foreground mb-1 block text-xs">Risk Level</Label>
            <Select value={risk} onValueChange={(v) => { setRisk(v as RiskLevel | "ALL"); setPage(1); }}>
              <SelectTrigger id="pred-risk"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISKS.map((r) => (
                  <SelectItem key={r} value={r}>{r === "ALL" ? "All risk levels" : r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {predsQuery.isLoading ? (
        <LoadingSkeleton rows={10} />
      ) : sortedPreds.length === 0 ? (
        <EmptyState
          title="No predictions match criteria"
          description="Try broadening search or filters."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={paginatedPreds}
            rowKey={(p) => p.id}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={toggleSort}
          />
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={sortedPreds.length}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  )}

      {/* Prediction Detail Dialog */}
      <Dialog open={Boolean(selectedPred)} onOpenChange={(open) => !open && setSelectedPred(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="text-primary size-5" />
              Prediction Detail — {selectedPred?.firmName}
            </DialogTitle>
            <DialogDescription>Risk factors and time-horizon progression for this prediction.</DialogDescription>
          </DialogHeader>

          {selectedPred && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between border-b pb-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Prediction Type</p>
                  <p className="font-semibold">{selectedPred.type.replace("_", " ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Confidence Rating</p>
                  <p className="font-mono font-semibold">{selectedPred.confidence}%</p>
                </div>
                <RiskBadge level={selectedPred.riskLevel} />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold">Risk Horizon Progression</p>
                <div className="grid grid-cols-4 gap-2">
                  {selectedPred.horizon.map((h) => (
                    <div key={h.days} className="border-border/70 rounded-lg border p-2 text-center text-xs">
                      <p className="text-muted-foreground text-[10px]">{h.days} Days</p>
                      <p className="font-mono font-semibold text-sm">{h.risk}%</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold">Contributing Factors</p>
                <div className="space-y-2">
                  {selectedPred.factors.map((f, i) => (
                    <div key={i} className="border-border/70 flex items-center justify-between rounded-lg border p-2.5 text-xs">
                      <div>
                        <p className="font-medium">{f.label}</p>
                        <p className="text-muted-foreground text-[11px]">{f.description}</p>
                      </div>
                      <span className="font-mono font-semibold">+{f.weight}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progressive Disclosure: Technical Model Evidence */}
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[11px] text-muted-foreground">Model & Calibration Details</span>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedPred.inferenceType === "APPROVED_ML_MODEL" ? "Validated Model" : "Standard Rules"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Model Architecture</span>
                    <span className="font-mono text-foreground">Gradient Boosted Survival</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Evaluation Period</span>
                    <span className="font-mono text-foreground">Out-of-Time Validated</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 flex justify-between items-center">
                <Button variant="ghost" size="sm" onClick={() => setViewMode("control_center")} className="text-xs text-muted-foreground">
                  View Full ML Governance
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/app/firms/$id" params={{ id: selectedPred.firmId }}>
                    View Firm Profile
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
