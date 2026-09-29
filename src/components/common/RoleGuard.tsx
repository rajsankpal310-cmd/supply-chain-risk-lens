import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";

interface RoleGuardProps {
  allowed: UserRole[];
  featureName?: string;
  children: ReactNode;
}

export function RoleGuard({ allowed, featureName = "this module", children }: RoleGuardProps) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return null;
  }

  const userRole = user?.role;
  const isAllowed = Boolean(userRole && allowed.includes(userRole));

  if (!isAllowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-lg p-8 text-center border-destructive/40 shadow-lg space-y-5">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-7" aria-hidden />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider text-destructive border-destructive/40">
                HTTP 403 Forbidden
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                Role: {userRole ? userRole.replace("_", " ") : "Unauthenticated"}
              </Badge>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Access Restricted</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your authenticated role does not have authorization to access <span className="font-semibold text-foreground">{featureName}</span>.
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground text-left space-y-1">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Lock className="size-3.5 text-primary" /> RBAC Security Policy
            </p>
            <p>
              This route is restricted to <span className="font-semibold text-foreground">{allowed.map((r) => r.replace("_", " ")).join(", ")}</span> users.
              Authoritative backend validation will reject any mutation requests.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button onClick={() => navigate({ to: "/app/dashboard" })} className="gap-2">
              <ArrowLeft className="size-4" /> Return to Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/app/profile" })}>
              View Account Profile
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
