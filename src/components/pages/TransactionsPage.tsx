import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download, Network, Plus, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ProvenanceBadge, RiskBadge, StatusBadge } from "@/components/common/badges";
import { DataTable, TablePagination, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, LoadingSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { firmService, transactionService } from "@/services/dataServices";
import type { PaymentStatus, RiskLevel, Transaction } from "@/types";
import { downloadFile, formatDate, formatINR, toCsv } from "@/utils/format";

const STATUSES: (PaymentStatus | "ALL")[] = ["ALL", "PAID", "PENDING", "DELAYED", "CRITICAL"];
const RISKS: (RiskLevel | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function TransactionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "ALL">("ALL");
  const [risk, setRisk] = useState<RiskLevel | "ALL">("ALL");
  const [buyerId, setBuyerId] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState<keyof Transaction>("invoiceDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const firms = useQuery({ queryKey: ["firms"], queryFn: firmService.getFirms });

  const query = useMemo(
    () => ({ search, status, risk, buyerId, from: from || undefined, to: to || undefined, sortBy, sortDir, page, pageSize }),
    [search, status, risk, buyerId, from, to, sortBy, sortDir, page, pageSize],
  );

  const txns = useQuery({
    queryKey: ["transactions", query],
    queryFn: () => transactionService.getTransactions(query),
    placeholderData: keepPreviousData,
  });

  const del = useMutation({
    mutationFn: (id: string) => transactionService.deleteTransaction(id),
    onSuccess: () => {
      toast.success("Transaction deleted");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: () => toast.error("Could not delete the transaction"),
  });

  const firmName = (id?: string) => firms.data?.find((f) => f.id === id)?.name ?? "—";

  function toggleSort(key: string) {
    const k = key as keyof Transaction;
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(k);
      setSortDir("desc");
    }
  }

  const columns: Column<Transaction>[] = [
    {
      key: "id",
      header: "Invoice",
      sortable: true,
      render: (t) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs font-semibold">{t.id}</span>
          <ProvenanceBadge sourceType={t.sourceType} dataStatus={t.dataStatus} />
        </div>
      ),
    },
    { key: "buyerId", header: "Buyer", sortable: true, render: (t) => <span className="font-medium">{firmName(t.buyerId)}</span> },
    { key: "supplierId", header: "Supplier", render: (t) => firmName(t.supplierId) },
    { key: "invoiceAmount", header: "Amount", sortable: true, align: "right", render: (t) => <span className="font-mono">{formatINR(t.invoiceAmount)}</span> },
    { key: "invoiceDate", header: "Invoice date", sortable: true, render: (t) => formatDate(t.invoiceDate) },
    { key: "dueDate", header: "Due date", sortable: true, render: (t) => formatDate(t.dueDate) },
    {
      key: "paymentDelayDays",
      header: "Delay",
      sortable: true,
      align: "right",
      render: (t) => <span className="font-mono">{t.paymentDelayDays != null ? `${t.paymentDelayDays}d` : "—"}</span>,
    },
    { key: "paymentStatus", header: "Status", sortable: true, render: (t) => <StatusBadge status={t.paymentStatus} /> },
    { key: "riskLevel", header: "Risk", sortable: true, align: "right", render: (t) => <RiskBadge level={t.riskLevel} /> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (t) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="View in Supply Chain Network"
            aria-label={`View ${t.id} in Network`}
            onClick={(e) => {
              e.stopPropagation();
              navigate({ to: "/app/network" });
            }}
          >
            <Network className="size-4 text-primary" />
          </Button>
          {can("data:manage") && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${t.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(t);
              }}
            >
              <Trash2 className="text-muted-foreground size-4" aria-hidden />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const items = txns.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Every invoice in the dataset with its ageing, settlement behaviour and computed risk level."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate({ to: "/app/upload" })}>
              <Upload className="size-4" aria-hidden />
              Import
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadFile(
                  "transactions.csv",
                  toCsv(
                    items.map((t) => ({
                      invoice: t.id,
                      buyer: firmName(t.buyerId),
                      supplier: firmName(t.supplierId),
                      amount: t.invoiceAmount,
                      invoiceDate: t.invoiceDate,
                      dueDate: t.dueDate,
                      status: t.paymentStatus,
                      risk: t.riskLevel,
                    })),
                  ),
                  "text/csv",
                );
                toast.success("Current page exported");
              }}
            >
              <Download className="size-4" aria-hidden />
              Export
            </Button>
            {can("data:manage") && (
              <Button onClick={() => navigate({ to: "/app/upload" })}>
                <Plus className="size-4" aria-hidden />
                Add transactions
              </Button>
            )}
          </>
        }
      />

      <Card className="gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Label htmlFor="txn-search" className="sr-only">
              Search transactions
            </Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                id="txn-search"
                placeholder="Search invoice or firm…"
                value={search}
                maxLength={80}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          <FilterSelect label="Status" value={status} options={STATUSES} onChange={(v) => { setStatus(v as PaymentStatus | "ALL"); setPage(1); }} />
          <FilterSelect label="Risk" value={risk} options={RISKS} onChange={(v) => { setRisk(v as RiskLevel | "ALL"); setPage(1); }} />

          <div>
            <Label htmlFor="buyer" className="text-muted-foreground mb-1 block text-xs">
              Buyer
            </Label>
            <Select
              value={buyerId}
              onValueChange={(v) => {
                setBuyerId(v);
                setPage(1);
              }}
            >
              <SelectTrigger id="buyer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All buyers</SelectItem>
                {(firms.data ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="from" className="text-muted-foreground mb-1 block text-xs">
                From
              </Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to" className="text-muted-foreground mb-1 block text-xs">
                To
              </Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {Boolean(search || status !== "ALL" || risk !== "ALL" || buyerId !== "ALL" || from || to) && (
            <div className="border-t pt-2.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Active filters applied</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                  setRisk("ALL");
                  setBuyerId("ALL");
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
                className="gap-1.5 text-xs h-7 text-primary hover:text-primary"
              >
                <RotateCcw className="size-3" />
                Reset all filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {txns.isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No transactions match these filters"
          description="Try clearing the search term or widening the date range."
          actionLabel="Reset filters"
          onAction={() => {
            setSearch("");
            setStatus("ALL");
            setRisk("ALL");
            setBuyerId("ALL");
            setFrom("");
            setTo("");
            setPage(1);
          }}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(t) => t.id}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={toggleSort}
            onRowClick={(t) => navigate({ to: "/app/transactions/$id", params: { id: t.id } })}
          />
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={txns.data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              Invoice {pendingDelete?.id} will be permanently removed from the ledger and risk metrics will be recalculated across connected firms.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) del.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div>
      <Label htmlFor={id} className="text-muted-foreground mb-1 block text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o === "ALL" ? `All ${label.toLowerCase()}` : o.charAt(0) + o.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
