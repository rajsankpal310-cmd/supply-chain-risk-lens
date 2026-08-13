import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Download, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { RiskBadge } from "@/components/common/badges";
import { DataTable, type Column } from "@/components/common/DataTable";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { CardsSkeleton, ErrorState } from "@/components/common/states";
import { ChartCard, RISK_COLORS, axisProps, tooltipStyle } from "@/components/charts/ChartCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dashboardService } from "@/services/analyticsServices";
import { alertService } from "@/services/decisionServices";
import type { TopFirmRow } from "@/types";
import { downloadFile, formatINR, toCsv } from "@/utils/format";

export function DashboardPage() {
  const summary = useQuery({ queryKey: ["dashboard"], queryFn: dashboardService.getSummary });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: alertService.getAlerts });

  if (summary.isLoading) return <CardsSkeleton count={6} />;
  if (summary.isError || !summary.data)
    return <ErrorState title="Could not load the dashboard" description="Something went wrong while computing risk metrics." onRetry={() => summary.refetch()} />;

  const data = summary.data;
  const criticalAlerts = (alerts.data ?? []).filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").slice(0, 4);

  const firmColumns: Column<TopFirmRow>[] = [
    {
      key: "name",
      header: "Firm",
      render: (r) => (
        <Link to="/app/firms/$id" params={{ id: r.firmId }} className="hover:text-primary font-medium">
          {r.name}
        </Link>
      ),
    },
    { key: "transactions", header: "Txns", align: "right", render: (r) => <span className="font-mono">{r.transactions}</span> },
    { key: "avgDelay", header: "Avg delay", align: "right", render: (r) => <span className="font-mono">{r.avgDelay}d</span> },
    { key: "outstanding", header: "Outstanding", align: "right", render: (r) => <span className="font-mono">{formatINR(r.outstanding)}</span> },
    { key: "risk", header: "Risk", align: "right", render: (r) => <RiskBadge level={r.riskLevel} score={r.riskScore} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Overview"
        description="A consolidated view of payment behaviour, financial stress and supply-chain exposure across your connected firms."
        actions={
          <>
            <Button variant="outline" onClick={() => summary.refetch()} disabled={summary.isFetching}>
              <RefreshCw className={summary.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadFile(
                  "nexus-cfr-dashboard.csv",
                  toCsv(data.kpis.map((k) => ({ metric: k.label, value: k.value, trend: k.trend }))),
                  "text/csv",
                );
                toast.success("Dashboard summary exported");
              }}
            >
              <Download className="size-4" aria-hidden />
              Export
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.kpis.map((k) => (
          <MetricCard key={k.key} label={k.label} value={k.value} trend={k.trend} trendLabel={k.trendLabel} status={k.status} tooltip={k.tooltip} />
        ))}
      </section>

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

        <ChartCard title="Outstanding amount" description="Unsettled receivables over time" tooltip="Total open invoice value at each month end.">
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

        <ChartCard title="Risk distribution" description="Connected firms by risk band">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.riskDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="level" {...axisProps} />
              <YAxis {...axisProps} width={28} allowDecimals={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.35 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Firms">
                {data.riskDistribution.map((d) => (
                  <Cell key={d.level} fill={RISK_COLORS[d.level]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Financial stress trend" description="Working-capital pressure index" tooltip="Higher values indicate tighter liquidity.">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.stressTrend}>
              <defs>
                <linearGradient id="stressFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-risk-high)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-risk-high)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} width={30} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="stress" stroke="var(--color-risk-high)" strokeWidth={2} fill="url(#stressFill)" name="Stress index" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Top risky buyers</h2>
            <DataTable columns={firmColumns} rows={data.topRiskyBuyers} rowKey={(r) => r.firmId} />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Top risky suppliers</h2>
            <DataTable columns={firmColumns} rows={data.topRiskySuppliers} rowKey={(r) => r.firmId} />
          </div>
        </div>

        <Card className="gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="text-risk-high size-4" aria-hidden />
              Critical alerts
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/alerts">
                All <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
          {criticalAlerts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No critical alerts right now.</p>
          ) : (
            <ul className="space-y-3">
              {criticalAlerts.map((a) => (
                <li key={a.id} className="border-border/70 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    <RiskBadge level={a.severity} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">{a.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
