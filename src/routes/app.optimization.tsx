import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/common/RoleGuard";
import { OptimizationPage } from "@/components/pages/OptimizationPage";

export const Route = createFileRoute("/app/optimization")({
  component: () => (
    <RoleGuard allowed={["SME_ADMIN", "ANALYST"]} featureName="Capital Allocation Optimizer">
      <OptimizationPage />
    </RoleGuard>
  ),
});
