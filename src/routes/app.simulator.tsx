import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/common/RoleGuard";
import { SimulatorPage } from "@/components/pages/SimulatorPage";

export const Route = createFileRoute("/app/simulator")({
  component: () => (
    <RoleGuard allowed={["SME_ADMIN", "ANALYST"]} featureName="Scenario Shock Simulation">
      <SimulatorPage />
    </RoleGuard>
  ),
});
