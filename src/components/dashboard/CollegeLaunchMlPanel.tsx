import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BarChart3,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Activity,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function CollegeLaunchMlPanel() {
  const [selectedPredictor, setSelectedPredictor] = useState<"FULTON" | "BPI">("FULTON");
  const [invoiceAmount, setInvoiceAmount] = useState<number>(35000);
  const [isCheckDisbursement, setIsCheckDisbursement] = useState<boolean>(true);
  const [vendorMeanCycle, setVendorMeanCycle] = useState<number>(14);

  const [bpiPoValue, setBpiPoValue] = useState<number>(65000);
  const [hasPreInvoiceBlock, setHasPreInvoiceBlock] = useState<boolean>(false);
  const [hasGoodsReceipt, setHasGoodsReceipt] = useState<boolean>(true);

  const [activePrediction, setActivePrediction] = useState<any | null>(null);

  // Fetch status
  const statusQuery = useQuery({
    queryKey: ["college-launch-status"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ml/college-launch/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  // Fulton Predict
  const fultonMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ml/college-launch/predict/fulton", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setActivePrediction(data.prediction);
        toast.success("Payment cycle risk predicted");
      }
    },
  });

  // BPI Predict
  const bpiMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/ml/college-launch/predict/bpi", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setActivePrediction(data.prediction);
        toast.success("Process clearing risk predicted");
      }
    },
  });

  const handlePredict = () => {
    if (selectedPredictor === "FULTON") {
      fultonMutation.mutate({
        invoiceAmount,
        isCheckDisbursement,
        vendorPriorMeanCycleDays: vendorMeanCycle,
      });
    } else {
      bpiMutation.mutate({
        monetaryValue: bpiPoValue,
        hasPreInvoiceBlock,
        hasGoodsReceiptPreInvoice: hasGoodsReceipt,
      });
    }
  };

  const statusData = statusQuery.data;
  const models = statusData?.stage1PublicModels || [];
  const fultonModel = models.find((m: any) => m.datasetKey === "FULTON_COUNTY");
  const bpiModel = models.find((m: any) => m.datasetKey === "BPI_CHALLENGE_2019");
  const ukDbtModel = models.find((m: any) => m.datasetKey === "UK_DBT");

  const isPredicting = fultonMutation.isPending || bpiMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Risk Intelligence Models</h3>
            <p className="text-xs text-muted-foreground">
              Trained on verified public procurement and enterprise process datasets
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => statusQuery.refetch()}
          disabled={statusQuery.isFetching}
          className="text-xs gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fulton County */}
        <Card className="p-4 border-border bg-card/60 flex flex-col justify-between hover:border-primary/40 transition-all space-y-3">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <h4 className="font-semibold text-sm text-foreground">
                  {fultonModel?.datasetName || "Fulton County Vendor Payments"}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {fultonModel?.originalPublisher || "Fulton County Government — Georgia Open Data"}
                </p>
                <a
                  href={fultonModel?.sourceUrl || "https://data.fultoncountyga.gov/d/mxhc-krcg"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                >
                  Source <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30 whitespace-nowrap shrink-0">
                Public Dataset
              </Badge>
            </div>

            <div className="space-y-1 text-xs bg-muted/20 p-2.5 rounded-lg border border-border/40 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Records:</span>
                <span className="text-foreground font-semibold">{fultonModel?.datasetSize || "10,000 (9,891 clean)"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target:</span>
                <span className="text-foreground">Payment cycle latency &gt; 14 days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OOT split:</span>
                <span className="text-foreground">Train 70% / Val 10% / Test 20%</span>
              </div>
            </div>

            {/* OOT Metrics */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
                Out-of-Time Test Metrics
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg border border-border/60 bg-muted/30 text-center font-mono text-xs">
                <div>
                  <span className="text-[9px] text-muted-foreground block">ROC-AUC</span>
                  <span className="font-bold text-emerald-400">
                    {fultonModel?.actualOotMetrics?.rocAuc?.toFixed(4) || "0.6213"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">PR-AUC</span>
                  <span className="font-bold text-emerald-400">
                    {fultonModel?.actualOotMetrics?.prAuc?.toFixed(4) || "0.3990"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">F1</span>
                  <span className="font-semibold text-foreground">
                    {fultonModel?.actualOotMetrics?.f1?.toFixed(4) || "0.0351"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">Accuracy</span>
                  <span className="font-semibold text-foreground">
                    {fultonModel?.actualOotMetrics?.accuracy
                      ? (fultonModel.actualOotMetrics.accuracy * 100).toFixed(1) + "%"
                      : "72.2%"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">MAE</span>
                  <span className="font-semibold text-teal-400">
                    {fultonModel?.actualOotMetrics?.mae
                      ? fultonModel.actualOotMetrics.mae.toFixed(2) + "d"
                      : "8.31d"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">R²</span>
                  <span className="font-semibold text-teal-400">
                    {fultonModel?.actualOotMetrics?.r2?.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {fultonModel?.domainLimitation ||
                "Scope: US municipal procurement disbursements. Not applicable to commercial credit or insolvency prediction."}
            </p>
          </div>

          <Button
            size="sm"
            variant={selectedPredictor === "FULTON" ? "default" : "outline"}
            onClick={() => { setSelectedPredictor("FULTON"); setActivePrediction(null); }}
            className="w-full text-xs"
          >
            Use This Model
          </Button>
        </Card>

        {/* BPI Challenge 2019 */}
        <Card className="p-4 border-border bg-card/60 flex flex-col justify-between hover:border-primary/40 transition-all space-y-3">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <h4 className="font-semibold text-sm text-foreground">
                  {bpiModel?.datasetName || "BPI Challenge 2019 ERP Process Log"}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {bpiModel?.originalPublisher || "Eindhoven Univ. of Technology — 4TU.ResearchData"}
                </p>
                <a
                  href={bpiModel?.sourceUrl || "https://data.4tu.nl/articles/dataset/BPI_Challenge_2019/12715853"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                >
                  Source <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30 whitespace-nowrap shrink-0">
                Public Dataset
              </Badge>
            </div>

            <div className="space-y-1 text-xs bg-muted/20 p-2.5 rounded-lg border border-border/40 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Records:</span>
                <span className="text-foreground font-semibold">{bpiModel?.datasetSize || "5,000 cases (canonical)"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target:</span>
                <span className="text-foreground">Process clearing delay &gt; 45 days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OOT split:</span>
                <span className="text-foreground">Train 60% / Val 20% / Test 20%</span>
              </div>
            </div>

            {/* OOT Metrics */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
                Out-of-Time Test Metrics
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg border border-border/60 bg-muted/30 text-center font-mono text-xs">
                <div>
                  <span className="text-[9px] text-muted-foreground block">ROC-AUC</span>
                  <span className="font-bold text-emerald-400">
                    {bpiModel?.actualOotMetrics?.rocAuc?.toFixed(4) || "0.9352"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">PR-AUC</span>
                  <span className="font-bold text-emerald-400">
                    {bpiModel?.actualOotMetrics?.prAuc?.toFixed(4) || "0.8648"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">F1</span>
                  <span className="font-semibold text-foreground">
                    {bpiModel?.actualOotMetrics?.f1?.toFixed(4) || "0.8035"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">Accuracy</span>
                  <span className="font-semibold text-foreground">
                    {bpiModel?.actualOotMetrics?.accuracy
                      ? (bpiModel.actualOotMetrics.accuracy * 100).toFixed(1) + "%"
                      : "86.6%"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">MAE</span>
                  <span className="font-semibold text-teal-400">
                    {bpiModel?.actualOotMetrics?.mae
                      ? bpiModel.actualOotMetrics.mae.toFixed(2) + "d"
                      : "15.15d"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">R²</span>
                  <span className="font-semibold text-teal-400">
                    {bpiModel?.actualOotMetrics?.r2 != null
                      ? bpiModel.actualOotMetrics.r2.toFixed(2)
                      : "0.58"}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {bpiModel?.domainLimitation ||
                "Scope: Enterprise SAP purchase-to-pay process friction. Not applicable to retail credit or SME loan default."}
            </p>
          </div>

          <Button
            size="sm"
            variant={selectedPredictor === "BPI" ? "default" : "outline"}
            onClick={() => { setSelectedPredictor("BPI"); setActivePrediction(null); }}
            className="w-full text-xs"
          >
            Use This Model
          </Button>
        </Card>

        {/* UK DBT Benchmark */}
        <Card className="p-4 border-border bg-card/60 flex flex-col justify-between hover:border-primary/40 transition-all space-y-3">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <h4 className="font-semibold text-sm text-foreground">
                  {ukDbtModel?.datasetName || "UK Payment Practices Benchmark"}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {ukDbtModel?.originalPublisher || "UK Department for Business and Trade"}
                </p>
                <a
                  href={ukDbtModel?.sourceUrl || "https://check-payment-practices.service.gov.uk/export"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                >
                  Source <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border-blue-500/30 whitespace-nowrap shrink-0">
                Reference
              </Badge>
            </div>

            <div className="space-y-1 text-xs bg-muted/20 p-2.5 rounded-lg border border-border/40 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filings:</span>
                <span className="text-foreground font-semibold">348,806 statutory reports</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period:</span>
                <span className="text-foreground">2017 – 2026 (longitudinal)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Median Pay Time:</span>
                <span className="text-foreground font-semibold">36.4 days</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border/40 bg-muted/20 text-center space-y-1">
              <span className="text-xs font-semibold text-muted-foreground block">
                Reference Benchmark Only
              </span>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Statutory disclosure data used for macroeconomic context. Transaction-level ML evaluation is not applicable for this source.
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {ukDbtModel?.domainLimitation ||
                "Scope: UK corporate statutory payment reporting. Used for cross-sector benchmark comparison only."}
            </p>
          </div>

          <Badge variant="outline" className="w-full justify-center py-2 text-xs text-muted-foreground border-border">
            Benchmark — Not for inference
          </Badge>
        </Card>
      </div>

      {/* Live Predictor Widget */}
      <Card className="p-5 border-border bg-card/80 space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Live Risk Prediction —{" "}
              {selectedPredictor === "FULTON" ? "Fulton County Procurement Model" : "BPI ERP Process Model"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter scenario parameters to generate a real-time risk prediction from the selected model.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
            {selectedPredictor === "FULTON" ? "Payment Cycle Risk" : "Process Clearing Risk"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Controls */}
          <div className="space-y-4">
            {selectedPredictor === "FULTON" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Invoice Amount (USD)</Label>
                  <Input
                    type="number"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Disbursement Channel</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={isCheckDisbursement ? "default" : "outline"}
                      onClick={() => setIsCheckDisbursement(true)}
                      className="text-xs flex-1"
                    >
                      Physical Check
                    </Button>
                    <Button
                      size="sm"
                      variant={!isCheckDisbursement ? "default" : "outline"}
                      onClick={() => setIsCheckDisbursement(false)}
                      className="text-xs flex-1"
                    >
                      ACH / Wire
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vendor Historical Mean Cycle (Days)</Label>
                  <Input
                    type="number"
                    value={vendorMeanCycle}
                    onChange={(e) => setVendorMeanCycle(Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Purchase Order Value (EUR)</Label>
                  <Input
                    type="number"
                    value={bpiPoValue}
                    onChange={(e) => setBpiPoValue(Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pre-Invoice Payment Block</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={hasPreInvoiceBlock ? "default" : "outline"}
                      onClick={() => setHasPreInvoiceBlock(true)}
                      className="text-xs flex-1"
                    >
                      Block Present
                    </Button>
                    <Button
                      size="sm"
                      variant={!hasPreInvoiceBlock ? "default" : "outline"}
                      onClick={() => setHasPreInvoiceBlock(false)}
                      className="text-xs flex-1"
                    >
                      No Block
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Goods Receipt Pre-Invoice</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={hasGoodsReceipt ? "default" : "outline"}
                      onClick={() => setHasGoodsReceipt(true)}
                      className="text-xs flex-1"
                    >
                      3-Way Matched
                    </Button>
                    <Button
                      size="sm"
                      variant={!hasGoodsReceipt ? "default" : "outline"}
                      onClick={() => setHasGoodsReceipt(false)}
                      className="text-xs flex-1"
                    >
                      Receipt Missing
                    </Button>
                  </div>
                </div>
              </>
            )}

            <Button onClick={handlePredict} disabled={isPredicting} className="w-full gap-2 text-xs">
              <TrendingUp className="w-3.5 h-3.5" />
              {isPredicting ? "Running..." : "Run Prediction"}
            </Button>
          </div>

          {/* Result Display */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col justify-between min-h-[220px]">
            {activePrediction ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{activePrediction.predictionId}</span>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs ${
                      activePrediction.riskBand === "CRITICAL"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : activePrediction.riskBand === "ELEVATED"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    {activePrediction.riskBand} RISK
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 py-2 border-y border-border/40 font-mono">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Risk Probability</span>
                    <span className="text-2xl font-bold text-foreground">
                      {(activePrediction.predictedProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Predicted Duration</span>
                    <span className="text-2xl font-bold text-primary">
                      {activePrediction.predictedMagnitudeDays} days
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold block">Key Risk Factors</span>
                  {activePrediction.topContributingFeatures?.map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-background/60 font-mono">
                      <span>{f.feature}</span>
                      <span className={f.impact === "INCREASES_RISK" ? "text-rose-400" : "text-emerald-400"}>
                        {f.impact === "INCREASES_RISK" ? "↑ Risk" : "↓ Risk"}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-muted-foreground font-mono">
                  Model scope: {activePrediction.domainBoundary}
                </p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                <Activity className="w-8 h-8 text-muted-foreground opacity-40" />
                <span className="text-xs font-semibold">Ready</span>
                <p className="text-[11px] text-muted-foreground">
                  Configure parameters and run the prediction.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
