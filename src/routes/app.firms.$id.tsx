import { createFileRoute } from "@tanstack/react-router";
import { FirmDetailPage } from "@/components/pages/FirmDetailPage";

export const Route = createFileRoute("/app/firms/$id")({
  component: FirmDetailPage,
});
