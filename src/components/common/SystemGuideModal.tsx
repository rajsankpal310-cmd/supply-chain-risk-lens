import { useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  FileText,
  Gauge,
  GitBranch,
  HelpCircle,
  Layers,
  Network,
  Search,
  ShieldAlert,
  ShieldCheck,
  Table2,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PROCESS_STEPS = [
  {
    step: 1,
    title: "Transaction Data",
    icon: Table2,
    desc: "Ingests raw B2B invoice records containing counterparty IDs, invoice amounts, due dates, and settlement terms.",
  },
  {
    step: 2,
    title: "Data Validation",
    icon: CheckCircle2,
    desc: "Validates record completeness, reconciles payment statuses, checks schema invariants, and tags batch provenance.",
  },
  {
    step: 3,
    title: "Risk Analysis",
    icon: Gauge,
    desc: "Computes historical payment delay days, invoice ageing buckets, and working-capital financial stress scores.",
  },
  {
    step: 4,
    title: "Network Analysis",
    icon: Network,
    desc: "Constructs an interactive buyer-supplier graph with edge weights corresponding to active outstanding exposure.",
  },
  {
    step: 5,
    title: "Impact Analysis",
    icon: GitBranch,
    desc: "Identifies circular payment deadlocks and models risk contagion across interconnected supply-chain hubs.",
  },
  {
    step: 6,
    title: "Decision Support",
    icon: Activity,
    desc: "Generates prioritized non-lending interventions, financing recommendations, and cash-flow optimization allocations.",
  },
  {
    step: 7,
    title: "Action / Monitoring",
    icon: ShieldCheck,
    desc: "Logs user management decisions, updates payment settlement status, dispatches critical alerts, and tracks resilience.",
  },
];

const GLOSSARY_TERMS = [
  {
    term: "Payment Delay",
    category: "Operational",
    definition:
      "The elapsed number of days between an invoice's agreed due date and the actual settlement date. A positive value indicates overdue payment.",
  },
  {
    term: "Outstanding Amount",
    category: "Financial",
    definition:
      "The unsettled principal balance of an active invoice. Reduces strictly to ₹0 once an invoice is marked as PAID.",
  },
  {
    term: "Financial Stress Index",
    category: "Risk",
    definition:
      "A normalized 0–100 indicator measuring working-capital pressure, calculated from cash buffer days, debt-to-receivable ratios, and counterparty delinquency rates.",
  },
  {
    term: "Cascade Risk",
    category: "Network",
    definition:
      "The probability (0–100%) that a payment default or severe delay by one buyer will trigger secondary liquidity failures across connected suppliers.",
  },
  {
    term: "Financial Exposure",
    category: "Financial",
    definition:
      "The total aggregate monetary value at risk across all unsettled invoices with a given counterparty or within a network cluster.",
  },
  {
    term: "Payment Deadlock",
    category: "Network",
    definition:
      "A circular payment dependency chain (e.g., A owes B, B owes C, and C owes A) where liquidity is trapped because all participants are waiting for incoming funds.",
  },
  {
    term: "Invoice Ageing",
    category: "Operational",
    definition:
      "Classification of receivables by the number of days elapsed past their payment due date (e.g., 0–30 days, 31–60 days, 60+ days overdue).",
  },
  {
    term: "Calculated Risk Score",
    category: "Methodology",
    definition:
      "A deterministic rule-based composite score derived from transaction histories, delay patterns, and network centrality. Distinct from ML predictive models.",
  },
  {
    term: "Active Obligation",
    category: "Network",
    definition:
      "A live debt relationship between a buyer and supplier with an outstanding balance greater than ₹0, displayed as a solid weighted edge in the network graph.",
  },
];

const ROLE_SCOPES = [
  {
    role: "SME Admin",
    badge: "Full Operational Control",
    mission: "You manage your organization's data and risk-monitoring workflow.",
    capabilities: [
      "Import invoice batches and CSV datasets",
      "Create, edit, and mark transactions as paid",
      "Manage organization profile and workspace settings",
      "Execute deadlock resolutions and review recommendations",
    ],
    restrictions: ["Cannot bypass audit trail validation"],
  },
  {
    role: "Credit Analyst",
    badge: "Analytical Modeling",
    mission: "You investigate financial and supply-chain risk and support decision-making.",
    capabilities: [
      "Run interactive shock scenario simulations",
      "Execute linear-programming support budget optimizations",
      "Analyze network centrality and systemic risk contagion",
      "Evaluate financial deadlock chains and recommendations",
    ],
    restrictions: ["Cannot upload raw transaction files or alter tenant settings"],
  },
  {
    role: "Executive Viewer",
    badge: "Read-Only Monitoring",
    mission: "You monitor risk, network status and reports without making operational changes.",
    capabilities: [
      "Monitor executive portfolio resilience index",
      "Inspect high-level risk distribution and critical alerts",
      "Generate, view, and export compliance and audit reports",
      "Read-only inspection of firms, transactions, and network graphs",
    ],
    restrictions: [
      "Zero mutation permissions: cannot import data, run simulations, or change statuses",
    ],
  },
];

interface SystemGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SystemGuideModal({ open, onOpenChange }: SystemGuideModalProps) {
  const [tab, setTab] = useState<"process" | "glossary" | "roles">("process");
  const [search, setSearch] = useState("");

  const filteredGlossary = GLOSSARY_TERMS.filter(
    (g) =>
      g.term.toLowerCase().includes(search.toLowerCase()) ||
      g.definition.toLowerCase().includes(search.toLowerCase()) ||
      g.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground size-7 rounded-md grid place-items-center font-bold text-xs">
              N
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">NEXUS-CFR Product Guide</DialogTitle>
              <DialogDescription className="text-xs">
                Data-Driven SME Financial Risk Prediction & Supply Chain Resilience System
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3">
            <Button
              variant={tab === "process" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("process")}
              className="text-xs h-8"
            >
              <Layers className="size-3.5 mr-1" /> How It Works
            </Button>
            <Button
              variant={tab === "glossary" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("glossary")}
              className="text-xs h-8"
            >
              <BookOpen className="size-3.5 mr-1" /> Metric Glossary
            </Button>
            <Button
              variant={tab === "roles" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("roles")}
              className="text-xs h-8"
            >
              <ShieldAlert className="size-3.5 mr-1" /> Role Capabilities
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {tab === "process" && (
            <div className="space-y-4">
              <div className="bg-muted/40 border border-border/80 rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">The NEXUS-CFR Value Cycle:</p>
                <p>
                  NEXUS-CFR ingests invoice records, validates ledger health, identifies payment stress,
                  traces contagion across buyer-supplier dependencies, and presents actionable resolution
                  interventions before working capital crises materialize.
                </p>
              </div>

              <div className="space-y-3">
                {PROCESS_STEPS.map((s, idx) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.step}
                      className="flex items-start gap-3 rounded-lg border border-border/70 p-3 bg-card hover:border-primary/40 transition-colors"
                    >
                      <div className="bg-primary/10 text-primary size-8 rounded-md flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                        {s.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 text-primary" />
                          <h4 className="font-semibold text-sm">{s.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "glossary" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search metrics, terms, definitions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {filteredGlossary.map((item) => (
                  <div
                    key={item.term}
                    className="border border-border/70 rounded-lg p-3 bg-card space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-foreground">{item.term}</h4>
                      <Badge variant="outline" className="text-[10px] py-0">
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.definition}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "roles" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                NEXUS-CFR enforces authoritative role-based access control. Each role receives a tailored
                dashboard view, specific tooling, and strict action boundaries:
              </p>

              <div className="space-y-4">
                {ROLE_SCOPES.map((r) => (
                  <div key={r.role} className="border border-border/80 rounded-lg p-4 bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground">{r.role}</h4>
                        <Badge variant="secondary" className="text-[10px]">
                          {r.badge}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs italic text-primary font-medium">"{r.mission}"</p>

                    <div className="grid gap-2 sm:grid-cols-2 text-xs">
                      <div>
                        <p className="font-semibold text-foreground mb-1 text-[11px] uppercase tracking-wider">
                          Key Capabilities:
                        </p>
                        <ul className="space-y-1 text-muted-foreground">
                          {r.capabilities.map((c, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <span className="text-emerald-500 font-bold">✓</span> {c}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="font-semibold text-foreground mb-1 text-[11px] uppercase tracking-wider">
                          Security Restrictions:
                        </p>
                        <ul className="space-y-1 text-muted-foreground">
                          {r.restrictions.map((res, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <span className="text-destructive font-bold">✕</span> {res}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close Guide
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
