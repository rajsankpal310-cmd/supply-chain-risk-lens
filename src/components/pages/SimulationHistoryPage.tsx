import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, History, Plus, RefreshCw } from "lucide-react";
import { RiskBadge, StatusBadge } from "@/components/common/badges";
import { DataTable, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, LoadingSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { simulationService } from "@/services/simulationServices";
import type { SimulationRun } from "@/types";
import { formatDate, formatINR } from "@/utils/format";

export function SimulationHistoryPage({
  embedded = false,
  onRunNew,
}: {
  embedded?: boolean;
  onRunNew?: () => void;
} = {}) {
  const navigate = useNavigate();
  const simQuery = useQuery({ queryKey: ["simulations"], queryFn: simulationService.getSimulations });

  if (simQuery.isLoading) return <LoadingSkeleton rows={6} />;

  const runs = simQuery.data ?? [];

  const columns: Column<SimulationRun>[] = [
    { key: "id", header: "Run ID", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: "scenario", header: "Scenario Name", render: (r) => <span className="font-medium">{r.scenario.name}</span> },
    { key: "startedAt", header: "Executed Date", render: (r) => <span className="font-mono text-xs">{formatDate(r.startedAt)}</span> },
    { key: "status", header: "Status", render: (r) => <span className="bg-risk-low/15 text-risk-low rounded px-1.5 py-0.5 text-xs font-semibold">{r.status}</span> },
    { key: "affectedFirm", header: "Root Firm", render: (r) => <span className="font-mono text-xs">{r.scenario.affectedFirmId}</span> },
    { key: "cascadeRisk", header: "Cascade Risk", align: "right", render: (r) => <span className="font-mono font-semibold">{r.result.cascadeProbability}%</span> },
    { key: "expectedLoss", header: "Expected Loss", align: "right", render: (r) => <span className="font-mono">{formatINR(r.result.expectedLoss)}</span> },
    { key: "maxImpact", header: "Max Impact", align: "right", render: (r) => <span className="font-mono text-xs text-muted-foreground">{formatINR(r.result.maximumImpact)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button variant="ghost" size="icon" aria-label="View Result Details" onClick={() => navigate({ to: "/app/simulations/$id", params: { id: r.id } })}>
          <Eye className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Simulation Execution History"
          description="Historical log of executed financial shock scenarios, cascade impact calculations, and recovery timelines."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => simQuery.refetch()} disabled={simQuery.isFetching}>
                <RefreshCw className={simQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
                Refresh
              </Button>
              <Button onClick={() => onRunNew ? onRunNew() : navigate({ to: "/app/simulator" })} className="gap-2">
                <Plus className="size-4" /> Run New Scenario
              </Button>
            </div>
          }
        />
      )}

      {runs.length === 0 ? (
        <EmptyState
          title="No simulation history found"
          description="Execute your first scenario simulation in the Scenario Simulator."
          actionLabel="Go to Scenario Simulator"
          onAction={() => navigate({ to: "/app/simulator" })}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={runs}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate({ to: "/app/simulations/$id", params: { id: r.id } })}
        />
      )}
    </div>
  );
}
