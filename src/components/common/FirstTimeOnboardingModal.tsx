import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Compass,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Network,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";

const TOUR_STEPS = [
  {
    step: 1,
    title: "Executive & Operational Dashboard",
    route: "/app/dashboard",
    icon: LayoutDashboard,
    badge: "Starting Point",
    summary: "See your organization's key risk indicators, payment health, and role-tailored command center.",
    details: [
      "Monitors outstanding receivables and macro settlement delay trends.",
      "Displays incoming invoices due for collection triage.",
      "Customized automatically for SME Admin, Credit Analyst, or Executive Viewer roles.",
    ],
  },
  {
    step: 2,
    title: "Transaction Ledger & Invoices",
    route: "/app/transactions",
    icon: Table2,
    badge: "Primary Data",
    summary: "Inspect invoice and payment information across connected buyers and suppliers.",
    details: [
      "Real-time tracking of invoice ageing, payment status (Paid, Pending, Delayed), and due dates.",
      "Direct link to 'View in Network' to trace where each invoice sits in the supply chain.",
      "Audit trail transparency displaying provenance of imported or benchmark datasets.",
    ],
  },
  {
    step: 3,
    title: "Supply Chain Network Topology",
    route: "/app/network",
    icon: Network,
    badge: "Systemic Tracing",
    summary: "Understand buyer-supplier dependencies and exposure concentrations visually.",
    details: [
      "Nodes represent firms, colored by risk band (Green to Critical Red).",
      "Edge thickness reflects outstanding financial exposure between counterparties.",
      "Inspect individual firms to see active obligations vs settled relationships.",
    ],
  },
  {
    step: 4,
    title: "Portfolio Risk Intelligence",
    route: "/app/risk",
    icon: Gauge,
    badge: "Risk Analytics",
    summary: "Investigate risk drivers, financial stress scores, and calculated delay vectors.",
    details: [
      "Deterministic calculated risk indicators clearly distinguished from machine learning models.",
      "Granular breakdown into payment delay risk, working-capital stress, and contagion severity.",
      "Detailed counterparty risk driver analysis for prioritized triage.",
    ],
  },
  {
    step: 5,
    title: "Decision Support Recommendations",
    route: "/app/recommendations",
    icon: Lightbulb,
    badge: "Actionable Interventions",
    summary: "Review available decision-support actions and non-lending liquidity mechanisms.",
    details: [
      "Recommends targeted interventions such as invoice discounting, credit renegotiation, and reserve buffers.",
      "Transparent rationale explaining which risk vector is addressed and what evidence supports it.",
      "Accepting records your management decision in the audit trail without executing bank transactions.",
    ],
  },
  {
    step: 6,
    title: "Real-Time Risk Alerts",
    route: "/app/alerts",
    icon: Bell,
    badge: "Active Monitoring",
    summary: "Monitor important changes, payment delay thresholds, and circular deadlocks.",
    details: [
      "Instant notification of critical changes across your buyer-supplier portfolio.",
      "Provides structured context on why the alert was generated and recommended next inspection steps.",
      "Archiving removes an alert from active view while preserving historical audit logs.",
    ],
  },
];

const STORAGE_KEY = "nexus_cfr_onboarding_completed";

interface FirstTimeOnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function FirstTimeOnboardingModal({ forceOpen = false, onClose }: FirstTimeOnboardingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setCurrentStep(0);
      return;
    }
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setOpen(true);
    }
  }, [forceOpen]);

  function handleClose() {
    if (dontShowAgain || !forceOpen) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    setOpen(false);
    if (onClose) onClose();
  }

  function handleNext() {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleClose();
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }

  function handleGoToPage(route: string) {
    handleClose();
    navigate({ to: route });
  }

  const stepData = TOUR_STEPS[currentStep] ?? TOUR_STEPS[0]!;
  const Icon = stepData.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary p-1.5 rounded-md">
                <Compass className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Welcome to NEXUS-CFR, {user?.fullName.split(" ")[0] || "User"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Role: <span className="font-semibold text-foreground">{user?.role.replace("_", " ")}</span> · 6-Step System Tour
                </DialogDescription>
              </div>
            </div>
            <span className="text-xs font-mono font-medium text-muted-foreground">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>
        </DialogHeader>

        {/* Step Progress Indicators */}
        <div className="flex items-center gap-1.5 py-1">
          {TOUR_STEPS.map((s, idx) => (
            <div
              key={s.step}
              onClick={() => setCurrentStep(idx)}
              className={`h-1.5 flex-1 rounded-full cursor-pointer transition-all ${
                idx === currentStep
                  ? "bg-primary"
                  : idx < currentStep
                  ? "bg-primary/40"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step Content Card */}
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 my-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary text-primary-foreground size-9 rounded-lg grid place-items-center">
                <Icon className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">{stepData.title}</h3>
                <span className="text-[11px] font-medium text-primary uppercase tracking-wide">
                  {stepData.badge}
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm text-foreground font-medium leading-snug">{stepData.summary}</p>

          <div className="bg-muted/40 rounded-lg p-3 space-y-2 border border-border/60">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              What you can do here:
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {stepData.details.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary font-bold">▪</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(Boolean(checked))}
            />
            <span>Don't show again on login</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs">
              Skip Tour
            </Button>

            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack} className="text-xs gap-1">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
            )}

            <Button size="sm" onClick={handleNext} className="text-xs gap-1">
              {currentStep < TOUR_STEPS.length - 1 ? (
                <>
                  Next <ArrowRight className="size-3.5" />
                </>
              ) : (
                <>
                  Finish Tour <Check className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
