import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/common/RoleGuard";
import { RecommendationsPage } from "@/components/pages/RecommendationsPage";

export const Route = createFileRoute("/app/optimization")({
  component: () => (
    <RoleGuard allowed={["SME_ADMIN", "ANALYST"]} featureName="Smart Budget Allocation">
      <RecommendationsPage initialTab="optimization" />
    </RoleGuard>
  ),
});
