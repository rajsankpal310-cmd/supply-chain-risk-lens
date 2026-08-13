import { createFileRoute } from "@tanstack/react-router";
import { UploadPage } from "@/components/pages/UploadPage";

export const Route = createFileRoute("/app/upload")({
  component: UploadPage,
});
