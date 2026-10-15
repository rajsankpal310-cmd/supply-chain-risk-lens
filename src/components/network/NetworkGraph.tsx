import { HelpCircle, Minus, Plus, RotateCcw, X } from "lucide-react";
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
  height,
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
  height?: number | string;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<{ node: NetworkNode; x: number; y: number } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track pointers for touch panning and pinch-to-zoom
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDist = useRef<number | null>(null);
  const initialZoom = useRef<number>(1);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

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

  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }

    if (activePointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    } else if (activePointers.current.size === 2) {
      dragStart.current = null;
      const pts = Array.from(activePointers.current.values());
      const p0 = pts[0];
      const p1 = pts[1];
      if (p0 && p1) {
        initialPinchDist.current = getDistance(p0, p1);
        initialZoom.current = zoom;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1 && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
    } else if (activePointers.current.size === 2 && initialPinchDist.current && initialPinchDist.current > 0) {
      const pts = Array.from(activePointers.current.values());
      const p0 = pts[0];
      const p1 = pts[1];
      if (p0 && p1) {
        const currentDist = getDistance(p0, p1);
        const scaleFactor = currentDist / initialPinchDist.current;
        setZoom(Math.min(2.5, Math.max(0.4, initialZoom.current * scaleFactor)));
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(e.pointerId);
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (activePointers.current.size === 1) {
      const remaining = Array.from(activePointers.current.values())[0];
      if (remaining) {
        dragStart.current = { x: remaining.x, y: remaining.y, panX: pan.x, panY: pan.y };
      }
      initialPinchDist.current = null;
    } else if (activePointers.current.size === 0) {
      dragStart.current = null;
      initialPinchDist.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "border-border/70 bg-card relative overflow-hidden rounded-xl border select-none touch-none",
        className
      )}
    >
      <svg
        viewBox="0 0 1000 760"
        style={{ height: height ?? undefined }}
        className={cn(
          "grid-backdrop w-full select-none touch-none",
          !height && "h-[360px] sm:h-[480px] lg:h-[580px]"
        )}
        role="img"
        aria-label="Supply chain network graph"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
                {/* Large transparent touch hit area for mobile fingertips (44px min) */}
                <circle r={Math.max(r + 12, 22)} fill="transparent" pointerEvents="all" />

                {(selectedId === n.id || highlightPath.includes(n.id)) && (
                  <>
                    <circle r={r + 14} fill="var(--color-primary)" fillOpacity={0.2} className="animate-pulse" />
                    <circle r={r + 7} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeDasharray={selectedId === n.id ? undefined : "4 3"} />
                  </>
                )}
                <circle r={r} fill={fillFor(n)} fillOpacity={0.9} stroke="var(--color-background)" strokeWidth={selectedId === n.id ? 3 : 2} />
                {(selectedId === n.id || r > 20) && (
                  <text y={r + 14} textAnchor="middle" fontSize={11} fill="var(--color-foreground)" className="pointer-events-none font-medium">
                    {(() => {
                      const label = formatCompanyName(n.name, n.id);
                      return label.length > 20 ? `${label.slice(0, 19)}…` : label;
                    })()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Hover Card for Pointer / Desktop Devices */}
      {hoveredNode && (
        <div
          className="pointer-events-none hidden sm:block absolute z-30 w-72 rounded-lg border border-border/80 bg-popover/95 p-3.5 shadow-xl backdrop-blur transition-all"
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

      {/* Floating Canvas Controls (Positioned cleanly on top-right) */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Zoom in"
          className="size-8 sm:size-9 shadow-sm"
          onClick={() => setZoom((z) => Math.min(2.4, z + 0.25))}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Zoom out"
          className="size-8 sm:size-9 shadow-sm"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.25))}
        >
          <Minus className="size-4" aria-hidden />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Reset view"
          className="size-8 sm:size-9 shadow-sm"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            onSelect?.(null);
          }}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>

      {/* Mobile Legend Toggle & Desktop Overlay */}
      <div className="absolute bottom-3 left-3 z-20">
        <div className="hidden sm:block">
          <EmbeddedLegend view={view} />
        </div>
        <div className="sm:hidden">
          {showLegend ? (
            <div className="relative">
              <EmbeddedLegend view={view} onClose={() => setShowLegend(false)} />
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5 text-xs shadow-md bg-background/90 backdrop-blur"
              onClick={() => setShowLegend(true)}
            >
              <HelpCircle className="size-3.5" />
              <span>Legend</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmbeddedLegend({ view, onClose }: { view: NetworkView; onClose?: () => void }) {
  return (
    <div className="border-border/70 bg-popover/95 text-muted-foreground rounded-lg border p-2.5 sm:p-3 text-[11px] backdrop-blur max-w-[280px] sm:max-w-xs shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-foreground font-semibold">Topology Legend</p>
        {onClose && (
          <button onClick={onClose} className="p-0.5 rounded hover:bg-muted" aria-label="Close legend">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-1 text-[10px]">
        <p>• <span className="font-medium text-foreground">Node Size:</span> {view === "EXPOSURE" ? "exposure amount" : view === "IMPACT" ? "contagion impact %" : "transaction volume"}</p>
        <p>• <span className="font-medium text-foreground">Solid Line:</span> Active transaction obligation</p>
        <p>• <span className="font-medium text-foreground">Dashed Line:</span> Completed relationship</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2 border-t border-border/50 pt-1.5">
        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1 text-[10px]">
            <span className="size-2 rounded-full" style={{ background: RISK_FILL[l] }} aria-hidden />
            {l.charAt(0) + l.slice(1).toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
