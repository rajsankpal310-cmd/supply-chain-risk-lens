import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Boxes,
  GitBranch,
  Layers,
  LineChart,
  Lightbulb,
  Network,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Workflow,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SystemGuideModal } from "@/components/common/SystemGuideModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEXUS-CFR — Predict Financial Risk Before It Becomes a Supply-Chain Crisis" },
      {
        name: "description",
        content:
          "A decision-support platform that turns SME transaction data into payment-risk predictions, supply-chain impact analysis, deadlock detection and actionable recommendations.",
      },
      { property: "og:title", content: "NEXUS-CFR — SME Financial Risk & Supply Chain Resilience" },
      {
        name: "og:description",
        content: "Predict payment delays, trace supply-chain contagion, simulate shocks and act on prioritised recommendations.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  { icon: TrendingUp, title: "Predict", text: "Estimate payment delays and financial stress before invoices mature." },
  { icon: Network, title: "Trace", text: "See how one firm's stress travels through buyers and suppliers." },
  { icon: Activity, title: "Simulate", text: "Run what-if shocks and measure cascade impact across the chain." },
  { icon: Lightbulb, title: "Resolve", text: "Get prioritised, explainable interventions with expected impact." },
];

const FEATURES = [
  { icon: BarChart3, title: "Transaction Intelligence", text: "Invoice-level analysis of ageing, delays and settlement behaviour." },
  { icon: LineChart, title: "Payment Delay Prediction", text: "Probability and expected delay for maturing invoices." },
  { icon: ShieldCheck, title: "Financial Stress Prediction", text: "Working-capital pressure scored per firm with drivers." },
  { icon: Network, title: "Supply Chain Graph", text: "Interactive buyer-supplier network with exposure weighting." },
  { icon: Workflow, title: "Cascade Risk Analysis", text: "Estimated probability that stress spreads to connected firms." },
  { icon: GitBranch, title: "Financial Deadlock Detection", text: "Circular payment chains where cash stops moving." },
  { icon: Activity, title: "Scenario Simulation", text: "Buyer delay, supplier failure, cash shock and disaster scenarios." },
  { icon: Lightbulb, title: "Resolution Recommendations", text: "Financing, rescheduling, alternate sourcing and buffer options." },
  { icon: Sliders, title: "Support Allocation Optimization", text: "Allocate a limited budget where it reduces risk the most." },
];

const PROCESS_FLOW = [
  { step: 1, title: "Transaction Data", desc: "Ingest invoices, terms, and counterparty records" },
  { step: 2, title: "Data Validation", desc: "Reconcile payment statuses and record completeness" },
  { step: 3, title: "Risk Analysis", desc: "Calculate payment delays and financial stress indices" },
  { step: 4, title: "Network Analysis", desc: "Map buyer-supplier dependencies and exposure weights" },
  { step: 5, title: "Impact Analysis", desc: "Detect circular deadlocks and stress contagion paths" },
  { step: 6, title: "Decision Support", desc: "Formulate non-lending interventions and optimizations" },
  { step: 7, title: "Action / Monitoring", desc: "Record decisions, update statuses, and dispatch alerts" },
];

function Landing() {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border/70 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <div className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md font-bold">N</div>
          <span className="font-semibold tracking-tight">NEXUS-CFR</span>
          <nav className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setGuideOpen(true)} className="gap-1 text-xs">
              <HelpCircle className="size-4 text-primary" />
              <span>How It Works</span>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="grid-backdrop border-border/70 border-b">
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <p className="border-primary/40 bg-primary/10 text-primary inline-flex rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase">
              SME risk intelligence
            </p>
            <h1 className="mt-6 max-w-3xl text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
              Predict Financial Risk Before It Becomes a Supply-Chain Crisis.
            </h1>
            <p className="text-muted-foreground mt-5 max-w-2xl text-base md:text-lg">
              NEXUS-CFR transforms SME transaction data into payment-risk predictions, supply-chain impact analysis, and actionable financial
              recommendations.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/register">
                  Explore Platform <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">View Demo</Link>
              </Button>
            </div>
            <div className="text-muted-foreground mt-10 grid max-w-2xl grid-cols-2 gap-4 text-sm md:grid-cols-4">
              {["20 demo firms", "200 transactions", "50 relationships", "5 shock scenarios"].map((s) => (
                <div key={s} className="border-border/70 rounded-lg border px-3 py-2">
                  {s}
                </div>
              ))}
            </div>
          </div>
        </section>

        <Section title="One late payment rarely stays in one place" kicker="The problem">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <p className="text-muted-foreground text-sm">A financial problem in one SME quickly reaches connected buyers and suppliers.</p>
              <div className="mt-6 flex flex-wrap items-center gap-2 text-sm font-medium">
                {["Buyer", "SME", "Supplier", "Supplier"].map((n, i) => (
                  <span key={n + i} className="flex items-center gap-2">
                    <span className="border-border bg-muted rounded-md border px-3 py-1.5">{n}</span>
                    {i < 3 && <ArrowRight className="text-muted-foreground size-4" aria-hidden />}
                  </span>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <ol className="space-y-3">
                {["Payment Delay", "Cash Flow Stress", "Payment Delay", "Supply Chain Impact"].map((step, i) => (
                  <li key={step + i} className="flex items-center gap-3">
                    <span className="bg-primary/12 text-primary grid size-7 shrink-0 place-items-center rounded-md font-mono text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </Section>

        <Section title="Four pillars, one workflow" kicker="The solution">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <Card key={p.title} className="p-6">
                <p.icon className="text-primary size-6" aria-hidden />
                <h3 className="mt-4 font-semibold">{p.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">{p.text}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="How NEXUS-CFR works" kicker="The 7-Step Resilience Process">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PROCESS_FLOW.map((s) => (
              <Card key={s.step} className="p-4 border-border/70 bg-card/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-primary/10 text-primary text-xs font-mono font-bold px-2 py-0.5 rounded">
                      Step {s.step}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">{s.title}</h4>
                  <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed">{s.desc}</p>
                </div>
              </Card>
            ))}
            <Card className="p-4 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center text-center">
              <p className="font-semibold text-sm text-primary mb-1">Explore Full Methodology</p>
              <p className="text-[11px] text-muted-foreground mb-3">Inspect metric definitions, glossary & roles</p>
              <Button size="sm" variant="outline" onClick={() => setGuideOpen(true)} className="text-xs">
                Open Product Guide
              </Button>
            </Card>
          </div>
        </Section>

        <Section title="Key capabilities" kicker="Features">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-5">
                <div className="flex items-center gap-2.5">
                  <f.icon className="text-primary size-5" aria-hidden />
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">{f.text}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Why NEXUS-CFR" kicker="Positioning">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-6">
              <Layers className="text-primary size-5" aria-hidden />
              <h3 className="mt-3 font-semibold">One connected workflow</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Transaction intelligence, network analysis and resolution planning live in the same place — not in three disconnected tools.
              </p>
            </Card>
            <Card className="p-6">
              <Boxes className="text-primary size-5" aria-hidden />
              <h3 className="mt-3 font-semibold">Explains the risk</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Every score comes with the drivers behind it, so finance teams can act on reasons instead of numbers.
              </p>
            </Card>
            <Card className="p-6">
              <ShieldCheck className="text-primary size-5" aria-hidden />
              <h3 className="mt-3 font-semibold">Decision support, not a lender</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                NEXUS-CFR does not provide financing or insurance. It recommends the existing mechanisms best suited to a situation.
              </p>
            </Card>
          </div>
        </Section>

        <section className="border-border/70 border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Start Risk Analysis</h2>
              <p className="text-muted-foreground mt-1.5 text-sm">Sign in with the demo account and explore the full workflow on sample data.</p>
            </div>
            <Button size="lg" asChild>
              <Link to="/login">
                Start Risk Analysis <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-border/70 text-muted-foreground border-t py-8 text-center text-xs">
        NEXUS-CFR · Demo dataset only — sample data, not real financial information.
      </footer>

      <SystemGuideModal open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}

function Section({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="border-border/70 border-b">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-primary text-xs font-semibold tracking-wider uppercase">{kicker}</p>
        <h2 className="mt-2 mb-8 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
        {children}
      </div>
    </section>
  );
}
