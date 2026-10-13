import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Gauge, Info, RefreshCw, ShieldAlert, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RiskBadge } from "@/components/common/badges";
import { DataTable, type Column } from "@/components/common/DataTable";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { CardsSkeleton, ErrorState } from "@/components/common/states";
import { ChartCard, axisProps, tooltipStyle } from "@/components/charts/ChartCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dashboardService, riskService } from "@/services/analyticsServices";
import type { TopFirmRow } from "@/types";
import { formatINR } from "@/utils/format";

export function RiskPage() {
  const overviewQuery = useQuery({ queryKey: ["risk-overview"], queryFn: riskService.getOverview });
  const summaryQuery = useQuery({ queryKey: ["dashboard-summary"], queryFn: dashboardService.getSummary });

  if (overviewQuery.isLoading || summaryQuery.isLoading) return <CardsSkeleton count={6} />;
  if (overviewQuery.isError || !overviewQuery.data || !summaryQuery.data)
    return <ErrorState title="Could not load Risk Intelligence" description="Error computing overall risk parameters." onRetry={() => { overviewQuery.refetch(); summaryQuery.refetch(); }} />;

  const risk = overviewQuery.data;
  const summary = summaryQuery.data;
  const isEmptyOrg = Boolean(risk?.isEmpty || risk?.overall === null || (summary?.executiveSummary?.totalFirmsCount ?? 0) === 0);

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
    { key: "risk", header: "Risk Level", align: "right", render: (r) => <RiskBadge level={r.riskLevel} score={r.riskScore} /> },
  ];

  if (isEmptyOrg) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Risk Intelligence Overview"
          description="Comprehensive portfolio-level risk analysis, stress scoring, risk categories, and underlying risk drivers."
          showDemoBadge={false}
          actions={
            <Button variant="outline" onClick={() => { overviewQuery.refetch(); summaryQuery.refetch(); }}>
              <RefreshCw className={overviewQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
              Refresh Analysis
            </Button>
          }
        />

        {/* Empty Organization Onboarding Card */}
        <Card className="p-8 text-center max-w-2xl mx-auto space-y-4 border-dashed border-border/80">
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary mx-auto">
            <Gauge className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Waiting for Your Data</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
              Upload your company transaction data to generate portfolio risk analysis,
              counterparty delay probabilities, and supply-chain cascade scores.
            </p>
          </div>
          <div className="pt-1">
            <Button asChild size="sm">
              <Link to="/app/upload">Upload Company Data</Link>
            </Button>
          </div>
        </Card>

        {/* Empty Metric Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Overall Risk Score"
            value="—"
            status="LOW"
            tooltip="Portfolio-wide composite risk score will be computed once transaction data is uploaded"
          />
          <MetricCard
            label="Payment Risk"
            value="—"
            status="LOW"
            tooltip="Late settlement behaviour across buyers"
          />
          <MetricCard
            label="Financial Stress"
            value="—"
            status="LOW"
            tooltip="Working-capital pressure on SMEs"
          />
          <MetricCard
            label="Dependency Risk"
            value="—"
            status="LOW"
            tooltip="Concentration on key buyers or suppliers"
          />
        </section>

        {/* Empty Categories & Charts */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 flex flex-col justify-center items-center text-center py-12">
            <Gauge className="size-8 text-muted-foreground/40 mb-2" />
            <h4 className="text-xs font-semibold text-foreground">No Risk Categories Available</h4>
            <p className="text-[11px] text-muted-foreground max-w-xs mt-0.5">
              Category breakdowns for payment, stress, dependency, and cascade risk will appear after transactions are imported.
            </p>
          </Card>

          <Card className="p-5 flex flex-col justify-center items-center text-center py-12">
            <TrendingUp className="size-8 text-muted-foreground/40 mb-2" />
            <h4 className="text-xs font-semibold text-foreground">No Risk History Available Yet</h4>
            <p className="text-[11px] text-muted-foreground max-w-xs mt-0.5">
              Your historical risk trend will appear after sufficient company data is imported.
            </p>
          </Card>
        </section>

        {/* Empty Drivers */}
        <Card className="p-5 text-center py-10">
          <ShieldAlert className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <h4 className="text-xs font-semibold text-foreground">No Risk Drivers Detected Yet</h4>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto mt-0.5">
            Key contributing factors to your portfolio risk index will be calculated from uploaded transaction ledgers.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Intelligence Overview"
        description="Comprehensive portfolio-level risk analysis, stress scoring, risk categories, and underlying risk drivers."
        actions={
          <Button variant="outline" onClick={() => { overviewQuery.refetch(); summaryQuery.refetch(); }}>
            <RefreshCw className={overviewQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
            Refresh Analysis
          </Button>
        }
      />

      {/* Methodology Transparency Banner */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Info className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold text-foreground">
              Risk Calculation Methodology
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Portfolio metrics are derived from transaction ageing distributions, counterparty payment delay histories, and supply chain network exposure topology.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary text-xs shrink-0">
          Analytical Engine
        </Badge>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Overall Risk Score"
          value={`${risk.overall} / 100`}
          status={risk.level}
          tooltip="Portfolio-wide composite risk score derived from historical delays and exposure"
        />
        {risk.categories.slice(0, 3).map((cat) => (
          <MetricCard
            key={cat.key}
            label={cat.label}
            value={`${cat.score}%`}
            status={cat.score >= 75 ? "CRITICAL" : cat.score >= 60 ? "HIGH" : "MEDIUM"}
            tooltip={cat.description}
          />
        ))}
      </section>

      {/* Category Breakdown & Trend */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="text-primary size-4" />
            Risk Category Scores
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">Evaluated scores across core financial risk vectors.</p>
          <div className="mt-4 space-y-3">
            {risk.categories.map((c) => (
              <div key={c.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.label}</span>
                  <span className="font-mono font-semibold">{c.score}/100</span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className={`h-full ${c.score >= 75 ? "bg-risk-critical" : c.score >= 60 ? "bg-risk-high" : "bg-risk-medium"}`}
                    style={{ width: `${c.score}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-[11px]">{c.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <ChartCard title="Historical Risk Score Trend" description="Portfolio-level risk progression over the last 12 months">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={risk.trend}>
              <defs>
                <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-risk-high)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-risk-high)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} width={30} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="score" stroke="var(--color-risk-high)" strokeWidth={2} fill="url(#riskFill)" name="Risk Score" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Major Risk Drivers */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="text-primary size-4" />
          Primary Risk Drivers
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">Key factors contributing positively or negatively to the risk index.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {risk.drivers.map((d, i) => (
            <div key={i} className="border-border/70 flex flex-col justify-between rounded-lg border p-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{d.label}</p>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${d.direction === "INCREASES" ? "bg-risk-high/15 text-risk-high" : "bg-risk-low/15 text-risk-low"}`}>
                    {d.direction}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{d.description}</p>
              </div>
              <p className="mt-3 font-mono text-xs font-semibold text-right">Contribution: {d.weight}%</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Risky Buyers & Suppliers Tables */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Highest Risk Buyers</h2>
          <DataTable columns={firmColumns} rows={summary.topRiskyBuyers} rowKey={(r) => r.firmId} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Highest Risk Suppliers</h2>
          <DataTable columns={firmColumns} rows={summary.topRiskySuppliers} rowKey={(r) => r.firmId} />
        </div>
      </section>
    </div>
  );
}
