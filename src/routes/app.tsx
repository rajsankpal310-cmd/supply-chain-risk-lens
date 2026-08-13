import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { InlineSpinner } from "@/components/common/states";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppGuard,
});

function AppGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login", replace: true });
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center">
        <InlineSpinner label="Loading your workspace…" />
      </div>
    );
  }
  return <AppLayout />;
}
