import { createFileRoute } from "@tanstack/react-router";
import { FirmsPage } from "@/components/pages/FirmsPage";

export const Route = createFileRoute("/app/firms/")({
  component: FirmsPage,
});
