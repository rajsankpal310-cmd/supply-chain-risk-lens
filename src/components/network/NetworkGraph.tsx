import { Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NetworkEdge, NetworkNode } from "@/types";

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
  className?: string;
  height?: number;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const visible = useMemo(() => {
    if (!isolate || !selectedId) return { nodes, edges };
    const neighbourIds = new Set<string>([selectedId]);
    edges.forEach((e) => {
      if (e.source === selectedId) neighbourIds.add(e.target);
      if (e.target === selectedId) neighbourIds.add(e.source);
    });
    return {
      nodes: nodes.filter((n) => neighbourIds.has(n.id)),
      edges: edges.filter((e) => neighbourIds.has(e.source) && neighbourIds.has(e.target)),
    };
  }, [nodes, edges, isolate, selectedId]);

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
    <div className={cn("border-border/70 bg-card relative overflow-hidden rounded-xl border", className)}>
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
        onMouseLeave={() => (drag.current = null)}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {visible.edges.map((e) => {
            const s = nodeMap.get(e.source);
            const t = nodeMap.get(e.target);
            if (!s || !t) return null;
            const active = selectedId === e.source || selectedId === e.target;
            const onPath = highlightPath.includes(e.source) && highlightPath.includes(e.target);
            return (
              <line
                key={e.id}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={onPath ? "var(--color-risk-critical)" : active ? "var(--color-primary)" : "var(--color-border)"}
                strokeWidth={Math.max(1, (e.exposure / maxExposure) * 14) * (onPath || active ? 1.6 : 1)}
                strokeOpacity={selectedId && !active && !onPath ? 0.25 : 0.75}
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
                aria-label={`${n.name}, risk ${n.riskLevel}`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect?.(selectedId === n.id ? null : n.id);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") onSelect?.(n.id);
                }}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                opacity={dim ? 0.35 : 1}
              >
                {(selectedId === n.id || highlightPath.includes(n.id)) && (
                  <circle r={r + 8} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="4 3" />
                )}
                <circle r={r} fill={fillFor(n)} fillOpacity={0.85} stroke="var(--color-background)" strokeWidth={2} />
                {(hovered === n.id || selectedId === n.id || r > 22) && (
                  <text y={r + 14} textAnchor="middle" fontSize={11} fill="var(--color-foreground)" className="pointer-events-none font-medium">
                    {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

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
    <div className="border-border/70 bg-popover/90 text-muted-foreground absolute bottom-3 left-3 rounded-lg border p-3 text-[11px] backdrop-blur">
      <p className="text-foreground mb-1.5 font-semibold">Legend</p>
      <p>Node = firm · Edge = business relationship</p>
      <p>Node size = {view === "EXPOSURE" ? "exposure" : view === "IMPACT" ? "potential impact" : "transaction volume"}</p>
      <p>Edge thickness = exposure</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: RISK_FILL[l] }} aria-hidden />
            {l.charAt(0) + l.slice(1).toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
