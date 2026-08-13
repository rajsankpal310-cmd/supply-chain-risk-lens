import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function PredictionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Predictions" description="Payment delay and financial stress forecasts." />
      <EmptyState
        title="This module is being wired up"
        description="The predictions module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
