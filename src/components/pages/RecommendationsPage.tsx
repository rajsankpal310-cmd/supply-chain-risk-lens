import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Recommendations" description="Prioritised interventions with expected impact." />
      <EmptyState
        title="This module is being wired up"
        description="The recommendations module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
