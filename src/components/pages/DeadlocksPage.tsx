import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Eye, GitBranch, Info, Lightbulb, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionConfirmDialog } from "@/components/common/ActionConfirmDialog";
import { RiskBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/PageHeader";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deadlockService } from "@/services/simulationServices";
import type { Deadlock } from "@/types";
import { formatDate, formatINR } from "@/utils/format";

export function DeadlocksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDeadlock, setSelectedDeadlock] = useState<Deadlock | null>(null);
  const [resolvingDeadlock, setResolvingDeadlock] = useState<Deadlock | null>(null);

  const deadlocksQuery = useQuery({ queryKey: ["deadlocks"], queryFn: deadlockService.getDeadlocks });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => deadlockService.resolveDeadlock(id),
    onSuccess: (updated) => {
      toast.success(`Deadlock ${updated.id} resolution applied`);
      queryClient.invalidateQueries({ queryKey: ["deadlocks"] });
      if (selectedDeadlock?.id === updated.id) setSelectedDeadlock(updated);
      setResolvingDeadlock(null);
    },
    onError: () => toast.error("Could not resolve deadlock"),
  });

  if (deadlocksQuery.isLoading) return <CardsSkeleton count={4} />;
  if (deadlocksQuery.isError || !deadlocksQuery.data)
    return <ErrorState title="Could not load Deadlocks" description="Error identifying circular exposure chains." onRetry={() => deadlocksQuery.refetch()} />;

  const deadlocks = deadlocksQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Deadlock Detection"
        description="Circular payment exposure chains where liquidity is locked between interconnected firms."
        actions={
          <Button variant="outline" onClick={() => deadlocksQuery.refetch()} disabled={deadlocksQuery.isFetching}>
            <RefreshCw className={deadlocksQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
            Refresh Analysis
          </Button>
        }
      />

      {/* Educational Concept Banner */}
      <div className="rounded-xl border border-border/80 bg-muted/30 p-4 flex items-start gap-3 text-xs">
        <Info className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground text-sm">
            What is a Financial Deadlock?
          </p>
          <p className="text-muted-foreground leading-relaxed">
            A deadlock occurs when a closed loop of obligations forms: <strong>Firm A owes Firm B, Firm B owes Firm C, and Firm C owes Firm A</strong>. In this cycle, cash stops moving because each entity waits for debtor funds before settling creditor liabilities. Resolving records an offset agreement.
          </p>
        </div>
      </div>

      {deadlocks.length === 0 ? (
        <EmptyState title="No financial deadlocks detected" description="All payment chains are operating without circular lockups." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {deadlocks.map((d) => (
            <Card key={d.id} className="p-5 space-y-4 border-border/70 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{d.id} · Detected {formatDate(d.detectedAt)}</span>
                    <h3 className="font-semibold text-base">{d.rootFirmName} Chain</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.resolved ? (
                      <Badge variant="outline" className="text-risk-low border-risk-low/40 bg-risk-low/10 gap-1">
                        <CheckCircle2 className="size-3" /> Resolved
                      </Badge>
                    ) : (
                      <RiskBadge level={d.severity} score={d.deadlockRisk} />
                    )}
                  </div>
                </div>

                {/* Circular Chain Visualization */}
                <div className="my-4 border-border/70 bg-muted/30 rounded-xl border p-3">
                  <p className="text-muted-foreground text-[11px] font-semibold mb-2 uppercase">Exposure Chain</p>
                  <div className="space-y-2">
                    {d.chain.map((step, idx) => (
                      <div key={step.firmId} className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate">{step.firmName}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-muted-foreground">owes</span>
                          <span className="font-semibold text-primary">{formatINR(step.owesAmount)}</span>
                          {idx < d.chain.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Total Chain Exposure:</span>
                    <p className="font-mono font-semibold text-sm">{formatINR(d.totalExposure)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estimated Impact:</span>
                    <p className="font-mono font-semibold text-sm">{formatINR(d.estimatedImpact)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between border-t pt-3 gap-1.5 sm:gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={() => setSelectedDeadlock(d)}>
                    <Eye className="size-3.5" /> Details
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={() => navigate({ to: "/app/recommendations" })}>
                    <Lightbulb className="size-3.5" /> Recs
                  </Button>
                </div>
                {!d.resolved && (
                  <Button size="sm" className="h-8 text-xs px-3" onClick={() => setResolvingDeadlock(d)} disabled={resolveMutation.isPending}>
                    Resolve
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Deadlock Detail Dialog */}
      <Dialog open={Boolean(selectedDeadlock)} onOpenChange={(open) => !open && setSelectedDeadlock(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="text-primary size-5" />
              Deadlock Analysis — {selectedDeadlock?.id}
            </DialogTitle>
            <DialogDescription>Detailed circular exposure breakdown and resolution mechanisms.</DialogDescription>
          </DialogHeader>

          {selectedDeadlock && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between text-sm border-b pb-3">
                <div>
                  <p className="text-muted-foreground text-xs">Root Firm</p>
                  <p className="font-semibold">{selectedDeadlock.rootFirmName}</p>
                </div>
                <RiskBadge level={selectedDeadlock.severity} score={selectedDeadlock.deadlockRisk} />
              </div>

              <div>
                <p className="text-xs font-semibold mb-2">Step-by-Step Chain Analysis</p>
                <div className="space-y-2">
                  {selectedDeadlock.chain.map((c, i) => (
                    <div key={c.firmId} className="border-border/70 flex items-center justify-between rounded-lg border p-2.5 text-xs">
                      <div>
                        <p className="font-medium">{c.firmName}</p>
                        <p className="text-muted-foreground text-[11px]">Financial Stress: {c.stress}%</p>
                      </div>
                      <p className="font-mono font-semibold text-primary">{formatINR(c.owesAmount)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                {!selectedDeadlock.resolved && (
                  <Button onClick={() => setResolvingDeadlock(selectedDeadlock)} disabled={resolveMutation.isPending}>
                    Execute Resolution Mechanism
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deadlock Resolution Consequence Confirmation */}
      <ActionConfirmDialog
        open={Boolean(resolvingDeadlock)}
        onOpenChange={(open) => !open && setResolvingDeadlock(null)}
        title={`Execute Deadlock Resolution for ${resolvingDeadlock?.id}?`}
        description="Are you sure you want to apply a multilateral settlement resolution to this circular dependency chain?"
        consequences={[
          "Records a multilateral offset agreement across all firms in the circular chain.",
          "Clears the artificial circular deadlock status in the supply chain network analysis.",
          "Underlying transaction records and ledger history remain completely preserved for audit.",
          "Recalculates locked liquidity metrics across the portfolio.",
        ]}
        confirmLabel="Execute Resolution"
        isLoading={resolveMutation.isPending}
        onConfirm={() => {
          if (resolvingDeadlock) resolveMutation.mutate(resolvingDeadlock.id);
        }}
      />
    </div>
  );
}
