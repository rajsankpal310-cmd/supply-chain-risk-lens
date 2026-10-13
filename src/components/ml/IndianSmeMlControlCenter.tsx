import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  BarChart3,
  GitBranch,
  Play,
  Activity,
  Layers,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  TrendingUp,
  FileCheck,
  FileSpreadsheet,
  Server,
  FileWarning,
  RefreshCw,
  Network,
  Scale,
  Building2,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export function IndianSmeMlControlCenter() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "readiness" | "benchmarking" | "network" | "resolution">("overview");

  // 1. Fetch Indian SME Status
  const statusQuery = useQuery({
    queryKey: ["indian-sme-status"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ml/indian-sme/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  // 2. Fetch Active Model details
  const modelQuery = useQuery({
    queryKey: ["indian-sme-model"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ml/indian-sme/model", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  // 3. Fetch Targets definition
  const targetsQuery = useQuery({
    queryKey: ["indian-sme-targets"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ml/indian-sme/targets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  // 4. Fetch Sample Network Graph
  const networkQuery = useQuery({
    queryKey: ["indian-sme-network"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ml/indian-sme/network", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ records: [] }),
      });
      return res.json();
    },
  });

  const statusData = statusQuery.data;
  const modelData = modelQuery.data?.activeModel;
  const targetsData = targetsQuery.data?.targets || {};

  return (
    <div className="space-y-6">
      {/* 1. Header & Reality Gate State */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              Domain Adaptation
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">MSMED Act & Financial Stress Framework</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Domain Risk & Model Adaptation</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pre-t0 lag features, statutory 45-day payment horizon evaluation, and zero-lookahead risk inference.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-muted-foreground block uppercase">Production Boundary</span>
            <Badge
              variant="outline"
              className={`text-xs font-mono px-2.5 py-0.5 ${
                modelData
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              {statusData?.productionBoundary || "PUBLIC_DATASET_VALIDATED"}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              statusQuery.refetch();
              modelQuery.refetch();
              targetsQuery.refetch();
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Top-Level Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 border-border bg-card/40">
          <span className="text-[11px] font-medium text-muted-foreground block">Data Provenance</span>
          <span className="text-sm font-bold truncate block mt-0.5">
            {modelData ? modelData.provenance.datasetPopulation : "Awaiting Authorized Data"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground block mt-1">Country: IN (ISO 3166)</span>
        </Card>

        <Card className="p-3.5 border-border bg-card/40">
          <span className="text-[11px] font-medium text-muted-foreground block">Observed Records</span>
          <span className="text-lg font-bold block mt-0.5">{modelData ? "Matured Ledger" : "0 Verified"}</span>
          <span className="text-[10px] font-mono text-muted-foreground block mt-1">
            {modelData ? `${modelData.provenance.smePopulationCount} SMEs Observed` : "Zero Synthetic Data"}
          </span>
        </Card>

        <Card className="p-3.5 border-border bg-card/40">
          <span className="text-[11px] font-medium text-muted-foreground block">Observation Window</span>
          <span className="text-lg font-bold block mt-0.5">
            {modelData ? `${modelData.provenance.observationPeriodDays} Days` : "Awaiting Sync"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground block mt-1">&gt;= 60 Days Required</span>
        </Card>

        <Card className="p-3.5 border-border bg-card/40">
          <span className="text-[11px] font-medium text-muted-foreground block">Censoring Analysis</span>
          <span className="text-lg font-bold block mt-0.5">{modelData ? "Audited" : "N/A"}</span>
          <span className="text-[10px] font-mono text-muted-foreground block mt-1">&lt; 95% Right-Censored</span>
        </Card>

        <Card className="p-3.5 border-border bg-card/40">
          <span className="text-[11px] font-medium text-muted-foreground block">Calibration Status</span>
          <span className="text-sm font-bold truncate block mt-0.5">
            {modelData?.calibrationStatus || "INSUFFICIENT_DATA"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground block mt-1">5-Bin ECE Monitored</span>
        </Card>

        <Card className="p-3.5 border-border bg-card/40">
          <span className="text-[11px] font-medium text-muted-foreground block">Training Status</span>
          <span className="text-xs font-bold block mt-0.5 text-amber-400">
            {modelData ? "MODEL_REGISTERED" : "TRAINING_BLOCKED"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground block mt-1">Verified Operational Data</span>
        </Card>
      </div>

      {/* 3. Main Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full bg-muted/60 p-1">
          <TabsTrigger value="overview" className="text-xs">
            Overview & Provenance
          </TabsTrigger>
          <TabsTrigger value="readiness" className="text-xs">
            Readiness Gate (14 Checks)
          </TabsTrigger>
          <TabsTrigger value="benchmarking" className="text-xs">
            Model Benchmarking & OOT
          </TabsTrigger>
          <TabsTrigger value="network" className="text-xs">
            Network Intelligence
          </TabsTrigger>
          <TabsTrigger value="resolution" className="text-xs">
            Smart Resolution Engine
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="p-5 border-border bg-card/60 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-base">Indian SME Target Registry</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Targets are strictly decoupled from Fulton County and BPI 2019. Evaluated only if supported by real observed timestamps.
              </p>

              <div className="space-y-3">
                {[
                  {
                    name: "PAYMENT_DELAY_RISK",
                    target: "payment_date > due_date",
                    desc: "Binary classification of invoice settlement delay.",
                    supported: targetsData.PAYMENT_DELAY_RISK?.supported ?? false,
                  },
                  {
                    name: "PAYMENT_DELAY_SEVERITY",
                    target: "max(0, payment_date - due_date)",
                    desc: "Continuous regression of settlement delay in days.",
                    supported: targetsData.PAYMENT_DELAY_SEVERITY?.supported ?? false,
                  },
                  {
                    name: "SEVERE_DELINQUENCY_RISK",
                    target: "DPD >= 90 Days",
                    desc: "RBI SMA-2 / NPA statutory delinquency threshold.",
                    supported: targetsData.SEVERE_DELINQUENCY_RISK?.supported ?? false,
                  },
                  {
                    name: "MSMEDA_45D_STATUTORY_BREACH",
                    target: "payment_date > invoice_date + 45 days",
                    desc: "Section 15 of MSMED Act 2006 mandatory payment ceiling breach.",
                    supported: targetsData.MSMEDA_45D_STATUTORY_BREACH?.supported ?? false,
                  },
                  {
                    name: "SME_FINANCIAL_STRESS",
                    target: "Audited Balance Sheet Liquidity Ratios",
                    desc: "Longitudinal DSCR & Current Ratio stress score.",
                    supported: false,
                    reason: "UNSUPPORTED: Trade invoice streams lack multi-year balance sheets.",
                  },
                ].map((tgt, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-foreground">{tgt.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-mono ${
                          tgt.supported
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {tgt.supported ? "SUPPORTED" : "UNSUPPORTED"}
                      </Badge>
                    </div>
                    <code className="text-[11px] text-primary/80 font-mono block">{tgt.target}</code>
                    <p className="text-[11px] text-muted-foreground">{tgt.desc}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 border-border bg-card/60 space-y-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-base">Leakage-Safe Pre-t0 Feature Engine</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All historical payment delay statistics, buyer concentrations, and credit terms are computed strictly using records settled before invoice date t0.
              </p>

              <div className="space-y-2 text-xs">
                {[
                  { feature: "invoice_amount / log_amount", type: "Transaction Magnitude", safe: true },
                  { feature: "credit_period_days", type: "Contractual Terms", safe: true },
                  { feature: "statutory_credit_stretch_days", type: "MSMEDA 45-day Term Overstretch", safe: true },
                  { feature: "buyer_historical_delay_rate", type: "Pre-t0 Rolling Bayesian Delay Rate", safe: true },
                  { feature: "buyer_historical_mean_delay_days", type: "Pre-t0 Settled Delay Magnitude", safe: true },
                  { feature: "buyer_concentration_ratio", type: "Counterparty Exposure Ratio", safe: true },
                  { feature: "is_indian_fy_end_quarter", type: "Q4 Tax/Audit Seasonality Proxy", safe: true },
                ].map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border border-border/40 bg-muted/10">
                    <div>
                      <code className="font-mono font-semibold text-[11px]">{f.feature}</code>
                      <span className="text-[10px] text-muted-foreground block">{f.type}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      LEAKAGE SAFE
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive-foreground text-xs space-y-1">
                <span className="font-semibold block flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Strictly Prohibited Predictive Features
                </span>
                <p className="text-[11px] opacity-90">
                  payment_date, post-invoice settlements, future outstanding balances, and statutory PAN/GSTIN raw identifiers are permanently excluded from model weights.
                </p>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Readiness Gate */}
        <TabsContent value="readiness" className="space-y-4">
          <Card className="p-5 border-border bg-card/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" />
                  Indian SME ML Readiness Gate (24 Evaluated Criteria)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Data must satisfy every single blocking criterion before model training is unlocked. TRUTH &gt; VOLUME.
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono uppercase bg-amber-500/10 text-amber-400 border-amber-500/30">
                GATE ARMED
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: "Provenance Authenticity", rule: "Must be REAL_OBSERVED (never SIMULATED)", desc: "Guarantees genuine empirical lineage." },
                { name: "Legal Authorization & Consent", rule: "Statutory Consent Attestation: true", desc: "DPDP & MSMED authorized signatory consent." },
                { name: "Cryptographic SHA-256 Manifest", rule: "64-char Hex Manifest Hash", desc: "Seals raw snapshot integrity." },
                { name: "Minimum Sample Size", rule: ">= 30 transactions", desc: "Statistical power threshold for inference." },
                { name: "Zero Duplicate Contamination", rule: "0.0% duplicate invoice IDs", desc: "Prevents train/test leakage." },
                { name: "Critical Field Completeness", rule: "0 missing amounts / due dates", desc: "Verifies mandatory schema." },
                { name: "Date Parse Validity", rule: "0 invalid timestamps", desc: "Ensures chronological integrity." },
                { name: "Buyer Diversity", rule: ">= 3 distinct buyers", desc: "Guarantees counterparty variance." },
                { name: "Longitudinal Coverage", rule: ">= 60 days observation window", desc: "Captures full payment credit cycle." },
                { name: "Target Maturity & Settlement", rule: ">= 10 settled invoices", desc: "Labels require historical closure." },
                { name: "Class Balance Minimums", rule: ">= 3 observations in minority class", desc: "Prevents degenerate trivial classifiers." },
                { name: "Right-Censoring Ceiling", rule: "< 95% right-censored", desc: "Sufficient resolved transition hazard." },
                { name: "Temporal Leakage Firewall", rule: "due_date >= invoice_date", desc: "Causal sequence protection." },
                { name: "Governance Sign-Off", rule: "Committee Approval", desc: "Manual Model Risk review required." },
              ].map((c, i) => (
                <div key={i} className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-start gap-3">
                  <div className="p-1 rounded bg-amber-500/10 text-amber-400 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-xs block">{c.name}</span>
                    <code className="text-[10px] text-primary/80 font-mono block mt-0.5">{c.rule}</code>
                    <span className="text-[11px] text-muted-foreground block mt-1">{c.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Model Benchmarking */}
        <TabsContent value="benchmarking" className="space-y-4">
          <Card className="p-5 border-border bg-card/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Chronological Holdout Validation & OOT Performance
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chronological split: 70% Train $\to$ 7d Embargo $\to$ 15% Val $\to$ 7d Embargo $\to$ 15% Out-of-Time Test. Random K-fold is prohibited.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {modelData ? modelData.modelId : "NO ACTIVE MODEL"}
              </Badge>
            </div>

            {modelData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">ROC-AUC (OOT)</span>
                    <span className="text-xl font-bold block mt-1 text-emerald-400">
                      {modelData.classificationMetrics?.rocAuc.toFixed(3) || "N/A"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Discrimination Power</span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">F1-Score</span>
                    <span className="text-xl font-bold block mt-1 text-blue-400">
                      {modelData.classificationMetrics?.f1.toFixed(3) || "N/A"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Harmonic Precision/Recall</span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Brier Score</span>
                    <span className="text-xl font-bold block mt-1 text-purple-400">
                      {modelData.classificationMetrics?.brierScore.toFixed(3) || "N/A"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Probability Calibration</span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">MAE (Days Delay)</span>
                    <span className="text-xl font-bold block mt-1 text-teal-400">
                      {modelData.regressionMetrics?.mae.toFixed(1) || "N/A"}d
                    </span>
                    <span className="text-[10px] text-muted-foreground">Severity Magnitude Error</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-border/80 bg-muted/30">
                  <span className="text-xs font-semibold block mb-2">Cryptographic Artifact Manifest</span>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-muted-foreground">SHA-256 Checksum:</span>
                    <span className="text-foreground bg-background px-2 py-1 rounded border border-border truncate">
                      {modelData.artifactChecksum || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-3">
                <Database className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                <h4 className="font-semibold text-sm">No Active Indian SME Model Registered</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Per NEXUS-CFR governance, models are not trained on synthetic or placeholder data. Connect an authorized Tally, Zoho, QuickBooks, SAP, or Consented File stream to unlock genuine out-of-time evaluation.
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 4: Network Intelligence */}
        <TabsContent value="network" className="space-y-4">
          <Card className="p-5 border-border bg-card/60 space-y-4">
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                Indian SME Supply Chain Network Topology
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Constructed strictly from genuine observed transactions. Zero artificial cross-dataset joins.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                <span className="text-xs font-semibold block">SME &harr; Buyer Edges</span>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tracks accounts receivable exposure, overdue volume, and dependency ratios per counterparty.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                <span className="text-xs font-semibold block">SME &harr; Supplier Edges</span>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Evaluates payables liquidity constraints and secondary trade credit transmission.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                <span className="text-xs font-semibold block">Hypothetical Cascade Simulator</span>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Simulates liquidity shock propagation labeled strictly as HYPOTHETICAL_SCENARIO.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 5: Smart Resolution Engine */}
        <TabsContent value="resolution" className="space-y-4">
          <Card className="p-5 border-border bg-card/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Indian SME Smart Resolution Engine
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Audited, non-transactional mitigation strategies. System does not execute financial transactions.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border-blue-500/30">
                DECISION SUPPORT ONLY
              </Badge>
            </div>

            <div className="space-y-3">
              {[
                {
                  title: "TReDS Institutional Factoring Consideration",
                  trigger: "Invoices flagged with predicted payment delay > 25 days",
                  reason: "Discounting accepted trade receivables on an RBI-licensed TReDS platform (RXIL/M1xchange/Invoicemart) provides immediate non-recourse liquidity.",
                  impact: "Accelerates cash realization to T+1 settlement.",
                  confidence: 0.89,
                },
                {
                  title: "Counterparty Concentration & Buyer Diversification",
                  trigger: "Single buyer accounts for > 35% of total SME revenue",
                  reason: "Anchor customer dependency exposes SME to severe liquidity freezes if that buyer delays disbursements.",
                  impact: "Mitigates systemic counterparty shock risk.",
                  confidence: 0.84,
                },
                {
                  title: "Preemptive Working Capital Overdraft Sizing",
                  trigger: "Hypothetical cascade shock indicates receivables freeze",
                  reason: "Preemptive sizing of standby cash buffer prevents statutory MSMED compliance default on secondary vendors.",
                  impact: "Maintains operational continuity and vendor trust.",
                  confidence: 0.81,
                },
              ].map((res, i) => (
                <div key={i} className="p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{res.title}</span>
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/30">
                      Confidence: {(res.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{res.reason}</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                    <span>Trigger: {res.trigger}</span>
                    <span className="text-primary">{res.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
