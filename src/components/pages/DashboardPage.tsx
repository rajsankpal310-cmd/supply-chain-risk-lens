import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { CardsSkeleton, ErrorState } from "@/components/common/states";
import { SmeAdminDashboard } from "@/components/dashboard/SmeAdminDashboard";
import { AnalystDashboard } from "@/components/dashboard/AnalystDashboard";
import { ViewerDashboard } from "@/components/dashboard/ViewerDashboard";
import { dashboardService } from "@/services/analyticsServices";
import { alertService } from "@/services/decisionServices";

export function DashboardPage() {
  const { user } = useAuth();
  const summary = useQuery({ queryKey: ["dashboard"], queryFn: dashboardService.getSummary });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: alertService.getAlerts });

  if (summary.isLoading) return <CardsSkeleton count={6} />;
  if (summary.isError || !summary.data)
    return (
      <ErrorState
        title="Could not load the dashboard"
        description="Something went wrong while computing risk metrics."
        onRetry={() => summary.refetch()}
      />
    );

  const data = summary.data;
  const alertList = alerts.data ?? [];
  const role = user?.role || "VIEWER";

  if (role === "SME_ADMIN") {
    return (
      <SmeAdminDashboard
        data={data}
        alerts={alertList}
        user={user}
        onRefresh={() => summary.refetch()}
        isFetching={summary.isFetching}
      />
    );
  }

  if (role === "ANALYST") {
    return (
      <AnalystDashboard
        data={data}
        user={user}
        onRefresh={() => summary.refetch()}
        isFetching={summary.isFetching}
      />
    );
  }

  // Default to VIEWER for VIEWER role or unassigned/guest sessions
  return (
    <ViewerDashboard
      data={data}
      alerts={alertList}
      user={user}
      onRefresh={() => summary.refetch()}
      isFetching={summary.isFetching}
    />
  );
}
