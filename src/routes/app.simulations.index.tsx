import { createFileRoute } from "@tanstack/react-router";
import { SimulationHistoryPage } from "@/components/pages/SimulationHistoryPage";

export const Route = createFileRoute("/app/simulations/")({
  component: SimulationHistoryPage,
});
