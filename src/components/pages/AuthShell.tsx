import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="bg-background grid min-h-screen lg:grid-cols-2">
      <div className="grid-backdrop border-border/70 hidden flex-col justify-between border-r p-10 lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md font-bold">N</div>
          <span className="font-semibold tracking-tight">NEXUS-CFR</span>
        </Link>
        <div>
          <span className="text-primary font-mono text-xs tracking-wider uppercase">NEXUS-CFR Platform</span>
          <h2 className="mt-2 max-w-md text-3xl font-semibold tracking-tight">Data-Driven SME Financial Risk Prediction & Supply Chain Resilience</h2>
          <p className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
            Predict payment delays, map supply-chain network exposure, simulate cascade shocks, and execute prioritised financial interventions from real transaction ledgers.
          </p>
        </div>
        <p className="text-muted-foreground text-xs">Supports primary transactions and verified public research datasets with full provenance tracking.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md font-bold">N</div>
            <span className="font-semibold tracking-tight">NEXUS-CFR</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1.5 mb-6 text-sm">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
