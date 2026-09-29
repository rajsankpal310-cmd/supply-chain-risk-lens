import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Eye, RefreshCw, Search, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { RiskBadge } from "@/components/common/badges";
import { DataTable, TablePagination, type Column } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, LoadingSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { firmService, relationshipService } from "@/services/dataServices";
import type { Relationship, RiskLevel } from "@/types";
import { formatINR } from "@/utils/format";

const TYPES = ["ALL", "SUPPLIES_TO", "BUYS_FROM", "SUBCONTRACTS"] as const;
const CRITICALITIES: (RiskLevel | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function RelationshipsPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [criticality, setCriticality] = useState<RiskLevel | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<keyof Relationship>("dependencyLevel");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedRel, setSelectedRel] = useState<Relationship | null>(null);
  const pageSize = 10;

  const relsQuery = useQuery({
    queryKey: ["relationships"],
    queryFn: relationshipService.getRelationships,
    placeholderData: keepPreviousData,
  });

  const firmsQuery = useQuery({
    queryKey: ["firms"],
    queryFn: firmService.getFirms,
  });

  const firmName = (id: string) => firmsQuery.data?.find((f) => f.id === id)?.name ?? id;

  const filteredRels = useMemo(() => {
    if (!relsQuery.data) return [];
    const term = search.trim().toLowerCase();
    return relsQuery.data.filter((r) => {
      if (type !== "ALL" && r.type !== type) return false;
      if (criticality !== "ALL" && r.criticality !== criticality) return false;
      if (term) {
        const sName = firmName(r.sourceFirmId).toLowerCase();
        const tName = firmName(r.targetFirmId).toLowerCase();
        if (!sName.includes(term) && !tName.includes(term) && !r.id.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [relsQuery.data, firmsQuery.data, search, type, criticality]);

  const sortedRels = useMemo(() => {
    return [...filteredRels].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRels, sortBy, sortDir]);

  const paginatedRels = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRels.slice(start, start + pageSize);
  }, [sortedRels, page, pageSize]);

  function toggleSort(key: string) {
    const k = key as keyof Relationship;
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(k);
      setSortDir("desc");
    }
  }

  function resetFilters() {
    setSearch("");
    setType("ALL");
    setCriticality("ALL");
    setPage(1);
  }

  const columns: Column<Relationship>[] = [
    { key: "id", header: "ID", sortable: true, render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    {
      key: "sourceFirmId",
      header: "Source Firm",
      sortable: true,
      render: (r) => (
        <Link to="/app/firms/$id" params={{ id: r.sourceFirmId }} className="hover:text-primary font-medium">
          {firmName(r.sourceFirmId)}
        </Link>
      ),
    },
    {
      key: "targetFirmId",
      header: "Target Firm",
      sortable: true,
      render: (r) => (
        <Link to="/app/firms/$id" params={{ id: r.targetFirmId }} className="hover:text-primary font-medium">
          {firmName(r.targetFirmId)}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (r) => <span className="border-border bg-muted/50 rounded px-1.5 py-0.5 text-xs font-medium">{r.type.replace("_", " ")}</span>,
    },
    {
      key: "avgTransactionValue",
      header: "Avg Value",
      sortable: true,
      align: "right",
      render: (r) => <span className="font-mono">{formatINR(r.avgTransactionValue)}</span>,
    },
    { key: "creditPeriodDays", header: "Credit Period", sortable: true, align: "right", render: (r) => <span className="font-mono">{r.creditPeriodDays}d</span> },
    {
      key: "dependencyLevel",
      header: "Dependency",
      sortable: true,
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <div className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
            <div className={`h-full ${r.dependencyLevel > 70 ? "bg-risk-critical" : r.dependencyLevel > 40 ? "bg-risk-high" : "bg-primary"}`} style={{ width: `${r.dependencyLevel}%` }} />
          </div>
          <span className="font-mono text-xs">{r.dependencyLevel}%</span>
        </div>
      ),
    },
    { key: "criticality", header: "Criticality", sortable: true, align: "right", render: (r) => <RiskBadge level={r.criticality} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button variant="ghost" size="icon" aria-label="View Relationship Details" onClick={() => setSelectedRel(r)}>
          <Eye className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supply Chain Relationships"
        description="Buyer-supplier dependency mappings, transaction flow values and criticality ratings."
        actions={
          <Button variant="outline" onClick={() => relsQuery.refetch()} disabled={relsQuery.isFetching}>
            <RefreshCw className={relsQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
            Refresh
          </Button>
        }
      />

      <Card className="gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="rel-search" className="text-muted-foreground mb-1 block text-xs">Search</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input
                id="rel-search"
                placeholder="Search source or target firm…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="rel-type" className="text-muted-foreground mb-1 block text-xs">Relationship Type</Label>
            <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
              <SelectTrigger id="rel-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t === "ALL" ? "All types" : t.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="rel-criticality" className="text-muted-foreground mb-1 block text-xs">Criticality</Label>
            <Select value={criticality} onValueChange={(v) => { setCriticality(v as RiskLevel | "ALL"); setPage(1); }}>
              <SelectTrigger id="rel-criticality"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CRITICALITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c === "ALL" ? "All criticalities" : c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {relsQuery.isLoading ? (
        <LoadingSkeleton rows={10} />
      ) : sortedRels.length === 0 ? (
        <EmptyState
          title="No relationships match criteria"
          description="Try broadening your filter criteria."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={paginatedRels}
            rowKey={(r) => r.id}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={toggleSort}
          />
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={sortedRels.length}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Relationship Detail Modal */}
      <Dialog open={Boolean(selectedRel)} onOpenChange={(open) => !open && setSelectedRel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="text-primary size-5" />
              Relationship {selectedRel?.id}
            </DialogTitle>
            <DialogDescription>Supply chain dependency & transaction terms.</DialogDescription>
          </DialogHeader>

          {selectedRel && (
            <div className="space-y-4 py-2">
              <div className="border-border/70 grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Source Firm</p>
                  <Link to="/app/firms/$id" params={{ id: selectedRel.sourceFirmId }} className="text-primary font-medium hover:underline">
                    {firmName(selectedRel.sourceFirmId)}
                  </Link>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Target Firm</p>
                  <Link to="/app/firms/$id" params={{ id: selectedRel.targetFirmId }} className="text-primary font-medium hover:underline">
                    {firmName(selectedRel.targetFirmId)}
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><span className="text-muted-foreground">Type:</span> <span className="font-semibold">{selectedRel.type.replace("_", " ")}</span></div>
                <div><span className="text-muted-foreground">Credit Period:</span> <span className="font-semibold">{selectedRel.creditPeriodDays} days</span></div>
                <div><span className="text-muted-foreground">Avg Value:</span> <span className="font-semibold">{formatINR(selectedRel.avgTransactionValue)}</span></div>
                <div><span className="text-muted-foreground">Dependency:</span> <span className="font-semibold">{selectedRel.dependencyLevel}%</span></div>
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs font-medium">Criticality</span>
                <RiskBadge level={selectedRel.criticality} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
