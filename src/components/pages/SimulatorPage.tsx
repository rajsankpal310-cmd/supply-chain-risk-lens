import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Activity, ArrowRight, CheckCircle2, Lightbulb, Loader2, Network, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RiskBadge } from "@/components/common/badges";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { firmService } from "@/services/dataServices";
import { SIMULATION_STAGES, simulationService } from "@/services/simulationServices";
import { SimulationHistoryPage } from "@/components/pages/SimulationHistoryPage";
import type { RiskLevel, ScenarioInput, ScenarioType, SimulationRun } from "@/types";
import { formatINR } from "@/utils/format";

const SCENARIO_TYPES: ScenarioType[] = [
  "BUYER_PAYMENT_DELAY",
  "SUPPLIER_FAILURE",
  "MAJOR_BUYER_LOSS",
  "CASH_FLOW_SHOCK",
  "NATURAL_DISASTER",
  "CUSTOM",
];

const SEVERITIES: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function SimulatorPage({ initialTab = "run" }: { initialTab?: "run" | "history" } = {}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"run" | "history">(initialTab);
  const firmsQuery = useQuery({ queryKey: ["firms"], queryFn: firmService.getFirms });

  const [affectedFirmId, setAffectedFirmId] = useState<string>("");
  const [scenarioType, setScenarioType] = useState<ScenarioType>("BUYER_PAYMENT_DELAY");
  const [severity, setSeverity] = useState<RiskLevel>("HIGH");
  const [delayDays, setDelayDays] = useState<number>(60);
  const [amount, setAmount] = useState<number>(5000000);
  const [durationDays, setDurationDays] = useState<number>(90);
  const [recoveryRate, setRecoveryRate] = useState<number>(45);

  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [simulationResult, setSimulationResult] = useState<SimulationRun | null>(null);

  const firms = firmsQuery.data ?? [];
  const activeFirmId = affectedFirmId || (firms[0]?.id ?? "FIRM-01");

  async function handleRunSimulation(e: React.FormEvent) {
    e.preventDefault();
    setIsSimulating(true);
    setCurrentStageIndex(0);
    setSimulationResult(null);

    const input: ScenarioInput = {
      name: `${scenarioType.replace(/_/g, " ")} Shock`,
      type: scenarioType,
      affectedFirmId: activeFirmId,
      delayDays: Number(delayDays),
      amount: Number(amount),
      severity,
      durationDays: Number(durationDays),
      recoveryRate: Number(recoveryRate),
    };

    try {
      const run = await simulationService.runSimulation(input, (stageIdx) => {
        setCurrentStageIndex(stageIdx);
      });
      setSimulationResult(run);
      toast.success("Simulation completed successfully");
    } catch (err: any) {
      const errorMsg =
        err?.message ||
        err?.error?.message ||
        (typeof err === "string" ? err : "Simulation run failed");
      toast.error(errorMsg);
    } finally {
      setIsSimulating(false);
    }
  }

  function resetForm() {
    setSimulationResult(null);
    setIsSimulating(false);
    setCurrentStageIndex(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scenario Simulator"
        description="Simulate 'What happens if...' stress events to assess counterparty impact and supply chain ripple effects."
      />

      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={activeTab === "run" ? "default" : "outline"}
          size="sm"
          className="text-xs font-semibold"
          onClick={() => setActiveTab("run")}
        >
          Run Scenario
        </Button>
        <Button
          variant={activeTab === "history" ? "default" : "outline"}
          size="sm"
          className="text-xs font-semibold"
          onClick={() => setActiveTab("history")}
        >
          Past Simulations
        </Button>
      </div>

      {activeTab === "history" ? (
        <SimulationHistoryPage embedded={true} onRunNew={() => setActiveTab("run")} />
      ) : firms.length === 0 ? (
        <Card className="p-12 text-center">
          <Activity className="mx-auto size-10 text-muted-foreground/60 mb-3" />
          <h3 className="font-semibold text-lg">No Counterparties Available</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Upload transaction data to run counterparty stress scenarios and analyze ripple effects.
          </p>
          <Button className="mt-4" onClick={() => navigate({ to: "/app/upload" })}>
            Upload Data
          </Button>
        </Card>
      ) : !simulationResult && !isSimulating && (
        <>
          {/* Conversational What-If Framing */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-1">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              Scenario Question
            </p>
            <p className="text-sm font-semibold text-foreground">
              "What happens if {firms.find((f) => f.id === activeFirmId)?.name || "a counterparty"} experiences a {scenarioType.replace(/_/g, " ").toLowerCase()} of {delayDays} days on an obligation of {formatINR(amount)}?"
            </p>
            <p className="text-xs text-muted-foreground">
              Adjust parameters below to project potential ripple effects across your supply chain network.
            </p>
          </div>

          <Card className="p-6">
            <form onSubmit={handleRunSimulation} className="space-y-6">
              <div className="flex items-center gap-2 border-b pb-3">
                <Activity className="text-primary size-5" />
                <h2 className="text-sm font-semibold">Scenario Parameters</h2>
              </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="sim-firm" className="text-muted-foreground mb-1 block text-xs">Target Company</Label>
                <Select value={activeFirmId} onValueChange={setAffectedFirmId}>
                  <SelectTrigger id="sim-firm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {firms.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name} ({f.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sim-type" className="text-muted-foreground mb-1 block text-xs">What-If Scenario Type</Label>
                <Select value={scenarioType} onValueChange={(v) => setScenarioType(v as ScenarioType)}>
                  <SelectTrigger id="sim-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCENARIO_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sim-severity" className="text-muted-foreground mb-1 block text-xs">Severity Level</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as RiskLevel)}>
                  <SelectTrigger id="sim-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sim-delay" className="text-muted-foreground mb-1 block text-xs">Expected Payment Delay (Days)</Label>
                <Input id="sim-delay" type="number" min={0} max={365} value={delayDays} onChange={(e) => setDelayDays(Number(e.target.value))} />
              </div>

              <div>
                <Label htmlFor="sim-amount" className="text-muted-foreground mb-1 block text-xs">Exposure Amount (₹)</Label>
                <Input id="sim-amount" type="number" step={100000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </div>

              <div>
                <Label htmlFor="sim-duration" className="text-muted-foreground mb-1 block text-xs">Disruption Duration (Days)</Label>
                <Input id="sim-duration" type="number" min={1} max={365} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
              </div>

              <div>
                <Label htmlFor="sim-recovery" className="text-muted-foreground mb-1 block text-xs">Estimated Recovery (%)</Label>
                <Input id="sim-recovery" type="number" min={0} max={100} value={recoveryRate} onChange={(e) => setRecoveryRate(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex justify-end border-t pt-4">
              <Button type="submit" size="lg" className="gap-2">
                <Play className="size-4" /> Run What-If Simulation
              </Button>
            </div>
          </form>
        </Card>
        </>
      )}

      {/* Simulation In-Progress State */}
      {isSimulating && (
        <Card className="p-10 text-center space-y-6">
          <Loader2 className="text-primary mx-auto size-12 animate-spin" />
          <div>
            <h2 className="text-lg font-semibold">Calculating Financial Ripple Effects...</h2>
            <p className="text-muted-foreground mt-1 text-sm">{SIMULATION_STAGES[currentStageIndex]}</p>
          </div>
          <div className="mx-auto max-w-md space-y-2">
            <Progress value={Math.round(((currentStageIndex + 1) / SIMULATION_STAGES.length) * 100)} />
            <p className="font-mono text-xs text-muted-foreground">Stage {currentStageIndex + 1} of {SIMULATION_STAGES.length}</p>
          </div>
        </Card>
      )}

      {/* Simulation Result Output */}
      {simulationResult && (
        <div className="space-y-6">
          {/* Scenario Disclaimer Banner */}
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="font-medium">
              <strong>Hypothetical Simulation Scenario:</strong> Results are simulated stress projections under selected shock assumptions and do not modify live ledger records or actual invoice statuses.
            </span>
            <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/20 shrink-0">
              Simulated Projection
            </span>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="text-risk-low size-5" />
              Simulation Results — {simulationResult.id}
            </h2>
            <Button variant="outline" size="sm" onClick={resetForm} className="gap-2">
              <RotateCcw className="size-4" /> New Simulation
            </Button>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Cascade Risk Probability" value={`${simulationResult.result.cascadeProbability}%`} status="CRITICAL" tooltip="Probability of financial contagion spread" />
            <MetricCard label="Expected Financial Loss" value={formatINR(simulationResult.result.expectedLoss)} status="HIGH" tooltip="Total expected monetary loss" />
            <MetricCard label="Potential Defaults" value={`${simulationResult.result.potentialDefaults} firms`} status="HIGH" tooltip="Firms driven to default threshold" />
            <MetricCard label="Recovery Days" value={`${simulationResult.result.recoveryDays} days`} status="MEDIUM" tooltip="Estimated time to financial recovery" />
          </section>

          {/* Affected Firms Table */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Impacted Network Firms ({simulationResult.result.affectedFirms.length})</h3>
            <div className="border-border/70 overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hop Step</TableHead>
                    <TableHead>Firm Name</TableHead>
                    <TableHead className="text-right">Risk Before</TableHead>
                    <TableHead className="text-right">Risk After</TableHead>
                    <TableHead className="text-right">Modelled Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {simulationResult.result.affectedFirms.map((f) => (
                    <TableRow key={f.firmId}>
                      <TableCell className="font-mono text-xs">Hop {f.step}</TableCell>
                      <TableCell className="font-medium">{f.firmName}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{f.riskBefore}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-risk-high">{f.riskAfter}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatINR(f.loss)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Navigation Action Toolbar */}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate({ to: "/app/network" })} className="gap-2">
              <Network className="size-4" /> View Affected Network
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/app/recommendations" })} className="gap-2">
              <Lightbulb className="size-4" /> View Decision Recommendations
            </Button>
            <Button variant="outline" onClick={() => setActiveTab("history")} className="gap-2">
              View Past Simulations <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
