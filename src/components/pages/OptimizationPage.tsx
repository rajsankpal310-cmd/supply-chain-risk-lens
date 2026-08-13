import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function OptimizationPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Support optimization" description="Allocate a limited budget for maximum risk reduction." />
      <EmptyState
        title="This module is being wired up"
        description="The support optimization module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
