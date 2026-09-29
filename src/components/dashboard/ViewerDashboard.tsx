import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Network,
  RefreshCw,
  ShieldCheck,
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
import { RiskBadge } from "@/components/common/badges";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Alert, DashboardSummary, User } from "@/types";
import { downloadFile, formatINR, toCsv } from "@/utils/format";

export function ViewerDashboard({
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
  const exec = data.executiveSummary;
  const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").slice(0, 5);

  const statusColor =
    exec?.portfolioHealthStatus === "RESILIENT"
      ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
      : exec?.portfolioHealthStatus === "MODERATE_RISK"
      ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
      : "text-destructive border-destructive/30 bg-destructive/10";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Portfolio Health Monitor"
        description="Executive-level visibility into aggregate supply chain risk, liquidity stability, and portfolio health indicators."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onRefresh} disabled={isFetching}>
              <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadFile(
                  "executive-portfolio-briefing.csv",
                  toCsv(data.kpis.map((k) => ({ indicator: k.label, value: k.value, status: k.status }))),
                  "text/csv",
                );
                toast.success("Executive briefing exported");
              }}
            >
              <Download className="size-4" aria-hidden /> Export Briefing
            </Button>
          </div>
        }
      />

      {/* Executive Portfolio Health Status Banner */}
      <Card className="p-5 border-border/80 bg-card/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-foreground">Portfolio Resilience Index</h3>
              <Badge variant="outline" className={`font-mono text-xs uppercase font-semibold ${statusColor}`}>
                {exec?.portfolioHealthStatus?.replace("_", " ") ?? "STABLE"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Across <span className="font-semibold text-foreground">{exec?.totalFirmsCount ?? 20} connected enterprises</span> in active supply chains.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs divide-x divide-border pt-2 md:pt-0">
          <div className="text-left md:text-right pr-6">
            <span className="text-muted-foreground block text-[11px]">Systemic Resilience</span>
            <span className="font-mono font-bold text-lg text-primary">{exec?.resilienceIndex ?? 72}%</span>
          </div>
          <div className="text-left md:text-right pl-6">
            <span className="text-muted-foreground block text-[11px]">Ready Reports</span>
            <span className="font-mono font-bold text-lg text-foreground">{exec?.reportsCount ?? 3} Packs</span>
          </div>
        </div>
      </Card>

      {/* Read-Only Notice */}
      <div className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-primary" />
          <span>Viewing in <span className="font-semibold text-foreground">Executive Read-Only</span> mode. Financial records are strictly verified from primary ledgers.</span>
        </div>
        <Badge variant="secondary" className="font-mono text-[10px]">
          VIEWER ACCESS
        </Badge>
      </div>

      {/* High-Level KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.kpis.map((k) => (
          <MetricCard key={k.key} label={k.label} value={k.value} trend={k.trend} trendLabel={k.trendLabel} status={k.status} tooltip={k.tooltip} />
        ))}
      </section>

      {/* Two Core Executive Trends */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Average settlement delay"
          description="Portfolio-wide delay trend over time"
          tooltip="Average days between invoice due date and settlement across counterparties."
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

        <ChartCard title="Total outstanding receivables" description="Working capital exposure over time" tooltip="Aggregated unsettled receivables in portfolio.">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.outstandingTrend}>
              <defs>
                <linearGradient id="outstandingFillViewer" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} width={52} tickFormatter={(v: number) => formatINR(v)} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => formatINR(v)} />
              <Area type="monotone" dataKey="amount" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#outstandingFillViewer)" name="Outstanding" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Executive Monitoring Section: Critical Alerts & Reports Summary */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Active Alerts List (Read-Only) */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="size-4 text-risk-high" />
              Active Monitored Alerts ({criticalAlerts.length})
            </h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/alerts">
                View All <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {criticalAlerts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No high or critical alerts active in the portfolio.</p>
            ) : (
              criticalAlerts.map((a) => (
                <div key={a.id} className="rounded-lg border border-border/70 p-3 bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{a.title}</p>
                    <RiskBadge level={a.severity} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{a.reason}</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1 italic">Impact: {a.impact}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Executive Reports Library */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Published Financial Reports
            </h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/reports">
                All Reports <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="space-y-2.5">
            <div className="rounded-lg border border-border/70 p-3 bg-muted/20 flex items-center justify-between">
              <div>
                <p className="font-medium text-xs text-foreground">Risk Summary Dossier</p>
                <p className="text-[11px] text-muted-foreground">Portfolio scores, drivers, and month-on-month movement</p>
              </div>
              <Badge variant="secondary" className="text-[10px] text-emerald-500">Ready</Badge>
            </div>

            <div className="rounded-lg border border-border/70 p-3 bg-muted/20 flex items-center justify-between">
              <div>
                <p className="font-medium text-xs text-foreground">Transaction & Ageing Analysis</p>
                <p className="text-[11px] text-muted-foreground">Invoice volumes, ageing buckets and settlement behaviour</p>
              </div>
              <Badge variant="secondary" className="text-[10px] text-emerald-500">Ready</Badge>
            </div>

            <div className="rounded-lg border border-border/70 p-3 bg-muted/20 flex items-center justify-between">
              <div>
                <p className="font-medium text-xs text-foreground">Supply Chain Contagion Briefing</p>
                <p className="text-[11px] text-muted-foreground">Network exposure, dependency hotspots and systemic hubs</p>
              </div>
              <Badge variant="secondary" className="text-[10px] text-emerald-500">Ready</Badge>
            </div>
          </div>

          <div className="pt-2">
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={() => navigate({ to: "/app/reports" })}>
              <BarChart3 className="size-3.5" /> Access Reports Library
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
