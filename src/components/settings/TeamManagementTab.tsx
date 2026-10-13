import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { getRoleLabel } from "@/layouts/AppLayout";
import { authService } from "@/services/authService";
import type { User, UserRole } from "@/types";

export function TeamManagementTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ANALYST" | "VIEWER">("ANALYST");
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});

  const teamQuery = useQuery({
    queryKey: ["team-users"],
    queryFn: () => authService.getTeamUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      fullName: string;
      email: string;
      password: string;
      role: "ANALYST" | "VIEWER";
    }) => authService.createTeamUser(data),
    onSuccess: (newUser) => {
      toast.success(
        `Added ${newUser.fullName} as ${getRoleLabel(newUser.role)}`
      );
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
      setAddModalOpen(false);
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("ANALYST");
      setFormErrors({});
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to add team member");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authService.removeTeamUser(id),
    onSuccess: () => {
      toast.success("Team member access revoked");
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to remove team member");
    },
  });

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: typeof formErrors = {};
    if (fullName.trim().length < 2) errors.fullName = "Full name is required.";
    if (!/^\S+@\S+\.\S+$/.test(email))
      errors.email = "Valid work email is required.";
    if (password.length < 6)
      errors.password = "Password must be at least 6 characters.";

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    createMutation.mutate({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      role,
    });
  }

  const teamMembers = teamQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Overview Header Card */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-border/80 bg-card/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h3 className="font-semibold text-base text-foreground">
              Organization Team Members
            </h3>
            <Badge variant="outline" className="text-xs">
              {teamMembers.length} Active {teamMembers.length === 1 ? "User" : "Users"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage your organization workspace users. Only SME Admins can invite team members and assign Risk Analyst or Executive roles.
          </p>
        </div>

        <Button onClick={() => setAddModalOpen(true)} className="gap-2 shrink-0">
          <UserPlus className="size-4" /> Add Team Member
        </Button>
      </Card>

      {/* Team Members List */}
      <Card className="p-0 overflow-hidden border-border/80">
        <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Members ({user?.organizationName || user?.companyName || "Organization"})
          </h4>
          <span className="text-xs text-muted-foreground">
            Authoritative RBAC Enforced
          </span>
        </div>

        {teamQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading team members…
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No team members found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Access Level</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => {
                  const isCurrent = member.id === user?.id;
                  const isSmeAdmin = member.role === "SME_ADMIN";

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                              {member.avatarInitials ||
                                member.fullName
                                  .split(" ")
                                  .map((p) => p[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground">
                                {member.fullName}
                              </span>
                              {isCurrent && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                                  You
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {member.id}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {member.email}
                      </TableCell>

                      <TableCell>
                        {member.role === "SME_ADMIN" ? (
                          <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/40 gap-1 text-xs">
                            <Shield className="size-3" />
                            {getRoleLabel(member.role)}
                          </Badge>
                        ) : member.role === "ANALYST" ? (
                          <Badge variant="secondary" className="gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30">
                            <TrendingUp className="size-3" />
                            {getRoleLabel(member.role)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                            <Eye className="size-3" />
                            {getRoleLabel(member.role)}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {member.role === "SME_ADMIN"
                          ? "Full workspace admin & data ingestion"
                          : member.role === "ANALYST"
                          ? "Risk analytics, simulations & deadlocks"
                          : "Read-only portfolio & executive monitor"}
                      </TableCell>

                      <TableCell className="text-right">
                        {isCurrent || isSmeAdmin ? (
                          <span className="text-xs text-muted-foreground italic">
                            Protected
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
                            onClick={() => setDeleteTarget(member)}
                          >
                            <Trash2 className="size-3.5" /> Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Role Capabilities Guide */}
      <Card className="p-4 bg-muted/15 border-dashed border-border/80">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-primary" /> Supported Team Roles & Permissions
        </h4>
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="p-3 rounded-lg border border-border/70 bg-card/40 space-y-1">
            <p className="font-semibold text-foreground">SME Admin</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Organization account owner. Can ingest ledgers, configure settings, manage team seats, and approve decision actions.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-border/70 bg-card/40 space-y-1">
            <p className="font-semibold text-foreground">Risk Analyst</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Technical credit & risk modeling. Access to financial deadlock investigation, stress scenario simulations, and risk distributions.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-border/70 bg-card/40 space-y-1">
            <p className="font-semibold text-foreground">Executive</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              High-level decision makers. Read-only access to executive resilience monitors, portfolio risk trends, recommendations, and audit reports.
            </p>
          </div>
        </div>
      </Card>

      {/* Add Team Member Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" /> Add Team Member
            </DialogTitle>
            <DialogDescription>
              Create credentials for a colleague in {user?.organizationName || user?.companyName || "your organization"}. Normal users cannot self-select roles during registration.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tm-fullName" className="text-xs">Full Name</Label>
              <Input
                id="tm-fullName"
                placeholder="e.g. Priya Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              {formErrors.fullName && (
                <p className="text-destructive text-xs">{formErrors.fullName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tm-email" className="text-xs">Work Email</Label>
              <Input
                id="tm-email"
                type="email"
                placeholder="colleague@yourcompany.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {formErrors.email && (
                <p className="text-destructive text-xs">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tm-password" className="text-xs">Initial Password</Label>
              <Input
                id="tm-password"
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {formErrors.password && (
                <p className="text-destructive text-xs">{formErrors.password}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tm-role" className="text-xs">Assigned Platform Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "ANALYST" | "VIEWER")}
              >
                <SelectTrigger id="tm-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANALYST">
                    Risk Analyst (Analytics, Simulator, Deadlocks)
                  </SelectItem>
                  <SelectItem value="VIEWER">
                    Executive (Read-Only Portfolio & Health Monitor)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Roles are strictly enforced via authoritative backend JWT checks.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddModalOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {createMutation.isPending ? "Adding Member…" : "Create Team Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke Access Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Revoke Team Member Access?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke platform access for{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.fullName}
              </span>{" "}
              ({deleteTarget?.email})?
            </DialogDescription>
          </DialogHeader>

          <div className="text-xs text-muted-foreground bg-destructive/10 border border-destructive/20 rounded-md p-3">
            This user will no longer be able to sign in or access any organization data. Their account will be removed immediately.
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {deleteMutation.isPending ? "Revoking…" : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
