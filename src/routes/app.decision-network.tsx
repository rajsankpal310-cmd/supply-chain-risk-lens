import { createFileRoute } from "@tanstack/react-router";
import { DecisionNetworkPage } from "@/components/pages/DecisionNetworkPage";

export const Route = createFileRoute("/app/decision-network")({
  component: DecisionNetworkPage,
});
