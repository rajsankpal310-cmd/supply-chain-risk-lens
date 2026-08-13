import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function RiskPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Risk intelligence" description="Category scores and the drivers behind them." />
      <EmptyState
        title="This module is being wired up"
        description="The risk intelligence module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
