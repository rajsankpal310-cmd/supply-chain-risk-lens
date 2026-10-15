import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportService } from "@/services/decisionServices";
import type { Report } from "@/types";
import { downloadFile, formatDate } from "@/utils/format";

export function ReportsPage() {
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: reportService.getReports,
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => reportService.generate(id),
    onSuccess: (updated) => {
      toast.success(`${updated.name} generated successfully`);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: () => toast.error("Could not generate report"),
  });

  if (reportsQuery.isLoading) return <CardsSkeleton count={6} />;
  if (reportsQuery.isError || !reportsQuery.data)
    return <ErrorState title="Could not load Reports" description="Error loading report catalog." onRetry={() => reportsQuery.refetch()} />;

  const reports = reportsQuery.data;

  function handleExport(report: Report, format: "csv" | "json") {
    try {
      const payload = reportService.buildPayload(report, format);
      downloadFile(payload.filename, payload.content, payload.mime);
      toast.success(`Exported ${report.name} as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(`Could not export ${report.name}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Risk & Supply Chain Reports"
        description="Generate, view, and export structured compliance, risk, scenario, and deadlock analysis reports."
        actions={
          <Button variant="outline" onClick={() => reportsQuery.refetch()} disabled={reportsQuery.isFetching}>
            <RefreshCw className={reportsQuery.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
            Refresh Catalog
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.id} className="p-5 flex flex-col justify-between space-y-4 border-border/70">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="text-primary size-5 shrink-0" />
                  <h3 className="font-semibold text-base">{r.name}</h3>
                </div>
                <Badge variant="outline" className={r.status === "READY" ? "text-risk-low border-risk-low/40 bg-risk-low/10 text-[10px]" : "text-muted-foreground text-[10px]"}>
                  {r.status.replace("_", " ")}
                </Badge>
              </div>

              <p className="text-muted-foreground mt-2 text-xs">{r.description}</p>

              {r.lastGeneratedAt && (
                <p className="font-mono text-[11px] text-muted-foreground mt-3">
                  Last generated: {formatDate(r.lastGeneratedAt)}
                </p>
              )}
            </div>

            <div className="border-t border-border/60 pt-3 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate(r.id)}
                disabled={generateMutation.isPending}
                className="gap-1.5 text-xs h-8"
              >
                {generateMutation.isPending && generateMutation.variables === r.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                {r.status === "READY" ? "Regenerate" : "Generate"}
              </Button>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport(r, "csv")}
                  disabled={r.status !== "READY"}
                  className="gap-1 text-xs h-8 px-2"
                >
                  <Download className="size-3.5" /> CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport(r, "json")}
                  disabled={r.status !== "READY"}
                  className="gap-1 text-xs h-8 px-2"
                >
                  <Download className="size-3.5" /> JSON
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
