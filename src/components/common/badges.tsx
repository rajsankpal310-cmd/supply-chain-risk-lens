import { AlertTriangle, CheckCircle2, CircleAlert, Clock, OctagonAlert, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PaymentStatus, RiskLevel } from "@/types";

const RISK_META: Record<RiskLevel, { label: string; className: string; Icon: typeof ShieldCheck; help: string }> = {
  LOW: { label: "Low", className: "bg-risk-low/15 text-risk-low border-risk-low/35", Icon: ShieldCheck, help: "Stable payment behaviour and healthy liquidity." },
  MEDIUM: { label: "Medium", className: "bg-risk-medium/15 text-risk-medium border-risk-medium/35", Icon: CircleAlert, help: "Some warning signals; monitor over the next cycle." },
  HIGH: { label: "High", className: "bg-risk-high/15 text-risk-high border-risk-high/35", Icon: AlertTriangle, help: "Material risk of delayed payment or financial stress." },
  CRITICAL: { label: "Critical", className: "bg-risk-critical/15 text-risk-critical border-risk-critical/40", Icon: OctagonAlert, help: "Immediate action recommended; spread to connected firms is likely." },
};

export function RiskBadge({ level, score, className }: { level: RiskLevel; score?: number; className?: string }) {
  const meta = RISK_META[level];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide uppercase",
            meta.className,
            className,
          )}
          aria-label={`Risk level ${meta.label}${score !== undefined ? `, score ${score}` : ""}`}
        >
          <meta.Icon className="size-3.5 shrink-0" aria-hidden />
          {meta.label}
          {score !== undefined && <span className="font-mono text-[11px] opacity-80">{score}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>{meta.help}</TooltipContent>
    </Tooltip>
  );
}

const STATUS_META: Record<PaymentStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  PAID: { label: "Paid", className: "bg-risk-low/15 text-risk-low border-risk-low/35", Icon: CheckCircle2 },
  PENDING: { label: "Pending", className: "bg-muted text-muted-foreground border-border", Icon: Clock },
  DELAYED: { label: "Delayed", className: "bg-risk-high/15 text-risk-high border-risk-high/35", Icon: AlertTriangle },
  CRITICAL: { label: "Critical", className: "bg-risk-critical/15 text-risk-critical border-risk-critical/40", Icon: OctagonAlert },
};

export function StatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", meta.className, className)}>
      <meta.Icon className="size-3.5 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}

export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent uppercase", className)}>
          Demo dataset
        </span>
      </TooltipTrigger>
      <TooltipContent>Sample data for demonstration. Not real financial information.</TooltipContent>
    </Tooltip>
  );
}

export function MetricHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded focus-visible:ring-2 focus-visible:outline-none" aria-label={text}>
          <CircleAlert className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}
