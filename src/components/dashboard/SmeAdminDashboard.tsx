import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Database,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Network,
  Plus,
  RefreshCw,
  TrendingUp,
  Upload,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { ChartCard, axisProps, tooltipStyle } from "@/components/charts/ChartCard";
import { RiskBadge, StatusBadge } from "@/components/common/badges";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { WidgetErrorBoundary } from "@/components/common/WidgetErrorBoundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Alert, DashboardSummary, User } from "@/types";
import { downloadFile, formatDate, formatINR, toCsv } from "@/utils/format";

export function SmeAdminDashboard({
  data,
  alerts,
  user,
  onRefresh,
  isFetching,
}: {
  data: DashboardSummary;
  alerts: Alert[];
  user: User | null;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  const navigate = useNavigate();
  const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").slice(0, 4);
  const overdueTxns = data.overdueTransactions ?? [];
  const batch = data.dataProvenanceSummary?.lastBatch;

  const isEmptySme = data.executiveSummary?.totalFirmsCount === 0;

  if (isEmptySme) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Risk & Portfolio Overview"
          description="Monitor receivables, cash-flow stress, payment delays and supply-chain exposure across your firm network."
        />

        <Card className="p-12 text-center max-w-2xl mx-auto space-y-4 border-dashed border-border/80">
          <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary mx-auto">
            <Upload className="size-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Upload Your Data to Begin Risk Analysis</h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
              No transactions or counterparties have been imported into this organization yet.
              Upload your transaction data (CSV, Excel, or JSON) to unlock risk scoring,
              payment delay predictions, and supply chain network mapping.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-3">
            <Button onClick={() => navigate({ to: "/app/upload" })} className="gap-2">
              <Upload className="size-4" /> Upload Data
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk & Portfolio Overview"
        description="Monitor receivables, cash-flow stress, payment delays and supply-chain exposure across your firm network."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onRefresh} disabled={isFetching}>
              <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadFile(
                  "sme-admin-portfolio-summary.csv",
                  toCsv(data.kpis.map((k) => ({ metric: k.label, value: k.value, trend: k.trend }))),
                  "text/csv",
                );
                toast.success("Operational summary exported");
              }}
            >
              <Download className="size-4" aria-hidden /> Export
            </Button>
            <Button onClick={() => navigate({ to: "/app/upload" })} className="gap-2">
              <Upload className="size-4" /> Import Ledger
            </Button>
          </div>
        }
      />


      {/* Operational Quick Action Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          className="p-3.5 flex items-center gap-3 cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-all"
          onClick={() => navigate({ to: "/app/upload" })}
        >
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Upload className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-foreground">Import Invoices</p>
            <p className="text-[11px] text-muted-foreground truncate">Batch CSV / ERP file</p>
          </div>
        </Card>

        <Card
          className="p-3.5 flex items-center gap-3 cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-all"
          onClick={() => navigate({ to: "/app/transactions" })}
        >
          <div className="grid size-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <Plus className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-foreground">Transactions</p>
            <p className="text-[11px] text-muted-foreground truncate">Review & settle ledger</p>
          </div>
        </Card>

        <Card
          className="p-3.5 flex items-center gap-3 cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-all"
          onClick={() => navigate({ to: "/app/network" })}
        >
          <div className="grid size-10 place-items-center rounded-lg bg-indigo-500/10 text-indigo-500">
            <Network className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-foreground">Topology Map</p>
            <p className="text-[11px] text-muted-foreground truncate">View exposure ties</p>
          </div>
        </Card>

        <Card
          className="p-3.5 flex items-center gap-3 cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-all"
          onClick={() => navigate({ to: "/app/reports" })}
        >
          <div className="grid size-10 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-foreground">Audit Reports</p>
            <p className="text-[11px] text-muted-foreground truncate">Download financial packs</p>
          </div>
        </Card>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {data.kpis.map((k) => (
          <MetricCard key={k.key} label={k.label} value={k.value} trend={k.trend} trendLabel={k.trendLabel} status={k.status} tooltip={k.tooltip} />
        ))}
      </section>

      {/* Operational Attention Grid: Overdue Receivables & Ingestion Provenance */}
      <WidgetErrorBoundary title="Operational Attention & Receivables Triage">
        <section className="grid gap-4 lg:grid-cols-3">
          {/* Overdue Collection Triage */}
          <Card className="p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="size-4 text-amber-500" />
                  Collection Triage — High Delay Receivables
                </h3>
                <p className="text-xs text-muted-foreground">Invoices requiring immediate working capital follow-up</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/app/transactions">
                  View all <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </Button>
            </div>

            {overdueTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No overdue invoices currently requiring collection follow-up.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Due Date</TableHead>
                      <TableHead className="text-right">Delay</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueTxns.map((t, idx) => (
                      <TableRow key={t.id || `overdue-${idx}`}>
                        <TableCell className="font-mono text-xs font-medium">{t.id || "—"}</TableCell>
                        <TableCell className="font-medium text-xs truncate max-w-40">{t.buyerName || "Counterparty"}</TableCell>
                        <TableCell className="font-mono text-xs text-right font-semibold">{formatINR(t.outstandingAmount)}</TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">{formatDate(t.dueDate)}</TableCell>
                        <TableCell className="font-mono text-xs text-right text-destructive font-semibold">{t.delayDays ?? 0}d</TableCell>
                        <TableCell className="text-right"><StatusBadge status={t.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Data Provenance & Ledger Health Card */}
          <Card className="p-5 space-y-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  Ingestion Health
                </h3>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {data.dataProvenanceSummary?.totalBatches ?? 0} Batches
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">PostgreSQL ledger audit and provenance records</p>
            </div>

            {batch ? (
              <div className="space-y-2.5 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latest Batch:</span>
                  <span className="font-mono font-medium">{batch.id ? `${batch.id.slice(0, 12)}…` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source Type:</span>
                  <span className="font-medium">{batch.sourceType ? batch.sourceType.replace(/_/g, " ") : "Primary Ingestion"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dataset Label:</span>
                  <span className="font-medium truncate max-w-36">{batch.sourceName || "Primary Ledger"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Records Ingested:</span>
                  <span className="font-mono font-semibold">{batch.recordCount ?? 0} rows</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Status:</span>
                  <Badge variant="secondary" className="text-[10px] font-medium text-emerald-500">
                    {batch.dataStatus || "ACTIVE"}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                <FileCheck className="size-6 mx-auto mb-1 text-muted-foreground" />
                Primary transactions actively verified in database.
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-2"
              onClick={() => navigate({ to: "/app/upload" })}
            >
              <FileSpreadsheet className="size-3.5" /> Ingestion Audit Trail
            </Button>
          </Card>
        </section>
      </WidgetErrorBoundary>

      {/* Charts Section */}
      <WidgetErrorBoundary title="Payment Delay & Outstanding Charts">
        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Payment delay trend"
            description="Average settlement delay in days"
            tooltip="Rolling monthly average of days between due date and actual payment."
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.paymentDelayTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis {...axisProps} width={32} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="delay" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} name="Avg delay (days)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Outstanding receivables" description="Unsettled ledger exposure over time" tooltip="Total open invoice value at each month end.">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.outstandingTrend}>
                <defs>
                  <linearGradient id="outstandingFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis {...axisProps} width={52} tickFormatter={(v: number) => formatINR(v)} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => formatINR(v)} />
                <Area type="monotone" dataKey="amount" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#outstandingFill)" name="Outstanding" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>
      </WidgetErrorBoundary>

      {/* Critical Alerts Bar */}
      {criticalAlerts.length > 0 && (
        <Card className="p-5 space-y-3 border-risk-high/40">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-4 text-risk-high" /> Active Risk Alerts ({criticalAlerts.length})
            </h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/alerts">Review all alerts <ArrowRight className="size-3.5 ml-1" /></Link>
            </Button>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            {criticalAlerts.map((a) => (
              <div key={a.id} className="rounded-lg border border-border/70 p-3 bg-card/60">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">{a.title}</p>
                  <RiskBadge level={a.severity} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{a.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
