import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate and export risk reports." />
      <EmptyState
        title="This module is being wired up"
        description="The reports module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
