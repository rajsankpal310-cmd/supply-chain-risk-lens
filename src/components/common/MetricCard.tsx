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
    <Card className={cn("flex flex-col justify-between gap-2.5 p-4 sm:p-5 overflow-hidden border-border/70 bg-card shadow-xs", className)}>
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase leading-normal break-words">
            {label}
          </span>
          {tooltip && <MetricHint text={tooltip} />}
        </div>
        {status && (
          <div className="shrink-0 pl-1 self-start">
            <RiskBadge level={status} />
          </div>
        )}
      </div>

      <div className="mt-1">
        <div className="text-foreground font-mono text-xl sm:text-2xl font-bold tracking-tight tabular-nums break-words leading-tight">
          {value}
        </div>
        {trend !== undefined && trendLabel && (
          <div className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium", bad ? "text-risk-high" : "text-risk-low")}>
            {up ? <TrendingUp className="size-3.5 shrink-0" aria-hidden /> : <TrendingDown className="size-3.5 shrink-0" aria-hidden />}
            <span>
              {up ? "+" : ""}
              {trend}
              {Math.abs(trend) < 100 && String(trend).includes(".") ? "%" : ""}
            </span>
            <span className="text-muted-foreground font-normal">{trendLabel}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
