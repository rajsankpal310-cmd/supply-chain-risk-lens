import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle, Info, Lightbulb, RefreshCw, Search, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ActionConfirmDialog } from "@/components/common/ActionConfirmDialog";
import { RiskBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/PageHeader";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recommendationService } from "@/services/decisionServices";
import { OptimizationPage } from "@/components/pages/OptimizationPage";
import type { Recommendation, RiskLevel } from "@/types";
import { formatINR } from "@/utils/format";

const PRIORITIES: (RiskLevel | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES = ["ALL", "OPEN", "ACCEPTED", "DISMISSED"] as const;

export function RecommendationsPage({
  initialTab = "recommendations",
}: {
  initialTab?: "recommendations" | "optimization";
} = {}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"recommendations" | "optimization">(initialTab);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<RiskLevel | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [confirmAction, setConfirmAction] = useState<{
    rec: Recommendation;
    status: "ACCEPTED" | "DISMISSED";
  } | null>(null);

  const recsQuery = useQuery({
    queryKey: ["recommendations"],
    queryFn: recommendationService.getRecommendations,
    placeholderData: keepPreviousData,
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Recommendation["status"] }) =>
      recommendationService.setStatus(id, status),
    onSuccess: (updated) => {
      toast.success(`Recommendation marked as ${updated.status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      setConfirmAction(null);
    },
    onError: () => toast.error("Could not update recommendation status"),
  });

  if (recsQuery.isLoading) return <CardsSkeleton count={6} />;
  if (recsQuery.isError || !recsQuery.data)
    return <ErrorState title="Could not load Recommendations" description="Error generating decision recommendations." onRetry={() => recsQuery.refetch()} />;

  const recs = recsQuery.data;

  const filteredRecs = recs.filter((r) => {
    if (priority !== "ALL" && r.priority !== priority) return false;
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      if (!r.title.toLowerCase().includes(term) && !r.firmName.toLowerCase().includes(term) && !r.reason.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision Support Recommendations"
        description="Prioritized financial resolution strategies, funding options, and supply chain risk mitigation steps."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-muted-foreground gap-1">
              <Info className="size-3" /> Decision support only — financial decisions are made by users
            </Badge>
            <Button variant="outline" onClick={() => recsQuery.refetch()} disabled={recsQuery.isFetching}>
              <RefreshCw className={recsQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={activeTab === "recommendations" ? "default" : "outline"}
          size="sm"
          className="text-xs font-semibold"
          onClick={() => setActiveTab("recommendations")}
        >
          Actionable Recommendations
        </Button>
        <Button
          variant={activeTab === "optimization" ? "default" : "outline"}
          size="sm"
          className="text-xs font-semibold"
          onClick={() => setActiveTab("optimization")}
        >
          Smart Budget Allocation
        </Button>
      </div>

      {activeTab === "optimization" ? (
        <OptimizationPage embedded={true} />
      ) : (
        <>
          <Card className="gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="rec-search" className="text-muted-foreground mb-1 block text-xs">Search</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                id="rec-search"
                placeholder="Search recommendation or firm…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="rec-priority" className="text-muted-foreground mb-1 block text-xs">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as RiskLevel | "ALL")}>
              <SelectTrigger id="rec-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p === "ALL" ? "All priorities" : p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="rec-status" className="text-muted-foreground mb-1 block text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="rec-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {filteredRecs.length === 0 ? (
        <EmptyState title="No recommendations match filters" description="Try clearing your search query or status filter." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRecs.map((r) => (
            <Card key={r.id} className="p-5 flex flex-col justify-between space-y-4 border-border/70">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="border-border bg-muted/50 rounded px-1.5 py-0.5 text-[10px] font-mono">{r.kind.replace(/_/g, " ")}</span>
                    <h3 className="font-semibold text-base mt-1">{r.title}</h3>
                    <Link to="/app/firms/$id" params={{ id: r.firmId }} className="text-xs text-primary font-medium hover:underline">
                      Firm: {r.firmName}
                    </Link>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <RiskBadge level={r.priority} />
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${r.status === "ACCEPTED" ? "bg-risk-low/15 text-risk-low" : r.status === "DISMISSED" ? "bg-muted text-muted-foreground" : "bg-amber-500/15 text-amber-600"}`}>
                      {r.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div><span className="text-muted-foreground font-medium">Risk Addressed:</span> {r.riskAddressed}</div>
                  <div><span className="text-muted-foreground font-medium">Rationale:</span> {r.reason}</div>
                  <div><span className="text-muted-foreground font-medium">Expected Impact:</span> {r.expectedImpact}</div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3 gap-2 text-xs">
                <span className="font-mono font-semibold text-primary">
                  {r.estimatedRequirement > 0 ? `${formatINR(r.estimatedRequirement)} required` : "No direct capital needed"}
                </span>

                <div className="flex items-center gap-2">
                  {r.status === "OPEN" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmAction({ rec: r, status: "DISMISSED" })}
                        disabled={setStatusMutation.isPending}
                        className="gap-1 text-xs"
                      >
                        <XCircle className="size-3.5" /> Dismiss
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setConfirmAction({ rec: r, status: "ACCEPTED" })}
                        disabled={setStatusMutation.isPending}
                        className="gap-1 text-xs"
                      >
                        <CheckCircle className="size-3.5" /> Accept
                      </Button>
                    </>
                  )}
                  {r.status !== "OPEN" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStatusMutation.mutate({ id: r.id, status: "OPEN" })}
                      className="text-xs"
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      </>
      )}

      {/* Decision Support Confirmation Dialog */}
      <ActionConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.status === "ACCEPTED"
            ? `Accept Recommendation: ${confirmAction?.rec.title}?`
            : `Dismiss Recommendation: ${confirmAction?.rec.title}?`
        }
        description={
          confirmAction?.status === "ACCEPTED"
            ? `Are you sure you want to adopt this financial intervention for ${confirmAction?.rec.firmName}?`
            : `Dismiss this recommendation from your active decision queue?`
        }
        consequences={
          confirmAction?.status === "ACCEPTED"
            ? [
                "Records your management decision in the compliance audit trail.",
                "NEXUS-CFR is a decision-support advisory system and does NOT execute real money transfers, loans, or bank transactions.",
                "Updates recommendation status to ACCEPTED.",
                "Preserves rationale and evidence in the decision audit history.",
              ]
            : [
                "Removes this recommendation from your active triage view.",
                "The recommendation can be reopened at any time.",
              ]
        }
        confirmLabel={confirmAction?.status === "ACCEPTED" ? "Confirm Decision" : "Dismiss Recommendation"}
        isLoading={setStatusMutation.isPending}
        onConfirm={() => {
          if (confirmAction) {
            setStatusMutation.mutate({ id: confirmAction.rec.id, status: confirmAction.status });
          }
        }}
      />
    </div>
  );
}
