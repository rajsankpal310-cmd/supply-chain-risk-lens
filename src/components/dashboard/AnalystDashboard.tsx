import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Download,
  GitBranch,
  Network,
  RefreshCw,
  Share2,
  Sliders,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { ChartCard, RISK_COLORS, axisProps, tooltipStyle } from "@/components/charts/ChartCard";
import { RiskBadge } from "@/components/common/badges";
import { DataTable, type Column } from "@/components/common/DataTable";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DashboardSummary, TopFirmRow, User } from "@/types";
import { downloadFile, formatDate, formatINR, toCsv } from "@/utils/format";

export function AnalystDashboard({
  data,
  user,
  onRefresh,
  isFetching,
}: {
  data: DashboardSummary;
  user: User | null;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  const navigate = useNavigate();
  const analytical = data.analyticalSummary;

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
        title="Risk & Contagion Analytics Workbench"
        description="Deep financial contagion modeling, cross-firm dependency mapping, deadlock detection and stress distribution."
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
                  "analyst-contagion-model.csv",
                  toCsv(data.riskDistribution.map((r) => ({ band: r.level, firmCount: r.count }))),
                  "text/csv",
                );
                toast.success("Analytical model exported");
              }}
            >
              <Download className="size-4" aria-hidden /> Export Model
            </Button>
            <Button onClick={() => navigate({ to: "/app/simulator" })} className="gap-2">
              <Activity className="size-4" /> Run Simulation
            </Button>
          </div>
        }
      />

      {/* Analyst Modeling Action Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          className="p-3.5 flex items-center gap-3 cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-all"
          onClick={() => navigate({ to: "/app/simulator" })}
        >
          <div className="grid size-10 place-items-center rounded-lg bg-red-500/10 text-red-500">
            <Activity className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-foreground">Scenario Shock</p>
            <p className="text-[11px] text-muted-foreground truncate">Run cascade simulator</p>
          </div>
        </Card>

        <Card
          className="p-3.5 flex items-center gap-3 cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-all"
          onClick={() => navigate({ to: "/app/optimization" })}
        >
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sliders className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-foreground">Capital Optimization</p>
            <p className="text-[11px] text-muted-foreground truncate">Solve budget allocation</p>
          </div>
        </Card>

        <Card
          className="p-3.5 flex items-center gap-3 cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-all"
          onClick={() => navigate({ to: "/app/deadlocks" })}
        >
          <div className="grid size-10 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
            <GitBranch className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-foreground">Deadlock Analysis</p>
            <p className="text-[11px] text-muted-foreground truncate">Resolve locked debt</p>
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
            <p className="font-semibold text-xs text-foreground">Network Contagion</p>
            <p className="text-[11px] text-muted-foreground truncate">Systemic risk graph</p>
          </div>
        </Card>
      </div>

      {/* Analytical KPI Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.kpis.map((k) => (
          <MetricCard key={k.key} label={k.label} value={k.value} trend={k.trend} trendLabel={k.trendLabel} status={k.status} tooltip={k.tooltip} />
        ))}
      </section>

      {/* Contagion & Deadlock Status Widgets */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Deadlock Detection Widget */}
        <Card className="p-5 space-y-3 border-amber-500/30 bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
                <GitBranch className="size-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">Circular Payment Deadlocks</h4>
                <p className="text-xs text-muted-foreground">Chained liquidity traps detected across suppliers</p>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-xs text-amber-500 border-amber-500/40">
              {analytical?.activeDeadlocksCount ?? 0} Active Chains
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="rounded border border-border/70 p-2.5 bg-muted/20">
              <span className="text-muted-foreground block text-[11px]">Locked Systemic Capital</span>
              <span className="font-mono font-bold text-base text-foreground">
                {formatINR(analytical?.totalLockedExposure ?? 0)}
              </span>
            </div>
            <div className="rounded border border-border/70 p-2.5 bg-muted/20">
              <span className="text-muted-foreground block text-[11px]">Status</span>
              <span className="font-semibold text-amber-500 block mt-0.5">
                {(analytical?.activeDeadlocksCount ?? 0) > 0 ? "Intervention Required" : "No Circular Locks"}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => navigate({ to: "/app/deadlocks" })}>
              Analyze Deadlock Chains <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </Card>

        {/* Shock Simulation Status Widget */}
        <Card className="p-5 space-y-3 border-primary/30 bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Activity className="size-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">Cascade Simulation Registry</h4>
                <p className="text-xs text-muted-foreground">Most recent what-if shock scenario execution</p>
              </div>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {analytical?.simulationsCount ?? 0} Executions
            </Badge>
          </div>

          {analytical?.latestSimulation ? (
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="rounded border border-border/70 p-2.5 bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Scenario Tested</span>
                <span className="font-semibold text-foreground truncate block">
                  {analytical.latestSimulation.scenarioName}
                </span>
              </div>
              <div className="rounded border border-border/70 p-2.5 bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Predicted Loss</span>
                <span className="font-mono font-semibold text-destructive">
                  {formatINR(analytical.latestSimulation.expectedLoss)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">No simulations recorded yet.</p>
          )}

          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => navigate({ to: "/app/simulations" })}>
              View Simulation Runs <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </Card>
      </section>

      {/* Analytical Charts Grid: Risk Distribution & Financial Stress */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Risk distribution by tier" description="Firms grouped by algorithmic risk band">
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

        <ChartCard title="Financial stress index" description="Liquidity pressure across connected SME tiers" tooltip="Working capital stress modeled from delay spread and cash buffer days.">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.stressTrend}>
              <defs>
                <linearGradient id="stressFillAnalyst" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-risk-high)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-risk-high)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} width={30} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="stress" stroke="var(--color-risk-high)" strokeWidth={2} fill="url(#stressFillAnalyst)" name="Stress index" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Exposure Analysis: Top Risky Buyers and Suppliers */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Top Risky Counterparties (Buyers)</h3>
            <span className="text-[11px] text-muted-foreground">Ranked by risk score</span>
          </div>
          <DataTable columns={firmColumns} rows={data.topRiskyBuyers} rowKey={(r) => r.firmId} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Top Risky Suppliers</h3>
            <span className="text-[11px] text-muted-foreground">Ranked by risk score</span>
          </div>
          <DataTable columns={firmColumns} rows={data.topRiskySuppliers} rowKey={(r) => r.firmId} />
        </div>
      </section>
    </div>
  );
}
