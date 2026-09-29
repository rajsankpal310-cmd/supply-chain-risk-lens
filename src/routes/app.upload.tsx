import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/common/RoleGuard";
import { UploadPage } from "@/components/pages/UploadPage";

export const Route = createFileRoute("/app/upload")({
  component: () => (
    <RoleGuard allowed={["SME_ADMIN"]} featureName="Transaction Data Ingestion">
      <UploadPage />
    </RoleGuard>
  ),
});
