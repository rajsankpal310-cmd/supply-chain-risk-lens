import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/pages/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";

interface FieldErrors {
  fullName?: string;
  company?: string;
  email?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", company: "", email: "", password: "", confirm: "" });
  const [industry, setIndustry] = useState("Manufacturing");
  const [companySize, setCompanySize] = useState("11-50");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const strength = (() => {
    const p = form.password;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (form.fullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (form.company.trim().length < 2) next.company = "Enter your company name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match.";
    if (!terms) next.terms = "Please accept the terms to continue.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await register({
        fullName: form.fullName.trim(),
        companyName: form.company.trim(),
        email: form.email.trim(),
        password: form.password,
        industry,
        companySize,
      });
      toast.success("Account created — welcome to NEXUS-CFR");
      navigate({ to: "/app/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Set up a workspace and start analysing risk on demo data.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="fullName" label="Full name" value={form.fullName} error={errors.fullName} onChange={(v) => set("fullName", v)} />
        <Field id="company" label="Company name" value={form.company} error={errors.company} onChange={(v) => set("company", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {["Manufacturing", "Auto Components", "Textiles", "Pharma", "Electronics", "Logistics", "Food Processing"].map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companySize">Company size</Label>
            <select
              id="companySize"
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {["1-10", "11-50", "51-200", "200+"].map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>
        <Field id="email" label="Work email" type="email" value={form.email} error={errors.email} onChange={(v) => set("email", v)} />
        <div className="space-y-1.5">
          <Field id="password" label="Password" type="password" value={form.password} error={errors.password} onChange={(v) => set("password", v)} />
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < strength ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>
        <Field id="confirm" label="Confirm password" type="password" value={form.confirm} error={errors.confirm} onChange={(v) => set("confirm", v)} />

        <div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={terms} onCheckedChange={(v) => setTerms(Boolean(v))} aria-label="Accept terms" className="mt-0.5" />
            <span className="text-muted-foreground">
              I understand this is a demo platform using sample data and accept the terms of use.
            </span>
          </label>
          {errors.terms && <p className="text-destructive mt-1 text-xs">{errors.terms}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {loading ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-muted-foreground text-center text-sm">
          Already registered?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  type?: string | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} maxLength={120} />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
