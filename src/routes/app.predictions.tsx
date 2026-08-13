import { createFileRoute } from "@tanstack/react-router";
import { PredictionsPage } from "@/components/pages/PredictionsPage";

export const Route = createFileRoute("/app/predictions")({
  component: PredictionsPage,
});
