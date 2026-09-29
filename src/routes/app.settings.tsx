import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/common/RoleGuard";
import { SettingsPage } from "@/components/pages/SettingsPage";

export const Route = createFileRoute("/app/settings")({
  component: () => (
    <RoleGuard allowed={["SME_ADMIN"]} featureName="System Administration Settings">
      <SettingsPage />
    </RoleGuard>
  ),
});
