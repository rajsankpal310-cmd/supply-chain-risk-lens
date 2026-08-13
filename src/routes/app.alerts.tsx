import { createFileRoute } from "@tanstack/react-router";
import { AlertsPage } from "@/components/pages/AlertsPage";

export const Route = createFileRoute("/app/alerts")({
  component: AlertsPage,
});
