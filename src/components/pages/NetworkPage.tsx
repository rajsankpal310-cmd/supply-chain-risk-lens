import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function NetworkPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Supply chain network" description="Interactive graph of firms and exposure." />
      <EmptyState
        title="This module is being wired up"
        description="The supply chain network module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
