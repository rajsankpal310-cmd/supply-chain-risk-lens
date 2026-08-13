import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Landmark, Users } from "lucide-react";
import { RiskBadge, StatusBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, LoadingSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { firmService, transactionService } from "@/services/dataServices";
import { formatDate, formatINR } from "@/utils/format";

export function TransactionDetailPage() {
  const { id } = useParams({ from: "/app/transactions/$id" });
  const navigate = useNavigate();
  const txn = useQuery({ queryKey: ["transaction", id], queryFn: () => transactionService.getTransactionById(id) });
  const firms = useQuery({ queryKey: ["firms"], queryFn: firmService.getFirms });
  const related = useQuery({
    queryKey: ["related-transactions", id],
    queryFn: () => transactionService.getRelatedTransactions(txn.data!),
    enabled: Boolean(txn.data),
  });

  if (txn.isLoading) return <LoadingSkeleton rows={6} />;
  if (!txn.data)
    return (
      <EmptyState
        title="Transaction not found"
        description={`No invoice matches the reference ${id}.`}
        actionLabel="Back to transactions"
        onAction={() => navigate({ to: "/app/transactions" })}
      />
    );

  const t = txn.data;
  const name = (fid?: string) => firms.data?.find((f) => f.id === fid)?.name ?? "—";
  const timeline = [
    { label: "Invoice raised", date: t.invoiceDate, icon: Landmark },
    { label: "Payment due", date: t.dueDate, icon: CalendarClock },
    { label: t.paymentDate ? "Payment received" : "Payment pending", date: t.paymentDate, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/transactions">
          <ArrowLeft className="size-4" aria-hidden />
          Back to transactions
        </Link>
      </Button>

      <PageHeader
        title={`Invoice ${t.id}`}
        description={`${name(t.buyerId)} · ${formatINR(t.invoiceAmount)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={t.paymentStatus} />
            <RiskBadge level={t.riskLevel} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-4 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Invoice details</h2>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label="Buyer" value={name(t.buyerId)} />
            <Detail label="Supplier" value={name(t.supplierId)} />
            <Detail label="Invoice amount" value={formatINR(t.invoiceAmount)} mono />
            <Detail label="Outstanding" value={formatINR(t.outstandingAmount)} mono />
            <Detail label="Invoice date" value={formatDate(t.invoiceDate)} />
            <Detail label="Due date" value={formatDate(t.dueDate)} />
            <Detail label="Credit period" value={t.creditPeriodDays ? `${t.creditPeriodDays} days` : "—"} />
            <Detail label="Payment delay" value={t.paymentDelayDays != null ? `${t.paymentDelayDays} days` : "Not settled"} mono />
          </dl>

          <Separator />

          <h2 className="text-sm font-semibold">Payment timeline</h2>
          <ol className="space-y-4">
            {timeline.map((step) => (
              <li key={step.label} className="flex items-start gap-3">
                <span className="bg-primary/12 text-primary mt-0.5 grid size-8 shrink-0 place-items-center rounded-md">
                  <step.icon className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-muted-foreground font-mono text-xs">{step.date ? formatDate(step.date) : "Awaiting settlement"}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card className="gap-3 p-5">
            <h2 className="text-sm font-semibold">Risk assessment</h2>
            <p className="text-muted-foreground text-sm">
              This invoice is rated <span className="text-foreground font-medium">{t.riskLevel.toLowerCase()}</span> risk based on the buyer's
              settlement history, the size of the exposure and how far the invoice has aged past its due date.
            </p>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>• Buyer average delay: {firms.data?.find((f) => f.id === t.buyerId)?.avgPaymentDelayDays ?? "—"} days</li>
              <li>• Exposure share of buyer outstanding: {formatINR(t.outstandingAmount)}</li>
              <li>• Status: {t.paymentStatus.toLowerCase()}</li>
            </ul>
            <Button variant="outline" asChild className="mt-1">
              <Link to="/app/firms/$id" params={{ id: t.buyerId }}>
                View buyer profile
              </Link>
            </Button>
          </Card>

          <Card className="gap-3 p-5">
            <h2 className="text-sm font-semibold">Related transactions</h2>
            {(related.data ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No other invoices for this buyer.</p>
            ) : (
              <ul className="divide-border/70 divide-y">
                {(related.data ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link to="/app/transactions/$id" params={{ id: r.id }} className="hover:text-primary font-mono text-xs">
                      {r.id}
                    </Link>
                    <span className="font-mono">{formatINR(r.invoiceAmount)}</span>
                    <StatusBadge status={r.paymentStatus} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">{label}</dt>
      <dd className={mono ? "mt-1 font-mono text-sm font-medium" : "mt-1 text-sm font-medium"}>{value}</dd>
    </div>
  );
}
