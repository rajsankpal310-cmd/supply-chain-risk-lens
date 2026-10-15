import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Activity, Building2, ChevronRight, Layers, Network, RefreshCw, Search, Table2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RiskBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/PageHeader";
import { CardsSkeleton, ErrorState } from "@/components/common/states";
import { NetworkGraph, type NetworkView } from "@/components/network/NetworkGraph";
import { NetworkLegend } from "@/components/network/NetworkLegend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { INDUSTRIES } from "@/mocks/data";
import { networkService } from "@/services/analyticsServices";
import { firmService } from "@/services/dataServices";
import { formatCompanyName, formatINR } from "@/utils/format";
import type { RiskLevel } from "@/types";

const RISKS: (RiskLevel | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function NetworkPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<NetworkView>("RISK");
  const [displayType, setDisplayType] = useState<"graph" | "list">("graph");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    return p.get("firmId") || p.get("focus") || null;
  });
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState<RiskLevel | "ALL">("ALL");
  const [industry, setIndustry] = useState("ALL");
  const [isolate, setIsolate] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const target = p.get("firmId") || p.get("focus");
    if (target) {
      setSelectedId(target);
    }
  }, []);

  const netQuery = useQuery({ queryKey: ["network"], queryFn: networkService.getNetwork });
  const firmsQuery = useQuery({ queryKey: ["firms"], queryFn: firmService.getFirms });

  if (netQuery.isLoading || firmsQuery.isLoading) return <CardsSkeleton count={4} />;
  if (netQuery.isError || !netQuery.data)
    return <ErrorState title="Could not load Network Topology" description="Error generating node network graph." onRetry={() => netQuery.refetch()} />;

  const { nodes, edges } = netQuery.data;

  const selectedFirm = selectedId ? firmsQuery.data?.find((f) => f.id === selectedId) : null;

  const filteredNodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return nodes.filter((n) => {
      if (selectedId && n.id === selectedId) return true;
      if (risk !== "ALL" && n.riskLevel !== risk) return false;
      if (industry !== "ALL" && n.industry !== industry) return false;
      const cleanName = formatCompanyName(n.name, n.id).toLowerCase();
      if (term && !cleanName.includes(term) && !n.id.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [nodes, search, risk, industry, selectedId]);

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    const direct = nodes.find((n) => n.id === selectedId);
    if (direct) return direct;
    if (selectedFirm) {
      return {
        id: selectedFirm.id,
        name: selectedFirm.name,
        industry: selectedFirm.industry,
        role: selectedFirm.role,
        volume: selectedFirm.transactionCount,
        riskScore: selectedFirm.riskScore,
        riskLevel: selectedFirm.riskLevel,
        exposure: selectedFirm.outstandingAmount,
        impact: Math.round(selectedFirm.riskScore * 0.6),
        avgPaymentDelayDays: selectedFirm.avgPaymentDelayDays,
        outstandingAmount: selectedFirm.outstandingAmount,
        activeRelationshipsCount: 0,
        activeTransactionsCount: 0,
        completedTransactionsCount: 0,
        activeAlertsCount: 0,
        x: 500,
        y: 380,
      };
    }
    return null;
  }, [selectedId, nodes, selectedFirm]);

  const counterparties = useMemo(() => {
    if (!selectedId) return [];
    return edges
      .filter((e) => e.source === selectedId || e.target === selectedId)
      .map((e) => {
        const otherId = e.source === selectedId ? e.target : e.source;
        const otherNode = nodes.find((n) => n.id === otherId);
        return {
          edge: e,
          node: otherNode,
          counterpartyId: otherId,
          isActive: e.hasActiveTransactions !== false,
          exposure: e.activeExposure ?? e.exposure,
        };
      });
  }, [edges, selectedId, nodes]);

  // Detail panel content renderer (reused in desktop sidebar and mobile bottom sheet)
  const renderDetailContent = () => {
    if (!selectedNode) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="pr-2">
            <p className="text-muted-foreground font-mono text-xs">{selectedNode.id}</p>
            <h3 className="font-semibold text-base sm:text-lg leading-tight">
              {formatCompanyName(selectedNode.name, selectedFirm?.name, selectedNode.id)}
            </h3>
            <p className="text-muted-foreground text-xs capitalize mt-0.5">{selectedNode.role.toLowerCase()} · {selectedNode.industry}</p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 size-8" onClick={() => setSelectedId(null)} aria-label="Close details">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between border-y border-border/70 py-2.5">
          <span className="text-xs text-muted-foreground font-medium">Risk Assessment</span>
          <RiskBadge level={selectedNode.riskLevel} score={selectedNode.riskScore} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/50">
          <div>
            <span className="text-muted-foreground block text-[11px]">Total Exposure</span>
            <span className="font-mono font-semibold text-foreground text-sm">{formatINR(selectedNode.exposure)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Outstanding Due</span>
            <span className="font-mono font-semibold text-amber-500 text-sm">
              {formatINR(selectedNode.outstandingAmount ?? selectedNode.exposure)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Avg Payment Delay</span>
            <span className="font-mono font-medium text-foreground">{selectedNode.avgPaymentDelayDays ?? 0} days</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Active Relations</span>
            <span className="font-mono font-medium text-foreground">{selectedNode.activeRelationshipsCount ?? counterparties.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Transactions</span>
            <span className="font-mono font-medium text-foreground">
              {selectedNode.activeTransactionsCount ?? "-"}/{selectedNode.completedTransactionsCount ?? "-"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Cascade Impact</span>
            <span className="font-mono font-medium text-foreground">{selectedNode.impact}%</span>
          </div>
        </div>

        {/* Connected Counterparties List */}
        {counterparties.length > 0 && (
          <div className="border-t border-border/60 pt-3 space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Connected Counterparties</span>
              <span className="text-[10px] text-muted-foreground font-normal">({counterparties.length})</span>
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {counterparties.map((cp) => (
                <div
                  key={cp.counterpartyId}
                  className="flex items-center justify-between rounded p-2 text-xs hover:bg-accent/60 cursor-pointer transition-colors border border-transparent hover:border-border/60"
                  onClick={() => setSelectedId(cp.counterpartyId)}
                >
                  <div className="truncate pr-2">
                    <p className="font-medium truncate">{formatCompanyName(cp.node?.name, cp.counterpartyId)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cp.isActive ? (
                        <span className="text-emerald-500 font-medium">● Active Obligation</span>
                      ) : (
                        <span className="text-muted-foreground">○ Settled / Paid</span>
                      )}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold shrink-0">
                    {formatINR(cp.exposure)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick action buttons */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-xs h-9"
            onClick={() => navigate({ to: "/app/transactions" })}
          >
            <Table2 className="size-4 text-primary shrink-0" />
            <span className="truncate">View Related Invoices</span>
          </Button>
          <Button
            className="w-full justify-start gap-2 text-xs h-9"
            onClick={() => navigate({ to: "/app/firms/$id", params: { id: selectedNode.id } })}
          >
            <Building2 className="size-4 shrink-0" />
            <span className="truncate">Analyze Firm Profile</span>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-xs h-9"
            onClick={() => navigate({ to: "/app/simulator" })}
          >
            <Activity className="size-4 text-primary shrink-0" />
            <span className="truncate">Simulate Supply Shock</span>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Supply Chain Network"
        description="Interactive visual map of trading counterparties, financial dependencies, and risk exposure."
        actions={
          <div className="flex items-center gap-2">
            {/* View Switcher for Mobile: Graph vs Topology List */}
            <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40">
              <Button
                variant={displayType === "graph" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5"
                onClick={() => setDisplayType("graph")}
              >
                <Network className="size-3.5" />
                <span className="hidden xs:inline">Map</span>
              </Button>
              <Button
                variant={displayType === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5"
                onClick={() => setDisplayType("list")}
              >
                <Layers className="size-3.5" />
                <span className="hidden xs:inline">Topology</span>
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => netQuery.refetch()}
              disabled={netQuery.isFetching}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={netQuery.isFetching ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        }
      />

      {/* Control Panel Header */}
      <Card className="p-3.5 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
          <div>
            <Label htmlFor="net-view" className="text-muted-foreground mb-1 block text-xs">Network View</Label>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as NetworkView)}>
              <SelectTrigger id="net-view" className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RISK">Risk Levels</SelectItem>
                <SelectItem value="EXPOSURE">Financial Exposure</SelectItem>
                <SelectItem value="IMPACT">Cascade Impact</SelectItem>
                <SelectItem value="NETWORK">Relationship Map</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="net-search" className="text-muted-foreground mb-1 block text-xs">Search Firm</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                id="net-search"
                placeholder="Firm name or ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="net-risk" className="text-muted-foreground mb-1 block text-xs">Risk Filter</Label>
            <Select value={risk} onValueChange={(v) => setRisk(v as RiskLevel | "ALL")}>
              <SelectTrigger id="net-risk" className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISKS.map((r) => (
                  <SelectItem key={r} value={r}>{r === "ALL" ? "All risk levels" : r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="net-industry" className="text-muted-foreground mb-1 block text-xs">Industry Filter</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger id="net-industry" className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All industries</SelectItem>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toggle Switches - Clean 2-column on mobile */}
          <div className="flex items-center justify-between sm:justify-start gap-4 col-span-full sm:col-span-2 lg:col-span-2 pt-1">
            <div className="flex items-center gap-2">
              <Switch id="isolate-toggle" checked={isolate} onCheckedChange={setIsolate} />
              <Label htmlFor="isolate-toggle" className="text-xs cursor-pointer font-medium">Focus Firm</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="active-toggle" checked={activeOnly} onCheckedChange={setActiveOnly} />
              <Label htmlFor="active-toggle" className="text-xs cursor-pointer font-medium">Active Only</Label>
            </div>
          </div>
        </div>
      </Card>

      {/* Main View Display */}
      {displayType === "graph" ? (
        <div className="grid gap-6 lg:grid-cols-4 items-start">
          <div className={`space-y-3 ${selectedNode ? "lg:col-span-3" : "lg:col-span-4"}`}>
            <div className="hidden sm:flex justify-end">
              <div className="w-full sm:max-w-md">
                <NetworkLegend />
              </div>
            </div>
            <NetworkGraph
              nodes={filteredNodes}
              edges={edges}
              view={viewMode}
              selectedId={selectedId}
              onSelect={setSelectedId}
              isolate={isolate}
              activeOnly={activeOnly}
            />
          </div>

          {/* Desktop Selected Node Sidebar */}
          {selectedNode && (
            <Card className="hidden lg:flex p-5 lg:col-span-1 border-primary/40 flex-col max-h-[620px] overflow-y-auto sticky top-20 shadow-md">
              {renderDetailContent()}
            </Card>
          )}

          {/* Mobile Bottom Sheet Overlay for Selected Node */}
          {selectedNode && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-background/70 backdrop-blur-sm pointer-events-auto transition-opacity"
                onClick={() => setSelectedId(null)}
              />
              {/* Sheet container */}
              <Card className="relative pointer-events-auto z-10 w-full max-h-[80vh] overflow-y-auto rounded-t-2xl rounded-b-none border-t border-x border-border/80 p-4 pb-8 shadow-2xl bg-card">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
                {renderDetailContent()}
              </Card>
            </div>
          )}
        </div>
      ) : (
        /* Alternative Topology Matrix/List View - Optimized for Small Devices */
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-semibold text-sm">Counterparty Directory & Topology</h3>
              <p className="text-xs text-muted-foreground">{filteredNodes.length} counterparties in scope</p>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredNodes.map((n) => {
              const isSelected = selectedId === n.id;
              return (
                <div
                  key={n.id}
                  onClick={() => setSelectedId(isSelected ? null : n.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/70 hover:border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate">
                      <span className="font-mono text-[10px] text-muted-foreground">{n.id}</span>
                      <h4 className="font-medium text-xs truncate text-foreground">{formatCompanyName(n.name, n.id)}</h4>
                      <p className="text-[11px] text-muted-foreground capitalize">{n.role.toLowerCase()} · {n.industry}</p>
                    </div>
                    <RiskBadge level={n.riskLevel} score={n.riskScore} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                    <span className="text-muted-foreground">Exposure</span>
                    <span className="font-mono font-semibold">{formatINR(n.exposure)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
