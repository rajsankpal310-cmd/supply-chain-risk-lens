import { TrendingDown, TrendingUp } from "lucide-react";
import { MetricHint, RiskBadge } from "@/components/common/badges";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";

export function MetricCard({
  label,
  value,
  trend,
  trendLabel,
  status,
  tooltip,
  invertTrend = true,
  className,
}: {
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  status?: RiskLevel;
  tooltip?: string;
  invertTrend?: boolean;
  className?: string;
}) {
  const up = (trend ?? 0) >= 0;
  const bad = invertTrend ? up : !up;
  return (
    <Card className={cn("gap-0 p-3.5 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase truncate">
          <span className="truncate">{label}</span>
          {tooltip && <MetricHint text={tooltip} />}
        </div>
        {status && <RiskBadge level={status} />}
      </div>
      <div className="text-foreground mt-2 sm:mt-3 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums truncate">{value}</div>
      {trend !== undefined && (
        <div className={cn("mt-2 flex items-center gap-1.5 text-xs", bad ? "text-risk-high" : "text-risk-low")}>
          {up ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
          <span className="font-medium">
            {up ? "+" : ""}
            {trend}
            {Math.abs(trend) < 100 && String(trend).includes(".") ? "%" : ""}
          </span>
          <span className="text-muted-foreground">{trendLabel}</span>
        </div>
      )}
    </Card>
  );
}
