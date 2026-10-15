import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/pages/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";
import { DEMO_CREDENTIALS } from "@/services/authService";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEMO_CREDENTIALS.email);
  const [password, setPassword] = useState(DEMO_CREDENTIALS.password);
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 6) next.password = "Password must be at least 6 characters.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const user = await login({ email, password });
      toast.success(`Welcome back, ${user.fullName.split(" ")[0]}`);
      navigate({ to: "/app/dashboard", replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Sign in to NEXUS-CFR" subtitle="Access your risk intelligence workspace.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} autoComplete="email" />
          {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          {errors.password && <p className="text-destructive text-xs">{errors.password}</p>}
        </div>

        <div className="flex items-center justify-between text-xs sm:text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} aria-label="Remember this session" />
            <span className="text-muted-foreground">Remember session</span>
          </label>
          <Link to="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        {formError && (
          <p role="alert" className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        <div className="rounded-lg border border-border/70 bg-card/60 p-3 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="size-4 text-primary" />
            <span>Authoritative Role Accounts</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Select an assigned role to sign in with verified credentials:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setEmail("demo@nexuscfr.in");
                setPassword("demo1234");
                setErrors({});
                setFormError(null);
              }}
              className="rounded-lg border border-border/80 bg-background/70 p-2.5 text-left hover:border-primary/60 hover:bg-accent/40 transition-colors"
            >
              <p className="font-semibold text-foreground text-xs">SME Admin</p>
              <p className="text-[10px] text-primary font-medium mt-0.5">Full Operational Control</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                Manage data ingestion, invoice triage, and payment settlements.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("analyst@nexus-cfr.demo");
                setPassword("demo1234");
                setErrors({});
                setFormError(null);
              }}
              className="rounded-lg border border-border/80 bg-background/70 p-2.5 text-left hover:border-primary/60 hover:bg-accent/40 transition-colors"
            >
              <p className="font-semibold text-foreground text-xs">Risk Analyst</p>
              <p className="text-[10px] text-primary font-medium mt-0.5">Risk & Simulations</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                Investigate financial contagion, shock scenarios, and optimizations.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("viewer@nexus-cfr.demo");
                setPassword("demo1234");
                setErrors({});
                setFormError(null);
              }}
              className="rounded-lg border border-border/80 bg-background/70 p-2.5 text-left hover:border-primary/60 hover:bg-accent/40 transition-colors"
            >
              <p className="font-semibold text-foreground text-xs">Executive</p>
              <p className="text-[10px] text-primary font-medium mt-0.5">Read-Only Monitoring</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                Monitor portfolio resilience, risk bands, and audit reports.
              </p>
            </button>
          </div>
        </div>

        <p className="text-muted-foreground text-center text-sm">
          New to NEXUS-CFR?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
