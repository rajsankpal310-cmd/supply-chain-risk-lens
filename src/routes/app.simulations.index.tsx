import { createFileRoute } from "@tanstack/react-router";
import { SimulatorPage } from "@/components/pages/SimulatorPage";

export const Route = createFileRoute("/app/simulations/")({
  component: () => <SimulatorPage initialTab="history" />,
});
