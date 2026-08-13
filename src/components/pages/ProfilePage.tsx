import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

export function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account details and role." />
      <EmptyState
        title="This module is being wired up"
        description="The profile module is part of the NEXUS-CFR workflow and will populate from your uploaded transaction data."
      />
    </div>
  );
}
