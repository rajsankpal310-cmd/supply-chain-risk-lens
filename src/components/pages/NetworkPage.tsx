import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, Building2, Filter, Network, RefreshCw, Search, Table2, X } from "lucide-react";
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

const RISKS: (RiskLevel | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function NetworkPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<NetworkView>("RISK");
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supply Chain Network"
        description="Interactive visual map of trading counterparties, financial dependencies, and risk exposure."
        actions={
          <Button variant="outline" onClick={() => netQuery.refetch()} disabled={netQuery.isFetching}>
            <RefreshCw className={netQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
            Refresh Network
          </Button>
        }
      />

      {/* Control Panel Header */}
      <Card className="gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 items-center">
          <div>
            <Label htmlFor="net-view" className="text-muted-foreground mb-1 block text-xs">Network View</Label>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as NetworkView)}>
              <SelectTrigger id="net-view"><SelectValue /></SelectTrigger>
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
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="net-risk" className="text-muted-foreground mb-1 block text-xs">Risk Filter</Label>
            <Select value={risk} onValueChange={(v) => setRisk(v as RiskLevel | "ALL")}>
              <SelectTrigger id="net-risk"><SelectValue /></SelectTrigger>
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
              <SelectTrigger id="net-industry"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All industries</SelectItem>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-2 lg:pt-0">
            <Switch id="isolate-toggle" checked={isolate} onCheckedChange={setIsolate} />
            <Label htmlFor="isolate-toggle" className="text-xs cursor-pointer">Focus Firm</Label>
          </div>

          <div className="flex items-center gap-2 pt-2 lg:pt-0">
            <Switch id="active-toggle" checked={activeOnly} onCheckedChange={setActiveOnly} />
            <Label htmlFor="active-toggle" className="text-xs cursor-pointer">Active Obligations</Label>
          </div>
        </div>
      </Card>

      {/* Main Network Graph Canvas & Detail Panel Grid */}
      <div className="grid gap-6 lg:grid-cols-4">
        <div className={`space-y-3 ${selectedNode ? "lg:col-span-3" : "lg:col-span-4"}`}>
          <div className="flex justify-end">
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
            height={580}
          />
        </div>

        {/* Selected Node Drawer / Detail Card */}
        {selectedNode && (
          <Card className="p-5 space-y-4 lg:col-span-1 border-primary/40 flex flex-col max-h-[620px] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground font-mono text-xs">{selectedNode.id}</p>
                <h3 className="font-semibold text-base leading-tight">
                  {formatCompanyName(selectedNode.name, selectedFirm?.name, selectedNode.id)}
                </h3>
                <p className="text-muted-foreground text-xs capitalize">{selectedNode.role.toLowerCase()} · {selectedNode.industry}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between border-y py-2.5">
              <span className="text-xs text-muted-foreground">Risk Rating</span>
              <RiskBadge level={selectedNode.riskLevel} score={selectedNode.riskScore} />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Exposure:</span>
                <span className="font-mono font-semibold">{formatINR(selectedNode.exposure)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding Obligation:</span>
                <span className="font-mono font-semibold text-amber-500">
                  {formatINR(selectedNode.outstandingAmount ?? selectedNode.exposure)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Payment Delay:</span>
                <span className="font-mono font-semibold">{selectedNode.avgPaymentDelayDays ?? 0} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Relationships:</span>
                <span className="font-mono font-semibold">{selectedNode.activeRelationshipsCount ?? counterparties.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transactions (Act/Done):</span>
                <span className="font-mono font-semibold">
                  {selectedNode.activeTransactionsCount ?? "-"}/{selectedNode.completedTransactionsCount ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cascade Impact:</span>
                <span className="font-mono font-semibold">{selectedNode.impact}%</span>
              </div>
              {selectedFirm && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Financial Stress:</span>
                    <span className="font-mono font-semibold">{selectedFirm.financialStress}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cash Buffer:</span>
                    <span className="font-mono font-semibold">{selectedFirm.cashBufferDays} days</span>
                  </div>
                </>
              )}
            </div>

            {/* Connected Counterparties List */}
            {counterparties.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Connected Counterparties</span>
                  <span className="text-[10px] text-muted-foreground font-normal">({counterparties.length})</span>
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {counterparties.map((cp) => (
                    <div
                      key={cp.counterpartyId}
                      className="flex items-center justify-between rounded p-1.5 text-[11px] hover:bg-accent/40 cursor-pointer transition-colors"
                      onClick={() => setSelectedId(cp.counterpartyId)}
                    >
                      <div className="truncate pr-1">
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

            <div className="space-y-2 pt-2 border-t mt-auto">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-xs"
                size="sm"
                onClick={() => navigate({ to: "/app/transactions" })}
              >
                <Table2 className="size-4 text-primary" /> View Related Invoices
              </Button>
              <Button className="w-full justify-start gap-2 text-xs" size="sm" onClick={() => navigate({ to: "/app/firms/$id", params: { id: selectedNode.id } })}>
                <Building2 className="size-4" /> Analyze Firm Profile
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-xs" size="sm" onClick={() => navigate({ to: "/app/simulator" })}>
                <Activity className="size-4" /> Simulate Shock
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
