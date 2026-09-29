import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function NetworkLegend() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-lg border border-border/80 bg-background/95 p-3 shadow-md backdrop-blur text-xs space-y-2">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Info className="size-3.5 text-primary" />
          <span>Network Topology Legend</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 p-0"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand legend" : "Collapse legend"}
        >
          {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="space-y-2.5 pt-0.5">
          {/* Node Colors */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Nodes: Organizations & Risk State
            </p>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Low Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-500 shrink-0" />
                <span>Medium Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-orange-500 shrink-0" />
                <span>High Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-rose-600 shrink-0" />
                <span>Critical Risk</span>
              </div>
            </div>
          </div>

          {/* Edge Semantics */}
          <div className="border-t border-border/60 pt-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Edges: B2B Obligations & Exposure
            </p>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-0.5 bg-primary rounded-full shrink-0" />
                <span><strong className="text-foreground">Solid Line:</strong> Active Obligation (&gt; ₹0 due)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 border-b-2 border-dashed border-muted-foreground shrink-0" />
                <span><strong className="text-foreground">Dashed Line:</strong> Settled / Historical Relationship</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-1.5 bg-primary/60 rounded-full shrink-0" />
                <span><strong className="text-foreground">Edge Thickness:</strong> Proportional to Outstanding Exposure</span>
              </div>
            </div>
          </div>

          {/* Deadlock Chain */}
          <div className="border-t border-border/60 pt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <span className="text-primary font-bold">ℹ</span>
            <span>
              Circular chains (A → B → C → A) indicate trapped working-capital deadlocks.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
