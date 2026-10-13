import { Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NetworkEdge, NetworkNode } from "@/types";
import { formatCompanyName } from "@/utils/format";

export type NetworkView = "NETWORK" | "RISK" | "EXPOSURE" | "IMPACT";

const RISK_FILL = {
  LOW: "var(--color-risk-low)",
  MEDIUM: "var(--color-risk-medium)",
  HIGH: "var(--color-risk-high)",
  CRITICAL: "var(--color-risk-critical)",
} as const;

export function NetworkGraph({
  nodes,
  edges,
  view = "NETWORK",
  selectedId,
  highlightPath = [],
  onSelect,
  isolate = false,
  activeOnly = false,
  className,
  height = 520,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  view?: NetworkView;
  selectedId?: string | null;
  highlightPath?: string[];
  onSelect?: (id: string | null) => void;
  isolate?: boolean;
  activeOnly?: boolean;
  className?: string;
  height?: number;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<{ node: NetworkNode; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const visible = useMemo(() => {
    let filteredEdges = edges;
    if (activeOnly) {
      filteredEdges = edges.filter((e) => e.hasActiveTransactions !== false);
    }

    if (!isolate || !selectedId) return { nodes, edges: filteredEdges };
    const neighbourIds = new Set<string>([selectedId]);
    filteredEdges.forEach((e) => {
      if (e.source === selectedId) neighbourIds.add(e.target);
      if (e.target === selectedId) neighbourIds.add(e.source);
    });
    return {
      nodes: nodes.filter((n) => neighbourIds.has(n.id)),
      edges: filteredEdges.filter((e) => neighbourIds.has(e.source) && neighbourIds.has(e.target)),
    };
  }, [nodes, edges, isolate, selectedId, activeOnly]);

  const nodeMap = useMemo(() => new Map(visible.nodes.map((n) => [n.id, n])), [visible.nodes]);
  const maxExposure = Math.max(...nodes.map((n) => n.exposure), 1);

  const radiusFor = (n: NetworkNode) => {
    if (view === "EXPOSURE") return 10 + (n.exposure / maxExposure) * 22;
    if (view === "IMPACT") return 10 + (n.impact / 100) * 22;
    return 10 + Math.min(22, n.volume * 0.7);
  };
  const fillFor = (n: NetworkNode) => {
    if (view === "NETWORK") return "var(--color-chart-1)";
    if (view === "IMPACT") return n.impact > 70 ? RISK_FILL.CRITICAL : n.impact > 50 ? RISK_FILL.HIGH : RISK_FILL.MEDIUM;
    if (view === "EXPOSURE") return "var(--color-chart-5)";
    return RISK_FILL[n.riskLevel];
  };

  return (
    <div ref={containerRef} className={cn("border-border/70 bg-card relative overflow-hidden rounded-xl border", className)}>
      <svg
        viewBox="0 0 1000 760"
        style={{ height }}
        className="grid-backdrop w-full touch-none select-none"
        role="img"
        aria-label="Supply chain network graph"
        onMouseDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        }}
        onMouseMove={(e) => {
          if (!drag.current) return;
          setPan({ x: drag.current.panX + (e.clientX - drag.current.x), y: drag.current.panY + (e.clientY - drag.current.y) });
        }}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => {
          drag.current = null;
          setHoveredNode(null);
        }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {visible.edges.map((e) => {
            const s = nodeMap.get(e.source);
            const t = nodeMap.get(e.target);
            if (!s || !t) return null;
            const active = selectedId === e.source || selectedId === e.target;
            const onPath = highlightPath.includes(e.source) && highlightPath.includes(e.target);
            const isCompleted = e.hasActiveTransactions === false || e.status === "COMPLETED";

            return (
              <line
                key={e.id}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={onPath ? "var(--color-risk-critical)" : active ? "var(--color-primary)" : isCompleted ? "var(--color-muted-foreground)" : "var(--color-border)"}
                strokeWidth={Math.max(1, ((e.activeExposure ?? e.exposure) / maxExposure) * 14) * (onPath || active ? 1.6 : 1)}
                strokeDasharray={isCompleted ? "4 4" : undefined}
                strokeOpacity={selectedId && !active && !onPath ? 0.2 : isCompleted ? 0.35 : 0.75}
              />
            );
          })}
          {visible.nodes.map((n) => {
            const r = radiusFor(n);
            const dim = Boolean(selectedId) && selectedId !== n.id && !highlightPath.includes(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                aria-label={`${formatCompanyName(n.name, n.id)}, risk ${n.riskLevel}`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect?.(selectedId === n.id ? null : n.id);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") onSelect?.(n.id);
                }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setHoveredNode({
                      node: n,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }
                }}
                onMouseLeave={() => setHoveredNode(null)}
                opacity={dim ? 0.35 : 1}
              >
                {(selectedId === n.id || highlightPath.includes(n.id)) && (
                  <>
                    <circle r={r + 14} fill="var(--color-primary)" fillOpacity={0.2} className="animate-pulse" />
                    <circle r={r + 7} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeDasharray={selectedId === n.id ? undefined : "4 3"} />
                  </>
                )}
                <circle r={r} fill={fillFor(n)} fillOpacity={0.9} stroke="var(--color-background)" strokeWidth={selectedId === n.id ? 3 : 2} />
                {(selectedId === n.id || r > 22) && (
                  <text y={r + 14} textAnchor="middle" fontSize={11} fill="var(--color-foreground)" className="pointer-events-none font-medium">
                    {(() => {
                      const label = formatCompanyName(n.name, n.id);
                      return label.length > 22 ? `${label.slice(0, 21)}…` : label;
                    })()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Hover Card */}
      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-30 w-72 rounded-lg border border-border/80 bg-popover/95 p-3.5 shadow-xl backdrop-blur transition-all"
          style={{
            left: Math.min(hoveredNode.x + 16, (containerRef.current?.clientWidth || 800) - 300),
            top: Math.min(hoveredNode.y + 16, (containerRef.current?.clientHeight || 600) - 220),
          }}
        >
          <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
            <div>
              <p className="font-mono text-[10px] text-muted-foreground">{hoveredNode.node.id}</p>
              <h4 className="font-semibold text-sm leading-snug text-foreground">
                {formatCompanyName(hoveredNode.node.name, hoveredNode.node.id)}
              </h4>
              <p className="text-[11px] text-muted-foreground capitalize">{hoveredNode.node.role.toLowerCase()} · {hoveredNode.node.industry}</p>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white uppercase"
              style={{ backgroundColor: RISK_FILL[hoveredNode.node.riskLevel] }}
            >
              {hoveredNode.node.riskLevel} ({hoveredNode.node.riskScore})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-2 text-[11px]">
            <div>
              <span className="text-muted-foreground block text-[10px]">Avg Delay</span>
              <span className="font-medium text-foreground">{hoveredNode.node.avgPaymentDelayDays ?? 0} days</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Outstanding</span>
              <span className="font-medium font-mono text-foreground">
                ₹{((hoveredNode.node.outstandingAmount ?? hoveredNode.node.exposure) / 100000).toFixed(1)}L
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Active Relations</span>
              <span className="font-medium text-foreground">{hoveredNode.node.activeRelationshipsCount ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Active Alerts</span>
              <span className="font-medium text-foreground">{hoveredNode.node.activeAlertsCount ?? 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Txns (Active/Done)</span>
              <span className="font-medium text-foreground">
                {hoveredNode.node.activeTransactionsCount ?? "-"}/{hoveredNode.node.completedTransactionsCount ?? "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Cascade Impact</span>
              <span className="font-medium text-foreground">{hoveredNode.node.impact}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <Button variant="secondary" size="icon" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))}>
          <Plus className="size-4" aria-hidden />
        </Button>
        <Button variant="secondary" size="icon" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}>
          <Minus className="size-4" aria-hidden />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Reset view"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            onSelect?.(null);
          }}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>

      <NetworkLegend view={view} />
    </div>
  );
}

export function NetworkLegend({ view }: { view: NetworkView }) {
  return (
    <div className="border-border/70 bg-popover/90 text-muted-foreground absolute bottom-3 left-3 rounded-lg border p-3 text-[11px] backdrop-blur max-w-xs shadow-md">
      <p className="text-foreground mb-1 font-semibold">Topology Legend</p>
      <div className="space-y-1 text-[10px]">
        <p>• <span className="font-medium text-foreground">Node Size:</span> {view === "EXPOSURE" ? "exposure amount" : view === "IMPACT" ? "contagion impact %" : "transaction volume"}</p>
        <p>• <span className="font-medium text-foreground">Solid Line:</span> Active transaction obligation</p>
        <p>• <span className="font-medium text-foreground">Dashed Line:</span> Completed historical relationship</p>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2 border-t border-border/50 pt-2">
        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: RISK_FILL[l] }} aria-hidden />
            {l.charAt(0) + l.slice(1).toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
