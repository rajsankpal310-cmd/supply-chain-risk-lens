import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, Bell, Check, CheckCheck, Lightbulb, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ActionConfirmDialog } from "@/components/common/ActionConfirmDialog";
import { RiskBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/PageHeader";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { alertService } from "@/services/decisionServices";
import type { Alert, AlertCategory, RiskLevel } from "@/types";
import { formatDate } from "@/utils/format";

const CATEGORIES: (AlertCategory | "ALL")[] = [
  "ALL",
  "PAYMENT_DELAY",
  "FINANCIAL_STRESS",
  "SUPPLY_CHAIN",
  "CASCADE_RISK",
  "DEADLOCK",
  "CRITICAL_RISK",
];

const SEVERITIES: (RiskLevel | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function AlertsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<AlertCategory | "ALL">("ALL");
  const [severity, setSeverity] = useState<RiskLevel | "ALL">("ALL");
  const [readStatus, setReadStatus] = useState<string>("ALL");
  const [archivingAlert, setArchivingAlert] = useState<Alert | null>(null);

  const alertsQuery = useQuery({
    queryKey: ["alerts"],
    queryFn: alertService.getAlerts,
    placeholderData: keepPreviousData,
  });

  const markReadMutation = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => alertService.markRead(id, read),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => alertService.markAllRead(),
    onSuccess: () => {
      toast.success("All alerts marked as read");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => alertService.archive(id),
    onSuccess: () => {
      toast.success("Alert archived");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  if (alertsQuery.isLoading) return <CardsSkeleton count={6} />;
  if (alertsQuery.isError || !alertsQuery.data)
    return <ErrorState title="Could not load Alerts" description="Error loading risk alert feed." onRetry={() => alertsQuery.refetch()} />;

  const alerts = alertsQuery.data;

  const filteredAlerts = alerts.filter((a) => {
    if (category !== "ALL" && a.category !== category) return false;
    if (severity !== "ALL" && a.severity !== severity) return false;
    if (readStatus === "UNREAD" && (a.read || a.archived)) return false;
    if (readStatus === "READ" && (!a.read || a.archived)) return false;
    if (readStatus === "ARCHIVED" && !a.archived) return false;
    if (readStatus !== "ARCHIVED" && a.archived) return false;
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.read && !a.archived).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Alerts & Notifications"
        description="Real-time risk warnings, payment delay alerts, and supply chain cascade risk notifications."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending} className="gap-1.5 text-xs">
                <CheckCheck className="size-3.5" /> Mark All Read ({unreadCount})
              </Button>
            )}
            <Button variant="outline" onClick={() => alertsQuery.refetch()} disabled={alertsQuery.isFetching}>
              <RefreshCw className={alertsQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
              Refresh Feed
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-medium">Category</span>
            <Select value={category} onValueChange={(v) => setCategory(v as AlertCategory | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c === "ALL" ? "All categories" : c.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-medium">Severity</span>
            <Select value={severity} onValueChange={(v) => setSeverity(v as RiskLevel | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{s === "ALL" ? "All severities" : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-medium">Status</span>
            <Select value={readStatus} onValueChange={setReadStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Active</SelectItem>
                <SelectItem value="UNREAD">Unread</SelectItem>
                <SelectItem value="READ">Read</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {filteredAlerts.length === 0 ? (
        <EmptyState title="No alerts match filters" description="All clear! Try clearing category or status filters." />
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((a) => (
            <Card key={a.id} className={`p-4 transition-colors ${!a.read ? "border-l-4 border-l-primary bg-primary/5" : "border-border/70"}`}>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{a.category.replace("_", " ")}</Badge>
                    <RiskBadge level={a.severity} />
                    <span className="font-mono text-xs text-muted-foreground">{formatDate(a.date)}</span>
                    {!a.read && <span className="bg-risk-critical rounded-full size-2" aria-hidden />}
                  </div>

                  <h3 className="font-semibold text-base pt-1">{a.title}</h3>
                  <Link to="/app/firms/$id" params={{ id: a.firmId }} className="text-xs text-primary font-medium hover:underline inline-block">
                    Firm: {a.firmName} ({a.firmId})
                  </Link>

                  <p className="text-xs text-muted-foreground">{a.reason}</p>
                  <p className="text-xs font-medium text-risk-high">Impact: {a.impact}</p>
                  <p className="text-xs text-muted-foreground">Action: {a.recommendedAction}</p>
                </div>

                <div className="flex flex-wrap md:flex-col items-end gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
                  {!a.read ? (
                    <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate({ id: a.id, read: true })} className="gap-1 text-xs">
                      <Check className="size-3.5" /> Mark Read
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate({ id: a.id, read: false })} className="gap-1 text-xs">
                      Mark Unread
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/recommendations" })} className="gap-1 text-xs">
                    <Lightbulb className="size-3.5" /> Recommendation
                  </Button>
                  {!a.archived && (
                    <Button variant="ghost" size="sm" onClick={() => setArchivingAlert(a)} className="gap-1 text-xs text-muted-foreground">
                      <Archive className="size-3.5" /> Archive
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Alert Archival Confirmation Dialog */}
      <ActionConfirmDialog
        open={Boolean(archivingAlert)}
        onOpenChange={(open) => !open && setArchivingAlert(null)}
        title={`Archive Alert: ${archivingAlert?.title}?`}
        description="Are you sure you want to remove this alert from active monitoring?"
        consequences={[
          "Removes this alert from your active alert badge and inbox feed.",
          "The alert history and audit records remain accessible under the 'Archived' status filter.",
          "Does not affect underlying transaction or counterparty risk metrics.",
        ]}
        confirmLabel="Archive Alert"
        isLoading={archiveMutation.isPending}
        onConfirm={() => {
          if (archivingAlert) archiveMutation.mutate(archivingAlert.id);
        }}
      />
    </div>
  );
}
