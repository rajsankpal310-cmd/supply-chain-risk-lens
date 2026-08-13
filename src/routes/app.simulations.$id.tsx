import { createFileRoute } from "@tanstack/react-router";
import { SimulationResultPage } from "@/components/pages/SimulationResultPage";

export const Route = createFileRoute("/app/simulations/$id")({
  component: SimulationResultPage,
});
