import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  Gauge,
  Lightbulb,
  Network,
  ShieldAlert,
  Table2,
  TrendingUp,
} from "lucide-react";
import { ProvenanceBadge, RiskBadge, StatusBadge } from "@/components/common/badges";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, LoadingSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { firmService } from "@/services/dataServices";
import { predictionService, riskService } from "@/services/analyticsServices";
import { recommendationService } from "@/services/decisionServices";
import { formatDate, formatINR } from "@/utils/format";

export function FirmDetailPage() {
  const { id } = useParams({ from: "/app/firms/$id" });
  const navigate = useNavigate();

  const firmQuery = useQuery({ queryKey: ["firm", id], queryFn: () => firmService.getFirmById(id) });
  const riskQuery = useQuery({ queryKey: ["firm-risk", id], queryFn: () => riskService.getFirmRisk(id) });
  const txnsQuery = useQuery({ queryKey: ["firm-txns", id], queryFn: () => firmService.getFirmTransactions(id) });
  const relsQuery = useQuery({ queryKey: ["firm-rels", id], queryFn: () => firmService.getFirmRelationships(id) });
  const predsQuery = useQuery({ queryKey: ["firm-preds", id], queryFn: () => predictionService.getPredictionsForFirm(id) });
  const recsQuery = useQuery({ queryKey: ["firm-recs", id], queryFn: () => recommendationService.getForFirm(id) });

  if (firmQuery.isLoading) return <LoadingSkeleton rows={8} />;

  const firm = firmQuery.data;
  if (!firm) {
    return (
      <EmptyState
        title="Firm not found"
        description={`No firm record exists for ID ${id}.`}
        actionLabel="Back to Firms Directory"
        onAction={() => navigate({ to: "/app/firms" })}
      />
    );
  }

  const risk = riskQuery.data;
  const txns = txnsQuery.data ?? [];
  const rels = relsQuery.data ?? [];
  const preds = predsQuery.data ?? [];
  const recs = recsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/firms">
          <ArrowLeft className="size-4" aria-hidden />
          Back to Firms Directory
        </Link>
      </Button>

      <PageHeader
        title={firm.name}
        description={`${firm.industry} · ${firm.city} · Role: ${firm.role.replace("_", " ")}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProvenanceBadge sourceType={(firm as any).sourceType} dataStatus={(firm as any).dataStatus} />
            <RiskBadge level={firm.riskLevel} score={firm.riskScore} />
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/simulator" })}>
              <Activity className="size-3.5" aria-hidden /> Run Scenario
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/network", search: { firmId: firm.id } as any })}>
              <Network className="size-3.5" aria-hidden /> View in Network
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Overall Risk Score" value={`${firm.riskScore}/100`} status={firm.riskLevel} tooltip="Composite risk score" />
        <MetricCard label="Financial Stress" value={`${firm.financialStress}%`} status={firm.financialStress > 70 ? "HIGH" : "MEDIUM"} tooltip="Working capital stress index" />
        <MetricCard label="Avg Payment Delay" value={`${firm.avgPaymentDelayDays} days`} status={firm.avgPaymentDelayDays > 30 ? "HIGH" : "LOW"} tooltip="Average settlement delay" />
        <MetricCard label="Outstanding Receivables" value={formatINR(firm.outstandingAmount)} status="MEDIUM" tooltip="Total unsettled invoice amount" />
        <MetricCard label="Cash Buffer" value={`${firm.cashBufferDays} days`} status={firm.cashBufferDays < 20 ? "CRITICAL" : "LOW"} tooltip="Operating cash runway" />
        <MetricCard label="Annual Turnover" value={formatINR(firm.annualTurnover)} status="LOW" tooltip="Reported annual turnover" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Risk Factors & Drivers */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="text-primary size-4" aria-hidden />
              Risk Drivers & Breakdown
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">Primary factors contributing to this firm's financial risk rating.</p>
            {risk?.drivers && risk.drivers.length > 0 ? (
              <div className="mt-4 space-y-3">
                {risk.drivers.map((d, i) => (
                  <div key={i} className="border-border/70 flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{d.label}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{d.description}</p>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs font-semibold ${d.direction === "INCREASES" ? "bg-risk-high/15 text-risk-high" : "bg-risk-low/15 text-risk-low"}`}>
                      {d.direction === "INCREASES" ? `+${d.weight}% risk` : `-${d.weight}% risk`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground mt-3 text-xs">No active risk drivers recorded.</p>
            )}
          </Card>

          {/* Connected Relationships */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Network className="text-primary size-4" aria-hidden />
              Supply Chain Relationships ({rels.length})
            </h2>
            {rels.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">No direct relationships found for this firm.</p>
            ) : (
              <ul className="divide-border/70 mt-3 divide-y">
                {rels.map((r) => {
                  const otherId = r.sourceFirmId === firm.id ? r.targetFirmId : r.sourceFirmId;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <Link to="/app/firms/$id" params={{ id: otherId }} className="hover:text-primary font-medium">
                          {otherId}
                        </Link>
                        <p className="text-muted-foreground text-xs">{r.type.replace("_", " ")} · Credit {r.creditPeriodDays}d</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs">{formatINR(r.avgTransactionValue)}</p>
                        <span className="text-muted-foreground text-[11px]">Dep. {r.dependencyLevel}%</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Recent Invoices */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Table2 className="text-primary size-4" aria-hidden />
                Recent Invoices ({txns.length})
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/transactions" })}>
                All Transactions
              </Button>
            </div>
            {txns.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">No transactions recorded for this firm.</p>
            ) : (
              <ul className="divide-border/70 mt-3 divide-y">
                {txns.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link to="/app/transactions/$id" params={{ id: t.id }} className="hover:text-primary font-mono text-xs">
                      {t.id}
                    </Link>
                    <span className="font-mono text-xs">{formatINR(t.invoiceAmount)}</span>
                    <StatusBadge status={t.paymentStatus} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          {/* Active Predictions */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="text-primary size-4" aria-hidden />
                Risk Predictions
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/predictions" })}>
                View All
              </Button>
            </div>
            {preds.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">No active predictions generated.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {preds.map((p) => (
                  <div key={p.id} className="border-border/70 rounded-lg border p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.type.replace("_", " ")}</span>
                      <RiskBadge level={p.riskLevel} />
                    </div>
                    <p className="mt-1 font-mono text-sm font-semibold">{p.probability}% Probability</p>
                    <p className="text-muted-foreground mt-1">Confidence: {p.confidence}%</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Decision Support Recommendations */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="text-primary size-4" aria-hidden />
                Recommendations
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/recommendations" })}>
                View All
              </Button>
            </div>
            {recs.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">No specific recommendations pending.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {recs.map((r) => (
                  <div key={r.id} className="border-border/70 rounded-lg border p-3 text-xs">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-muted-foreground mt-1">{r.reason}</p>
                    <p className="text-primary mt-1 font-mono">{formatINR(r.estimatedRequirement)} required</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Action Navigation Toolbar */}
          <Card className="space-y-2 p-4">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Actions</p>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate({ to: "/app/transactions" })}>
              <CreditCard className="size-4" /> View Transactions
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate({ to: "/app/network" })}>
              <Network className="size-4" /> Analyze Network Position
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate({ to: "/app/simulator" })}>
              <Activity className="size-4" /> Simulate Financial Shock
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate({ to: "/app/recommendations" })}>
              <Lightbulb className="size-4" /> View Decision Recommendations
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
