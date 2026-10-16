import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  Maximize2,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/badges";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { NetworkGraph, type NetworkView } from "@/components/network/NetworkGraph";
import { NetworkLegend } from "@/components/network/NetworkLegend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { decisionNetworkService } from "@/services/decisionServices";
import type { CandidateAction, DecisionNetworkOverview, DecisionNodeContext, DecisionSimulationResult, RiskLevel } from "@/types";
import { formatCompanyName, formatINR } from "@/utils/format";

const ACTION_LABELS: Record<string, string> = {
  COLLECTION_PRIORITIZATION: "Collection Prioritization",
  DELAYED_PAYMENT_FOLLOWUP: "Delayed Payment Follow-up",
  ALTERNATE_SUPPLIER: "Alternate Supplier Qualification",
  CONCENTRATION_REDUCTION: "Supplier Concentration Reduction",
  INVENTORY_BUFFER: "Emergency Inventory Buffer",
  DEADLOCK_INVESTIGATION: "Circular Deadlock Resolution",
  TRANSACTION_RISK_REVIEW: "Forensic Credit & Risk Review",
};

export function DecisionNetworkPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedFirmId, setSelectedFirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("actions");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "ALL">("ALL");
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<NetworkView>("RISK");

  // Simulation & Review Modals State
  const [simulatingAction, setSimulatingAction] = useState<CandidateAction | null>(null);
  const [simulationResult, setSimulationResult] = useState<DecisionSimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const [reviewingAction, setReviewingAction] = useState<CandidateAction | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "REJECTED" | "DEFERRED">("APPROVED");
  const [reviewReason, setReviewReason] = useState("");

  // Query: Main Decision Network Overview
  const overviewQuery = useQuery({
    queryKey: ["decisionNetwork"],
    queryFn: decisionNetworkService.getOverview,
  });

  // Query: Selected Firm Decision Context
  const nodeContextQuery = useQuery({
    queryKey: ["decisionNodeContext", selectedFirmId],
    queryFn: () => (selectedFirmId ? decisionNetworkService.getNodeContext(selectedFirmId) : null),
    enabled: Boolean(selectedFirmId),
  });

  // Mutation: Trigger Re-evaluation Run
  const evaluateMutation = useMutation({
    mutationFn: decisionNetworkService.createRun,
    onSuccess: () => {
      toast.success("Decision Network re-evaluated successfully");
      queryClient.invalidateQueries({ queryKey: ["decisionNetwork"] });
      if (selectedFirmId) {
        queryClient.invalidateQueries({ queryKey: ["decisionNodeContext", selectedFirmId] });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to re-evaluate Decision Network");
    },
  });

  // Mutation: Record Review
  const reviewMutation = useMutation({
    mutationFn: (params: { actionId: string; decision: "APPROVED" | "REJECTED" | "DEFERRED"; reason?: string }) =>
      decisionNetworkService.reviewOption(params.actionId, params.decision, params.reason),
    onSuccess: (data) => {
      toast.success(`Candidate action marked as ${data.action.status}`);
      setReviewingAction(null);
      setReviewReason("");
      queryClient.invalidateQueries({ queryKey: ["decisionNetwork"] });
      if (selectedFirmId) {
        queryClient.invalidateQueries({ queryKey: ["decisionNodeContext", selectedFirmId] });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record decision review");
    },
  });

  const handleSimulate = async (action: CandidateAction) => {
    setSimulatingAction(action);
    setSimulationResult(null);
    setIsSimulating(true);
    try {
      const runId = overviewQuery.data?.latestRun?.id || "default-run";
      const res = await decisionNetworkService.simulateAction(runId, action.id);
      setSimulationResult(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to run scenario simulation for this action");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleOpenReview = (action: CandidateAction) => {
    setReviewingAction(action);
    setReviewDecision("APPROVED");
    setReviewReason("");
  };

  const handleSubmitReview = () => {
    if (!reviewingAction) return;
    const payload: { actionId: string; decision: "APPROVED" | "REJECTED" | "DEFERRED"; reason?: string } = {
      actionId: reviewingAction.id,
      decision: reviewDecision,
    };
    if (reviewReason.trim()) {
      payload.reason = reviewReason.trim();
    }
    reviewMutation.mutate(payload);
  };

  if (overviewQuery.isLoading) {
    return <CardsSkeleton count={6} />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        title="Could not load Decision Network"
        description="An error occurred while building the supply chain decision graph and evaluating risk interventions."
        onRetry={() => overviewQuery.refetch()}
      />
    );
  }

  const { network, metrics, latestRun, candidateActions, recentReviews } = overviewQuery.data;

  // Empty state check
  if (network.nodes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Decision Network"
          description="Actionable decision-support workflow connecting supply chain risk evidence to ranked interventions, what-if simulations, and role-based reviews."
        />
        <EmptyState
          title="No Decision Network Data Available"
          description="The Decision Network requires active counterparty records, transactions, or supply-chain relationships to evaluate risk drivers and recommend interventions."
          actionLabel="Upload Transactions"
          onAction={() => (window.location.href = "/app/upload")}
          icon={<Network className="size-6 text-muted-foreground" />}
        />
      </div>
    );
  }

  // Filtered nodes for the interactive graph
  const filteredNodes = network.nodes.filter((n) => {
    if (selectedFirmId && n.id === selectedFirmId) return true;
    if (riskFilter !== "ALL" && n.riskLevel !== riskFilter) return false;
    const cleanName = formatCompanyName(n.name, n.id).toLowerCase();
    const term = search.trim().toLowerCase();
    if (term && !cleanName.includes(term) && !n.id.toLowerCase().includes(term)) return false;
    return true;
  });

  // Filtered candidate actions
  const filteredActions = candidateActions.filter((a) => {
    if (selectedFirmId && a.firmId !== selectedFirmId) return false;
    if (actionTypeFilter !== "ALL" && a.actionType !== actionTypeFilter) return false;
    if (riskFilter !== "ALL" && a.priority !== riskFilter) return false;
    const term = search.trim().toLowerCase();
    if (term) {
      const matchTitle = a.title.toLowerCase().includes(term);
      const matchFirm = a.firmName.toLowerCase().includes(term);
      if (!matchTitle && !matchFirm) return false;
    }
    return true;
  });

  const selectedNode = selectedFirmId ? network.nodes.find((n) => n.id === selectedFirmId) : null;
  const isViewer = user?.role === "VIEWER";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Decision Network"
        description="Actionable decision-support workflow connecting supply chain risk evidence to ranked interventions, what-if simulations, and role-based reviews."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
            >
              <RefreshCw className={`mr-2 size-4 ${evaluateMutation.isPending ? "animate-spin" : ""}`} />
              Re-evaluate Network
            </Button>
          </div>
        }
      />

      {/* Section A: Decision Overview KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">High-Risk Entities</CardDescription>
            <CardTitle className="text-2xl font-bold text-rose-500">{metrics.highRiskFirmsCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Firms with High/Critical default or payment risk
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Critical Dependencies</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-500">{metrics.criticalDependenciesCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sole-source or high-criticality supply chain links
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Candidate Interventions</CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">
              {metrics.pendingActionsCount}
              <span className="text-sm font-normal text-muted-foreground"> / {metrics.candidateActionsCount}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Actions awaiting human review & evaluation
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Total Network Exposure</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">{formatINR(metrics.totalNetworkExposure)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Combined active receivable and delivery volume
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Est. Risk Reduction</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-500">
              ~{metrics.estimatedRiskReduction}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Projected portfolio risk drop upon intervention
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[280px]">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter by company or counterparty..."
              className="pl-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={riskFilter} onValueChange={(val: any) => setRiskFilter(val)}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Risk Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Risk Levels</SelectItem>
              <SelectItem value="CRITICAL">Critical Only</SelectItem>
              <SelectItem value="HIGH">High Only</SelectItem>
              <SelectItem value="MEDIUM">Medium Only</SelectItem>
              <SelectItem value="LOW">Low Only</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
            <SelectTrigger className="w-[180px] text-xs">
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Action Types</SelectItem>
              <SelectItem value="COLLECTION_PRIORITIZATION">Collection Prioritization</SelectItem>
              <SelectItem value="DELAYED_PAYMENT_FOLLOWUP">Payment Follow-up</SelectItem>
              <SelectItem value="ALTERNATE_SUPPLIER">Alternate Supplier</SelectItem>
              <SelectItem value="INVENTORY_BUFFER">Inventory Buffer</SelectItem>
              <SelectItem value="DEADLOCK_INVESTIGATION">Deadlock Resolution</SelectItem>
              <SelectItem value="TRANSACTION_RISK_REVIEW">Credit Risk Review</SelectItem>
            </SelectContent>
          </Select>

          {selectedFirmId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFirmId(null)}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear Node Filter ({formatCompanyName(selectedNode?.name || "", selectedFirmId)})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(val: any) => setViewMode(val)}>
            <SelectTrigger className="w-[130px] text-xs">
              <SelectValue placeholder="Graph View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RISK">View: Risk</SelectItem>
              <SelectItem value="EXPOSURE">View: Exposure</SelectItem>
              <SelectItem value="IMPACT">View: Impact</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Grid: Interactive Network Graph & Decision Context Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Section B: Interactive Network Explorer */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border/70 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/40 pb-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Network className="size-4 text-primary" />
                  Supply Chain Decision Graph
                </CardTitle>
                <CardDescription className="text-xs">
                  Click a firm node to inspect risk drivers, dependencies, and candidate actions.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{filteredNodes.length} nodes</span>
                <span>•</span>
                <span>{network.edges.length} edges</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative h-[480px] w-full bg-slate-950/20">
                <NetworkGraph
                  nodes={filteredNodes}
                  edges={network.edges}
                  view={viewMode}
                  selectedId={selectedFirmId}
                  onSelect={(id) => {
                    setSelectedFirmId(id);
                    if (id) setActiveTab("nodeContext");
                  }}
                  className="h-full w-full"
                />
                <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-md rounded-md p-2 border border-border/60 text-xs">
                  <NetworkLegend />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Algorithm & Rule Version Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <Info className="size-3.5" />
              Engine: <strong className="text-foreground">{latestRun?.algorithmVersion || "v1.0-deterministic"}</strong>
            </span>
            <span>
              Evaluated:{" "}
              {latestRun?.evaluatedAt ? new Date(latestRun.evaluatedAt).toLocaleString() : "Live Dynamic"}
            </span>
          </div>
        </div>

        {/* Section C, D, E: Decision Details, Actions & Simulations Panel */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/70 flex flex-col h-[550px]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="border-b border-border/40 px-4 pt-3">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="actions" className="text-xs">
                    Actions ({filteredActions.length})
                  </TabsTrigger>
                  <TabsTrigger value="nodeContext" className="text-xs">
                    Node Context {selectedFirmId ? "•" : ""}
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="text-xs">
                    Audit Trail
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab 1: Recommended Actions List (Ranked) */}
              <TabsContent value="actions" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
                {filteredActions.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-500 opacity-80" />
                    <p className="text-sm font-medium text-foreground">No candidate actions matching filters</p>
                    <p className="text-xs mt-1">Clear filters or select another firm node to inspect actions.</p>
                  </div>
                ) : (
                  filteredActions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-lg border border-border/70 bg-card/40 p-3.5 hover:bg-card/70 transition-colors space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <RiskBadge level={action.priority} />
                            <Badge variant="outline" className="text-[10px] font-mono">
                              Score: {action.score}
                            </Badge>
                            {action.status !== "PENDING_REVIEW" && (
                              <Badge
                                variant={action.status === "APPROVED" ? "default" : "secondary"}
                                className="text-[10px]"
                              >
                                {action.status}
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-foreground mt-1.5 leading-snug">
                            {action.title}
                          </h4>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {action.explanation}
                      </p>

                      {/* Evidence Pill Tags */}
                      {action.evidence && action.evidence.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {action.evidence.map((ev, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground border border-border/40"
                            >
                              <span className="font-semibold text-foreground">{ev.metric}:</span> {ev.value}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground">
                          {action.estimatedCost ? `Est. Cost: ${formatINR(action.estimatedCost)}` : "Operational protocol"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {action.isSimulatable && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleSimulate(action)}
                            >
                              <Activity className="size-3 mr-1 text-primary" /> Simulate
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleOpenReview(action)}
                          >
                            Review
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Tab 2: Selected Node Decision Context */}
              <TabsContent value="nodeContext" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
                {!selectedFirmId ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Compass className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Select a firm in the graph</p>
                    <p className="text-xs mt-1">Click any counterparty or supplier node to inspect its evidence profile.</p>
                  </div>
                ) : nodeContextQuery.isLoading ? (
                  <CardsSkeleton count={2} />
                ) : !nodeContextQuery.data ? (
                  <p className="text-xs text-muted-foreground">Could not load firm decision context.</p>
                ) : (
                  <div className="space-y-4">
                    {/* Node Header */}
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground">
                          {formatCompanyName(nodeContextQuery.data.firm.name, nodeContextQuery.data.firm.id)}
                        </h3>
                        <RiskBadge level={nodeContextQuery.data.firm.riskLevel} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Risk Score:</span>{" "}
                          <strong className="text-foreground">{nodeContextQuery.data.firm.riskScore}/100</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Outstanding:</span>{" "}
                          <strong className="text-foreground">{formatINR(nodeContextQuery.data.firm.outstandingAmount)}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Payment Delay:</span>{" "}
                          <strong className="text-foreground">{nodeContextQuery.data.firm.avgPaymentDelayDays} days</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cash Buffer:</span>{" "}
                          <strong className="text-foreground">{nodeContextQuery.data.firm.cashBufferDays} days</strong>
                        </div>
                      </div>
                    </div>

                    {/* Connected Counterparties */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Connected Counterparties ({nodeContextQuery.data.connectedFirms.length})
                      </h4>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {nodeContextQuery.data.connectedFirms.map((conn, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded border border-border/40 p-2 text-xs bg-card/40"
                          >
                            <span className="truncate max-w-[180px] font-medium text-foreground">
                              {conn.counterpartyName}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px]">
                                {conn.direction === "OUTGOING" ? "Supplies To" : "Procures From"}
                              </Badge>
                              <Badge
                                variant={conn.criticality === "CRITICAL" ? "destructive" : "secondary"}
                                className="text-[10px]"
                              >
                                {conn.criticality}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Candidate Interventions for this node */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Specific Actions for {nodeContextQuery.data.firm.name} ({nodeContextQuery.data.candidateActions.length})
                      </h4>
                      <div className="space-y-2">
                        {nodeContextQuery.data.candidateActions.map((act) => (
                          <div key={act.id} className="rounded border border-border/50 p-2 text-xs bg-muted/20">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground truncate max-w-[220px]">{act.title}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2"
                                onClick={() => handleOpenReview(act)}
                              >
                                Review
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Tab 3: Review Audit Trail */}
              <TabsContent value="reviews" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-xs font-semibold text-foreground">Decision Review History</span>
                  <span className="text-[11px] text-muted-foreground">{recentReviews.length} records</span>
                </div>
                {recentReviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No decisions recorded yet. Reviews will appear here after approval or rejection.
                  </p>
                ) : (
                  recentReviews.map((rev) => (
                    <div key={rev.id} className="rounded-lg border border-border/50 p-2.5 text-xs bg-muted/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground truncate max-w-[180px]">
                          {rev.actionTitle || rev.actionId}
                        </span>
                        <Badge
                          variant={
                            rev.decision === "APPROVED"
                              ? "default"
                              : rev.decision === "REJECTED"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {rev.decision}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Reviewer: {rev.reviewerName}</span>
                        <span>{new Date(rev.reviewedAt).toLocaleString()}</span>
                      </div>
                      {rev.reason && <p className="text-[11px] text-foreground/80 italic mt-1">"{rev.reason}"</p>}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Section E: Decision Comparison & What-If Simulation Dialog */}
      <Dialog open={Boolean(simulatingAction)} onOpenChange={(open) => !open && setSimulatingAction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="size-4 text-primary" />
              What-If Scenario Simulation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Comparing baseline supply-chain risk against the proposed intervention scenario.
            </DialogDescription>
          </DialogHeader>

          {isSimulating ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="size-6 animate-spin mx-auto text-primary" />
              <p className="text-sm font-medium">Computing cascade risk propagation...</p>
            </div>
          ) : !simulationResult ? (
            <p className="text-xs text-muted-foreground">No simulation data returned.</p>
          ) : !simulationResult.isSimulatable ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold">
                <AlertCircle className="size-4" />
                Action Not Quantitatively Simulatable
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {simulationResult.reason ||
                  "This action type involves qualitative vendor qualification or external contracting. Cascade impact cannot be quantitatively projected until counterparty operational profiles are integrated."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded border border-border/60 bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground">Target Action:</span>
                <h4 className="text-sm font-bold text-foreground mt-0.5">{simulationResult.actionTitle}</h4>
              </div>

              {/* Baseline vs Scenario Metrics Table */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/70 p-3 space-y-2 bg-card/60">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Current Baseline
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Loss:</span>
                      <strong className="text-foreground">{formatINR(simulationResult.baselineState?.expectedLoss || 0)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cascade Probability:</span>
                      <strong className="text-foreground">{simulationResult.baselineState?.cascadeProbability}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Potential Defaults:</span>
                      <strong className="text-foreground">{simulationResult.baselineState?.potentialDefaults} nodes</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recovery Days:</span>
                      <strong className="text-foreground">{simulationResult.baselineState?.recoveryDays} days</strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
                    Post-Intervention Scenario
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Loss:</span>
                      <strong className="text-emerald-500">{formatINR(simulationResult.simulatedState?.expectedLoss || 0)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cascade Probability:</span>
                      <strong className="text-emerald-500">{simulationResult.simulatedState?.cascadeProbability}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Potential Defaults:</span>
                      <strong className="text-emerald-500">{simulationResult.simulatedState?.potentialDefaults} nodes</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recovery Days:</span>
                      <strong className="text-emerald-500">{simulationResult.simulatedState?.recoveryDays} days</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Projected Benefits Summary */}
              {simulationResult.projectedImpact && (
                <div className="rounded-lg border border-border/70 p-3 bg-card/60 flex items-center justify-around text-center text-xs">
                  <div>
                    <span className="text-muted-foreground block">Loss Reduction</span>
                    <strong className="text-sm text-emerald-500">
                      -{formatINR(simulationResult.projectedImpact.expectedLossReduction)} (
                      {simulationResult.projectedImpact.expectedLossReductionPercentage}%)
                    </strong>
                  </div>
                  <div className="h-8 w-px bg-border/60" />
                  <div>
                    <span className="text-muted-foreground block">Cascade Risk Drop</span>
                    <strong className="text-sm text-emerald-500">
                      -{simulationResult.projectedImpact.cascadeProbabilityReduction} pts
                    </strong>
                  </div>
                  <div className="h-8 w-px bg-border/60" />
                  <div>
                    <span className="text-muted-foreground block">Residual Risk</span>
                    <strong className="text-sm text-foreground">
                      {simulationResult.projectedImpact.residualRiskScore} / 100
                    </strong>
                  </div>
                </div>
              )}

              {/* Assumptions & Disclaimer */}
              <div className="rounded bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Assumptions & Limitations:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {(simulationResult.assumptions || []).map((asmp, i) => (
                    <li key={i}>{asmp}</li>
                  ))}
                  <li>{simulationResult.disclaimer}</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSimulatingAction(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section F: Decision Review Modal */}
      <Dialog open={Boolean(reviewingAction)} onOpenChange={(open) => !open && setReviewingAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              Review Candidate Action
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record a formal workflow decision for this proposed risk intervention.
            </DialogDescription>
          </DialogHeader>

          {reviewingAction && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1">
                <span className="text-muted-foreground font-medium">Proposed Action:</span>
                <h4 className="font-semibold text-foreground">{reviewingAction.title}</h4>
                <div className="flex items-center gap-2 pt-1">
                  <RiskBadge level={reviewingAction.priority} />
                  <span className="text-[11px] text-muted-foreground">Target: {reviewingAction.firmName}</span>
                </div>
              </div>

              {isViewer ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
                  <ShieldAlert className="size-4 inline mr-1.5" />
                  <strong>Read-Only Access:</strong> Role <em>Executive (Viewer)</em> cannot record review decisions.
                  Please consult an SME Admin or Risk Analyst.
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div>
                    <Label className="text-xs font-medium">Decision</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={reviewDecision === "APPROVED" ? "default" : "outline"}
                        className="text-xs"
                        onClick={() => setReviewDecision("APPROVED")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={reviewDecision === "DEFERRED" ? "default" : "outline"}
                        className="text-xs"
                        onClick={() => setReviewDecision("DEFERRED")}
                      >
                        Defer
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={reviewDecision === "REJECTED" ? "destructive" : "outline"}
                        className="text-xs"
                        onClick={() => setReviewDecision("REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="reviewReason" className="text-xs font-medium">
                      Review Reason / Operational Notes (Optional)
                    </Label>
                    <Textarea
                      id="reviewReason"
                      placeholder="Add justification, operational constraints, or next steps..."
                      className="mt-1 text-xs"
                      rows={3}
                      value={reviewReason}
                      onChange={(e) => setReviewReason(e.target.value)}
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground italic">
                    Human workflow approval only. Does not execute autonomous payments, alter orders, or modify ledger records.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReviewingAction(null)}>
              Cancel
            </Button>
            {!isViewer && (
              <Button
                size="sm"
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending}
              >
                {reviewMutation.isPending ? "Submitting..." : "Confirm Review"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
