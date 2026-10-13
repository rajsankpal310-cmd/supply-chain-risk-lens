import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/analyticsServices";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  title,
  description,
  actions,
  showDemoBadge = true,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  showDemoBadge?: boolean;
}) {
  const { user } = useAuth();
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardService.getSummary,
    staleTime: 60000,
  });

  const isDemo = user?.organizationId === "ORG-001" || user?.email?.includes("demo");
  const hasData = (summaryQuery.data?.executiveSummary?.totalFirmsCount ?? 0) > 0;

  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-foreground text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {showDemoBadge && (
            isDemo ? (
              <Badge variant="outline" className="border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">
                Demo Mode • Sample Data
              </Badge>
            ) : hasData ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                Active Dataset
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                Waiting for Data
              </Badge>
            )
          )}
        </div>
        {description && <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
