import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function FirmDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Firm profile" description="Detailed risk breakdown for a single connected firm." />
      <EmptyState
        title="This module is being wired up"
        description="The firm profile module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
