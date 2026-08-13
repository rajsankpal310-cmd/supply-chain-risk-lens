import { createFileRoute } from "@tanstack/react-router";
import { RelationshipsPage } from "@/components/pages/RelationshipsPage";

export const Route = createFileRoute("/app/relationships")({
  component: RelationshipsPage,
});
