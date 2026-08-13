import { createFileRoute } from "@tanstack/react-router";
import { RecommendationsPage } from "@/components/pages/RecommendationsPage";

export const Route = createFileRoute("/app/recommendations")({
  component: RecommendationsPage,
});
