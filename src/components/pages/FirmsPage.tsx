import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function FirmsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Firms" description="Connected buyers and suppliers with their risk profile." />
      <EmptyState
        title="This module is being wired up"
        description="The firms module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
