import { createFileRoute } from "@tanstack/react-router";
import { RiskPage } from "@/components/pages/RiskPage";

export const Route = createFileRoute("/app/risk")({
  component: RiskPage,
});
