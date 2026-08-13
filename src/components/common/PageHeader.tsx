import type { ReactNode } from "react";
import { DemoDataBadge } from "@/components/common/badges";

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
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-foreground text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {showDemoBadge && <DemoDataBadge />}
        </div>
        {description && <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
