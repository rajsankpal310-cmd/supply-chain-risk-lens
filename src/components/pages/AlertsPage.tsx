import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function AlertsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Alerts" description="Risk events that need attention." />
      <EmptyState
        title="This module is being wired up"
        description="The alerts module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
