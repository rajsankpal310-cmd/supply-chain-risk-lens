import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Activity, ArrowLeft, History, Lightbulb, Network, Play, RefreshCw } from "lucide-react";
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
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, LoadingSkeleton } from "@/components/common/states";
import { ChartCard, axisProps, tooltipStyle } from "@/components/charts/ChartCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { simulationService } from "@/services/simulationServices";
import { formatDate, formatINR } from "@/utils/format";

export function SimulationResultPage() {
  const { id } = useParams({ from: "/app/simulations/$id" });
  const navigate = useNavigate();

  const simQuery = useQuery({
    queryKey: ["simulation", id],
    queryFn: () => simulationService.getSimulationById(id),
  });

  if (simQuery.isLoading) return <LoadingSkeleton rows={8} />;

  const run = simQuery.data;
  if (!run) {
    return (
      <EmptyState
        title="Simulation run not found"
        description={`No simulation run matches the reference ${id}.`}
        actionLabel="Back to Simulation History"
        onAction={() => navigate({ to: "/app/simulations" })}
      />
    );
  }

  const { scenario, result } = run;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/simulations">
          <ArrowLeft className="size-4" aria-hidden />
          Back to Simulation History
        </Link>
      </Button>

      <PageHeader
        title={`Simulation Run ${run.id} — ${scenario.name}`}
        description={`Executed ${formatDate(run.startedAt)} · Root Firm: ${scenario.affectedFirmId}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/simulator" })} className="gap-2">
              <Play className="size-3.5" /> Run Again
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/network" })} className="gap-2">
              <Network className="size-3.5" /> View Network
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/recommendations" })} className="gap-2">
              <Lightbulb className="size-3.5" /> Recommendations
            </Button>
          </div>
        }
      />

      {/* Overview Metric Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Cascade Probability" value={`${result.cascadeProbability}%`} status="CRITICAL" tooltip="Modeled contagion spread risk" />
        <MetricCard label="Expected Loss" value={formatINR(result.expectedLoss)} status="HIGH" tooltip="Total expected financial loss" />
        <MetricCard label="Maximum Impact" value={formatINR(result.maximumImpact)} status="HIGH" tooltip="Upper bound financial impact" />
        <MetricCard label="Recovery Duration" value={`${result.recoveryDays} days`} status="MEDIUM" tooltip="Estimated time for network recovery" />
      </section>

      {/* Scenario Config & Timeline Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 space-y-4 lg:col-span-1">
          <h3 className="text-sm font-semibold border-b pb-2">Scenario Parameters</h3>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between"><dt className="text-muted-foreground">Type:</dt><dd className="font-semibold">{scenario.type.replace(/_/g, " ")}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Severity:</dt><dd><RiskBadge level={scenario.severity} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Payment Delay:</dt><dd className="font-mono">{scenario.delayDays} days</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Exposure Amount:</dt><dd className="font-mono">{formatINR(scenario.amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Duration:</dt><dd className="font-mono">{scenario.durationDays} days</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Recovery Rate:</dt><dd className="font-mono">{scenario.recoveryRate}%</dd></div>
          </dl>
        </Card>

        <ChartCard title="Impact Timeline" description="Monetary loss progression over time" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={result.timeline}>
              <defs>
                <linearGradient id="simLossFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-risk-high)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-risk-high)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" {...axisProps} tickFormatter={(d) => `Day ${d}`} />
              <YAxis {...axisProps} width={50} tickFormatter={(v) => formatINR(v)} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => formatINR(v)} />
              <Area type="monotone" dataKey="loss" stroke="var(--color-risk-high)" strokeWidth={2} fill="url(#simLossFill)" name="Loss" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Affected Firms Table */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold">Affected Network Firms ({result.affectedFirms.length})</h3>
        <div className="border-border/70 overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hop Step</TableHead>
                <TableHead>Firm Name</TableHead>
                <TableHead className="text-right">Risk Score Before</TableHead>
                <TableHead className="text-right">Risk Score After</TableHead>
                <TableHead className="text-right">Modelled Loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.affectedFirms.map((f) => (
                <TableRow key={f.firmId}>
                  <TableCell className="font-mono text-xs">Hop {f.step}</TableCell>
                  <TableCell className="font-medium">
                    <Link to="/app/firms/$id" params={{ id: f.firmId }} className="hover:text-primary">
                      {f.firmName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{f.riskBefore}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold text-risk-high">{f.riskAfter}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatINR(f.loss)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
