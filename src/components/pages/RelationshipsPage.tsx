import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function RelationshipsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Relationships" description="Buyer-supplier links, dependency levels and criticality." />
      <EmptyState
        title="This module is being wired up"
        description="The relationships module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
