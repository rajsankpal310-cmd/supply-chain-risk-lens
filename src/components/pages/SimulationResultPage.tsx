import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function SimulationResultPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Simulation result" description="Cascade impact of a single scenario run." />
      <EmptyState
        title="This module is being wired up"
        description="The simulation result module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
