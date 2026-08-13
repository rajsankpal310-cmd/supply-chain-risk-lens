import { createFileRoute } from "@tanstack/react-router";
import { TransactionDetailPage } from "@/components/pages/TransactionDetailPage";

export const Route = createFileRoute("/app/transactions/$id")({
  component: TransactionDetailPage,
});
