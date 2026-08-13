import { createFileRoute } from "@tanstack/react-router";
import { OptimizationPage } from "@/components/pages/OptimizationPage";

export const Route = createFileRoute("/app/optimization")({
  component: OptimizationPage,
});
