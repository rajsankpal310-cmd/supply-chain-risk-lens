import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Building2, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RiskBadge } from "@/components/common/badges";
import { DataTable, TablePagination, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, LoadingSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { firmService } from "@/services/dataServices";
import { INDUSTRIES } from "@/mocks/data";
import type { Firm, FirmRole, RiskLevel } from "@/types";
import { formatINR } from "@/utils/format";

const ROLES: (FirmRole | "ALL")[] = ["ALL", "SME", "BUYER", "SUPPLIER", "BUYER_SUPPLIER"];
const RISKS: (RiskLevel | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function FirmsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("ALL");
  const [risk, setRisk] = useState<RiskLevel | "ALL">("ALL");
  const [role, setRole] = useState<FirmRole | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<keyof Firm>("riskScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const query = useQuery({
    queryKey: ["firms"],
    queryFn: firmService.getFirms,
    placeholderData: keepPreviousData,
  });

  const filteredFirms = useMemo(() => {
    if (!query.data) return [];
    const term = search.trim().toLowerCase();
    return query.data.filter((f) => {
      if (industry !== "ALL" && f.industry !== industry) return false;
      if (risk !== "ALL" && f.riskLevel !== risk) return false;
      if (role !== "ALL" && f.role !== role) return false;
      if (term) {
        const text = `${f.name} ${f.id} ${f.city} ${f.industry}`.toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
  }, [query.data, search, industry, risk, role]);

  const sortedFirms = useMemo(() => {
    return [...filteredFirms].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredFirms, sortBy, sortDir]);

  const paginatedFirms = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedFirms.slice(start, start + pageSize);
  }, [sortedFirms, page, pageSize]);

  function toggleSort(key: string) {
    const k = key as keyof Firm;
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(k);
      setSortDir("desc");
    }
  }

  function resetFilters() {
    setSearch("");
    setIndustry("ALL");
    setRisk("ALL");
    setRole("ALL");
    setPage(1);
  }

  const columns: Column<Firm>[] = [
    {
      key: "name",
      header: "Firm Name",
      sortable: true,
      render: (f) => (
        <div>
          <p className="hover:text-primary font-medium">{f.name}</p>
          <p className="text-muted-foreground font-mono text-[11px]">{f.id} · {f.city}</p>
        </div>
      ),
    },
    { key: "industry", header: "Industry", sortable: true, render: (f) => <span className="text-xs">{f.industry}</span> },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (f) => (
        <span className="border-border bg-muted/50 rounded px-1.5 py-0.5 font-mono text-[11px]">
          {f.role.replace("_", " ")}
        </span>
      ),
    },
    { key: "transactionCount", header: "Txns", sortable: true, align: "right", render: (f) => <span className="font-mono">{f.transactionCount}</span> },
    { key: "avgPaymentDelayDays", header: "Avg Delay", sortable: true, align: "right", render: (f) => <span className="font-mono">{f.avgPaymentDelayDays}d</span> },
    { key: "outstandingAmount", header: "Outstanding", sortable: true, align: "right", render: (f) => <span className="font-mono">{formatINR(f.outstandingAmount)}</span> },
    { key: "annualTurnover", header: "Turnover", sortable: true, align: "right", render: (f) => <span className="text-muted-foreground font-mono text-xs">{formatINR(f.annualTurnover)}</span> },
    { key: "cashBufferDays", header: "Buffer", sortable: true, align: "right", render: (f) => <span className="font-mono text-xs">{f.cashBufferDays}d</span> },
    { key: "financialStress", header: "Stress", sortable: true, align: "right", render: (f) => <span className="font-mono text-xs font-semibold">{f.financialStress}%</span> },
    { key: "riskScore", header: "Risk Level", sortable: true, align: "right", render: (f) => <RiskBadge level={f.riskLevel} score={f.riskScore} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Firms Directory"
        description="Comprehensive analysis of connected buyers, suppliers and SMEs with risk profiles and financial metrics."
        actions={
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
            Refresh
          </Button>
        }
      />

      <Card className="gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="firm-search" className="text-muted-foreground mb-1 block text-xs">Search</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                id="firm-search"
                placeholder="Search firm, ID or city…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="firm-industry" className="text-muted-foreground mb-1 block text-xs">Industry</Label>
            <Select value={industry} onValueChange={(v) => { setIndustry(v); setPage(1); }}>
              <SelectTrigger id="firm-industry"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All industries</SelectItem>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="firm-risk" className="text-muted-foreground mb-1 block text-xs">Risk Level</Label>
            <Select value={risk} onValueChange={(v) => { setRisk(v as RiskLevel | "ALL"); setPage(1); }}>
              <SelectTrigger id="firm-risk"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISKS.map((r) => (
                  <SelectItem key={r} value={r}>{r === "ALL" ? "All risk levels" : r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="firm-role" className="text-muted-foreground mb-1 block text-xs">Firm Role</Label>
            <Select value={role} onValueChange={(v) => { setRole(v as FirmRole | "ALL"); setPage(1); }}>
              <SelectTrigger id="firm-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r === "ALL" ? "All roles" : r.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {query.isLoading ? (
        <LoadingSkeleton rows={10} />
      ) : sortedFirms.length === 0 ? (
        <EmptyState
          title="No firms match your filter criteria"
          description="Try broadening your search term or clearing filters."
          actionLabel="Clear all filters"
          onAction={resetFilters}
        />
      ) : (
        <>
          {/* Mobile Firm Cards */}
          <div className="grid gap-3 sm:hidden">
            {paginatedFirms.map((f) => (
              <Card
                key={f.id}
                className="p-3.5 space-y-2.5 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate({ to: "/app/firms/$id", params: { id: f.id } })}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{f.name}</h3>
                    <p className="font-mono text-xs text-muted-foreground">{f.id} · {f.city}</p>
                  </div>
                  <RiskBadge level={f.riskLevel} score={f.riskScore} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Role / Industry</span>
                    <span className="font-medium text-foreground capitalize">{f.role.replace("_", " ").toLowerCase()} · {f.industry}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Outstanding</span>
                    <span className="font-mono font-semibold text-foreground">{formatINR(f.outstandingAmount)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Avg Delay</span>
                    <span className="font-mono font-medium text-foreground">{f.avgPaymentDelayDays} days</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Stress / Buffer</span>
                    <span className="font-mono font-medium text-foreground">{f.financialStress}% · {f.cashBufferDays}d</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop & Tablet Table */}
          <div className="hidden sm:block">
            <DataTable
              columns={columns}
              rows={paginatedFirms}
              rowKey={(f) => f.id}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={toggleSort}
              onRowClick={(f) => navigate({ to: "/app/firms/$id", params: { id: f.id } })}
            />
          </div>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={sortedFirms.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
