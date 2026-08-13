import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function SimulationHistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Simulation history" description="Previously executed scenarios." />
      <EmptyState
        title="This module is being wired up"
        description="The simulation history module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
