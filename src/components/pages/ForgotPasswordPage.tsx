import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { AuthShell } from "@/components/pages/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/authService";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    await authService.requestPasswordReset(email.trim());
    setLoading(false);
    setSent(true);
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll send a reset link to your registered email.">
      {sent ? (
        <div className="space-y-4">
          <div className="border-border bg-muted/40 flex items-start gap-3 rounded-md border px-4 py-3">
            <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-sm">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way. In this demo no email is
              actually sent.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} />
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {loading ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
