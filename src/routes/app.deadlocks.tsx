import { createFileRoute } from "@tanstack/react-router";
import { DeadlocksPage } from "@/components/pages/DeadlocksPage";

export const Route = createFileRoute("/app/deadlocks")({
  component: DeadlocksPage,
});
