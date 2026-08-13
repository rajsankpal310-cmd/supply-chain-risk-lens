import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function DeadlocksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Deadlock detection" description="Circular payment chains where cash stops moving." />
      <EmptyState
        title="This module is being wired up"
        description="The deadlock detection module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
