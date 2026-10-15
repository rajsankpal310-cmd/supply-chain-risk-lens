import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Info, Loader2, Sliders, TrendingDown, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RiskBadge } from "@/components/common/badges";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { optimizationService } from "@/services/decisionServices";
import type { OptimizationRun } from "@/types";
import { formatINR } from "@/utils/format";

export function OptimizationPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [budget, setBudget] = useState<number>(1000000);
  const [runResult, setRunResult] = useState<OptimizationRun | null>(null);

  const optimizeMutation = useMutation({
    mutationFn: (budgetValue: number) => optimizationService.runOptimization(budgetValue),
    onSuccess: (result) => {
      setRunResult(result);
      toast.success("Support allocation optimization completed");
    },
    onError: () => toast.error("Optimization run failed"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (budget <= 0) {
      toast.error("Please enter a valid budget amount");
      return;
    }
    optimizeMutation.mutate(budget);
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Smart Budget Allocation"
          description="Allocate limited financial support or credit lines across connected firms to maximize risk reduction and minimize cascade contagion."
          actions={
            <Badge variant="outline" className="text-muted-foreground gap-1">
              <Info className="size-3" /> Decision-support model — results are indicative
            </Badge>
          }
        />
      )}

      {/* Budget Configuration Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Sliders className="text-primary size-5" />
            <h2 className="text-sm font-semibold">Mitigation Budget Configuration</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
            <div>
              <Label htmlFor="opt-budget" className="text-muted-foreground mb-1 block text-xs">Total Support Budget (INR)</Label>
              <Input
                id="opt-budget"
                type="number"
                step={100000}
                min={100000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Button type="button" variant="outline" size="sm" className="text-xs h-8 px-2 sm:px-3" onClick={() => setBudget(1000000)}>₹10 Lakhs</Button>
              <Button type="button" variant="outline" size="sm" className="text-xs h-8 px-2 sm:px-3" onClick={() => setBudget(2500000)}>₹25 Lakhs</Button>
              <Button type="button" variant="outline" size="sm" className="text-xs h-8 px-2 sm:px-3" onClick={() => setBudget(5000000)}>₹50 Lakhs</Button>
            </div>

            <div className="flex justify-end w-full md:w-auto">
              <Button type="submit" className="w-full md:w-auto gap-2" disabled={optimizeMutation.isPending}>
                {optimizeMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                {optimizeMutation.isPending ? "Solving Optimization..." : "Run Optimization"}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Optimization Results */}
      {runResult && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="text-risk-low size-5" />
              Optimization Allocation Results
            </h2>
            <span className="font-mono text-xs text-muted-foreground">Run ID: {runResult.id}</span>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Support Budget" value={formatINR(runResult.budget)} status="LOW" tooltip="Total allocated support budget" />
            <MetricCard label="Cascade Risk Before / After" value={`${runResult.cascadeRiskBefore}% → ${runResult.cascadeRiskAfter}%`} status="LOW" tooltip="Risk reduction score" />
            <MetricCard label="Expected Loss Before" value={formatINR(runResult.expectedLossBefore)} status="HIGH" tooltip="Total portfolio risk exposure before support" />
            <MetricCard label="Expected Loss After" value={formatINR(runResult.expectedLossAfter)} status="LOW" tooltip="Residual portfolio risk after support" />
          </section>

          {/* Allocation Table */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Allocated Support Breakdown ({runResult.allocations.filter((a) => a.allocated > 0).length} firms funded)</h3>
            <div className="border-border/70 overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firm Name</TableHead>
                    <TableHead className="text-right">Risk Score</TableHead>
                    <TableHead className="text-right">Required Support</TableHead>
                    <TableHead className="text-right">Allocated Amount</TableHead>
                    <TableHead className="text-right">Impact Reduction</TableHead>
                    <TableHead className="text-right">Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runResult.allocations.map((a) => (
                    <TableRow key={a.firmId}>
                      <TableCell className="font-medium">
                        <Link to="/app/firms/$id" params={{ id: a.firmId }} className="hover:text-primary">
                          {a.firmName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{a.risk}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatINR(a.requiredSupport)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-primary">{formatINR(a.allocated)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-risk-low">-{a.impactReduction}%</TableCell>
                      <TableCell className="text-right"><RiskBadge level={a.priority} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
