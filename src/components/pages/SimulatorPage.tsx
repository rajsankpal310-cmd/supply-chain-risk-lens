import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function SimulatorPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Scenario simulator" description="Run what-if shocks across the network." />
      <EmptyState
        title="This module is being wired up"
        description="The scenario simulator module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
