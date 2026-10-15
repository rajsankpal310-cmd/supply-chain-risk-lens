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

export function RiskBadge({ level, score, className }: { level?: RiskLevel | string | null; score?: number; className?: string }) {
  const normalized = (level?.toUpperCase() ?? "LOW") as RiskLevel;
  const meta = RISK_META[normalized] ?? RISK_META.LOW;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide uppercase shrink-0 whitespace-nowrap",
            meta.className,
            className,
          )}
          aria-label={`Risk level ${meta.label}${score !== undefined ? `, score ${score}` : ""}`}
        >
          <meta.Icon className="size-3.5 shrink-0" aria-hidden />
          <span>{meta.label}</span>
          {score !== undefined && <span className="font-mono text-[11px] opacity-85 ml-0.5">{score}</span>}
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

export function StatusBadge({ status, className }: { status?: PaymentStatus | string | null; className?: string }) {
  const normalized = (status?.toUpperCase() ?? "PENDING") as PaymentStatus;
  const meta = STATUS_META[normalized] ?? STATUS_META.PENDING;
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
        <span className={cn("inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary uppercase", className)}>
          Active Dataset
        </span>
      </TooltipTrigger>
      <TooltipContent>Active transaction records.</TooltipContent>
    </Tooltip>
  );
}

export function ProvenanceBadge({
  sourceType,
  dataStatus,
  className,
}: {
  sourceType?: string | undefined;
  dataStatus?: string | undefined;
  className?: string | undefined;
}) {
  const normType = (sourceType || "DEMO_ONLY").toUpperCase();
  const normStatus = (dataStatus || "").toUpperCase();

  // 1. Simulated Benchmark (Statistically modeled/calibrated B2B ledger)
  if (
    normStatus === "SIMULATED" ||
    normStatus === "PUBLIC_SIMULATED_DATA" ||
    normType === "SIMULATED"
  ) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400",
              className
            )}
          >
            <Clock className="size-3 shrink-0" />
            Simulated Benchmark
          </span>
        </TooltipTrigger>
        <TooltipContent>Statistically simulated B2B transaction ledger calibrated from credit distributions. Not real corporate records.</TooltipContent>
      </Tooltip>
    );
  }

  // 2. Verified Primary Data (Observed operational ledger records)
  if (normStatus === "REAL_OBSERVED" || normType === "PRIMARY_TRANSACTION") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400",
              className
            )}
          >
            <ShieldCheck className="size-3 shrink-0" />
            Verified Primary Data
          </span>
        </TooltipTrigger>
        <TooltipContent>Ingested from verified primary business/ledger records.</TooltipContent>
      </Tooltip>
    );
  }

  // 3. Administrative Aggregate / External Reference / Survey
  if (
    normStatus === "ADMINISTRATIVE_AGGREGATE" ||
    normStatus === "SURVEY_MICRODATA" ||
    normType === "EXTERNAL_REFERENCE" ||
    normType === "ADMINISTRATIVE" ||
    normType === "SURVEY"
  ) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400",
              className
            )}
          >
            <CircleAlert className="size-3 shrink-0" />
            External Reference
          </span>
        </TooltipTrigger>
        <TooltipContent>Official administrative aggregate or survey benchmark (e.g. MSME Samadhaan, WBES).</TooltipContent>
      </Tooltip>
    );
  }

  // 4. Public Dataset
  if (normStatus === "PUBLIC_DATASET" || normType === "PUBLIC_DATASET") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400",
              className
            )}
          >
            <CheckCircle2 className="size-3 shrink-0" />
            Public Dataset
          </span>
        </TooltipTrigger>
        <TooltipContent>Published public open dataset.</TooltipContent>
      </Tooltip>
    );
  }

  // 5. Synthetic Data
  if (normStatus === "SYNTHETIC" || normType === "SYNTHETIC") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400",
              className
            )}
          >
            <AlertTriangle className="size-3 shrink-0" />
            Synthetic Data
          </span>
        </TooltipTrigger>
        <TooltipContent>Artificially synthesized test records.</TooltipContent>
      </Tooltip>
    );
  }

  // 6. Unverified
  if (normStatus === "UNVERIFIED") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400",
              className
            )}
          >
            <OctagonAlert className="size-3 shrink-0" />
            Unverified
          </span>
        </TooltipTrigger>
        <TooltipContent>Data provenance or source authenticity is unverified.</TooltipContent>
      </Tooltip>
    );
  }

  // 7. Uploaded Dataset
  if (
    normStatus === "UPLOADED" ||
    normType === "UPLOADED" ||
    normStatus === "USER_UPLOAD" ||
    normType === "USER_UPLOAD"
  ) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400",
              className
            )}
          >
            <ShieldCheck className="size-3 shrink-0" />
            Uploaded Dataset
          </span>
        </TooltipTrigger>
        <TooltipContent>User-uploaded operational transaction records.</TooltipContent>
      </Tooltip>
    );
  }

  // 8. Default Active Dataset
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400",
            className
          )}
        >
          Active Dataset
        </span>
      </TooltipTrigger>
      <TooltipContent>Current operational transaction ledger records.</TooltipContent>
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
