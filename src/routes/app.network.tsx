import { createFileRoute } from "@tanstack/react-router";
import { NetworkPage } from "@/components/pages/NetworkPage";

export const Route = createFileRoute("/app/network")({
  component: NetworkPage,
});
