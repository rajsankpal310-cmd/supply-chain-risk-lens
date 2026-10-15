import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { CardsSkeleton, ErrorState } from "@/components/common/states";
import { WidgetErrorBoundary } from "@/components/common/WidgetErrorBoundary";
import { SmeAdminDashboard } from "@/components/dashboard/SmeAdminDashboard";
import { AnalystDashboard } from "@/components/dashboard/AnalystDashboard";
import { ViewerDashboard } from "@/components/dashboard/ViewerDashboard";
import { dashboardService } from "@/services/analyticsServices";
import { alertService } from "@/services/decisionServices";

export function DashboardPage() {
  const { user } = useAuth();
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: dashboardService.getSummary });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: alertService.getAlerts });

  if (summary.isLoading) return <CardsSkeleton count={6} />;
  if (summary.isError || !summary.data)
    return (
      <ErrorState
        title="Could not load the dashboard"
        description={summary.error instanceof Error ? summary.error.message : "Something went wrong while computing risk metrics."}
        onRetry={() => summary.refetch()}
      />
    );

  const data = summary.data;
  const alertList = alerts.data ?? [];
  const role = user?.role || "VIEWER";

  const handleRefresh = () => {
    summary.refetch();
    alerts.refetch();
  };

  return (
    <WidgetErrorBoundary title="Dashboard Workspace" fallbackMessage="An issue occurred while rendering the dashboard view.">
      {role === "SME_ADMIN" ? (
        <SmeAdminDashboard
          data={data}
          alerts={alertList}
          user={user}
          onRefresh={handleRefresh}
          isFetching={summary.isFetching || alerts.isFetching}
        />
      ) : role === "ANALYST" ? (
        <AnalystDashboard
          data={data}
          user={user}
          onRefresh={handleRefresh}
          isFetching={summary.isFetching || alerts.isFetching}
        />
      ) : (
        <ViewerDashboard
          data={data}
          alerts={alertList}
          user={user}
          onRefresh={handleRefresh}
          isFetching={summary.isFetching || alerts.isFetching}
        />
      )}
    </WidgetErrorBoundary>
  );
}
