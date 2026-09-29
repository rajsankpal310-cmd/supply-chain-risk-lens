import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { ProvenanceBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { governanceService } from "@/services/dataServices";
import { formatINR } from "@/utils/format";

export function DataGovernanceAuditTab() {
  const auditQuery = useQuery({
    queryKey: ["governance-audit"],
    queryFn: () => governanceService.getAuditReport(),
  });

  if (auditQuery.isLoading) {
    return (
      <Card className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" />
        <span>Executing Data Foundation & ML Readiness Audit across PostgreSQL...</span>
      </Card>
    );
  }

  const audit = auditQuery.data?.data || auditQuery.data;

  if (!audit) {
    return (
      <Card className="p-8 text-center text-xs text-muted-foreground">
        Unable to load governance audit report. Please ensure server is running and database is connected.
      </Card>
    );
  }

  const summary = audit.mlGateSummary;
  const scorecard = audit.statisticalSufficiencyScorecard;
  const thresholds = scorecard?.thresholds;

  return (
    <div className="space-y-6">
      {/* 1. ML Gate Status Banner */}
      <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Lock className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  ML Readiness Gate
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/50 bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  STATUS: {audit.mlGateStatus}
                </Badge>
              </div>
              <h2 className="text-sm font-semibold text-foreground mt-0.5">
                {summary?.verdict || "DATA FOUNDATION ARCHITECTURALLY READY; STATISTICALLY CONSTRAINED FOR PRODUCTION TRAINING"}
              </h2>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => auditQuery.refetch()}
            disabled={auditQuery.isFetching}
            className="text-xs gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={auditQuery.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
            Re-Audit Foundation
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-amber-500/20 text-xs">
          <div className="space-y-1">
            <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" /> Primary Blocker:
            </span>
            <p className="text-muted-foreground">{summary?.primaryBlocker}</p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <ArrowRight className="size-3.5" /> Actionable Next Requirement:
            </span>
            <p className="text-muted-foreground">{summary?.actionableRequirement}</p>
          </div>
        </div>
      </Card>

      {/* 2. Statistical Sufficiency & Scale Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase font-medium">Total Transactions</span>
          <p className="text-lg font-mono font-bold">{scorecard?.totalTransactions ?? 0}</p>
          <div className="flex items-center gap-1 text-[10px]">
            {thresholds?.isSampleSufficient ? (
              <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle2 className="size-3" /> Sufficient</span>
            ) : (
              <span className="text-amber-500 flex items-center gap-0.5"><AlertCircle className="size-3" /> Min 500 req</span>
            )}
          </div>
        </Card>

        <Card className="p-3 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase font-medium">Distinct Buyers</span>
          <p className="text-lg font-mono font-bold">{scorecard?.distinctBuyers ?? 0}</p>
          <div className="flex items-center gap-1 text-[10px]">
            {thresholds?.isBuyerDiversitySufficient ? (
              <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle2 className="size-3" /> Sufficient</span>
            ) : (
              <span className="text-amber-500 flex items-center gap-0.5"><AlertCircle className="size-3" /> Min 50 req</span>
            )}
          </div>
        </Card>

        <Card className="p-3 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase font-medium">Distinct SMEs</span>
          <p className="text-lg font-mono font-bold">{scorecard?.distinctSMEs ?? 0}</p>
          <span className="text-[10px] text-muted-foreground">Vendors in tenant</span>
        </Card>

        <Card className="p-3 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase font-medium">Total Ledger Volume</span>
          <p className="text-sm font-mono font-bold truncate">{formatINR(scorecard?.totalInvoiceVolumeINR ?? 0)}</p>
          <span className="text-[10px] text-muted-foreground">Gross billing value</span>
        </Card>

        <Card className="p-3 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase font-medium">Timeline Span</span>
          <p className="text-lg font-mono font-bold">{scorecard?.temporalSpanDays ?? 0}d</p>
          <span className="text-[10px] text-muted-foreground">~{thresholds?.currentSpanMonths ?? 0} months</span>
        </Card>

        <Card className="p-3 space-y-1">
          <span className="text-[11px] text-muted-foreground uppercase font-medium">Right-Censored Invoices</span>
          <p className="text-lg font-mono font-bold text-amber-500">
            {audit.targetVariableAudits?.[0]?.rightCensoringRatePercent ?? 0}%
          </p>
          <span className="text-[10px] text-muted-foreground">Open / unsettled invoices</span>
        </Card>
      </div>

      {/* 3. Dataset Inventory & Provenance Matrix */}
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Database className="size-4 text-primary" />
            Active Dataset Inventory & Provenance Truth Matrix
          </h3>
          <p className="text-xs text-muted-foreground">
            Authoritative accounting of all datasets loaded in your workspace, distinguishing simulated benchmarks from administrative reference.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dataset Name</TableHead>
                <TableHead>Origin / Publisher</TableHead>
                <TableHead>Authenticity Classification</TableHead>
                <TableHead>Granularity</TableHead>
                <TableHead className="text-right">Observations</TableHead>
                <TableHead>Collection Period</TableHead>
                <TableHead>Known Limitations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.datasetInventory?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold text-xs max-w-48">
                    {item.name}
                    <div className="text-[10px] font-mono text-muted-foreground font-normal">v{item.version} • {item.license}</div>
                  </TableCell>
                  <TableCell className="text-xs max-w-44">
                    <span className="font-medium">{item.sourceOrg}</span>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{item.sourceUrl}</div>
                  </TableCell>
                  <TableCell>
                    <ProvenanceBadge sourceType={item.sourceType} dataStatus={item.dataStatus} />
                  </TableCell>
                  <TableCell className="text-xs font-mono">{item.granularity}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">{item.observationsCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.collectionPeriod}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-56">
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      {item.knownLimitations?.slice(0, 2).map((lim: string, idx: number) => (
                        <li key={idx} className="truncate" title={lim}>{lim}</li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 3.1 Four-Domain Analytical Architecture */}
      {audit.fourDomainArchitecture && audit.fourDomainArchitecture.length > 0 && (
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Four-Domain Analytical Architecture (Decoupled Without Artificial Joins)
            </h3>
            <p className="text-xs text-muted-foreground">
              NEXUS-CFR rigorously maintains separate analytical domains. Microdata, administrative aggregates, and external references are never artificially row-joined without genuine entity tax identifiers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {audit.fourDomainArchitecture.map((d: any) => (
              <Card key={d.domain} className="p-3.5 space-y-2 border-border/80 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-mono font-semibold">
                    {d.domain}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">{d.authenticityClassification}</span>
                </div>
                <div className="text-xs font-medium text-foreground">{d.sourceDataset}</div>
                <p className="text-[11px] text-muted-foreground leading-snug">{d.role}</p>
                <div className="pt-2 border-t border-border/60 text-[10px] space-y-1">
                  <span className="font-semibold text-primary block">Join Policy:</span>
                  <p className="text-muted-foreground leading-tight">{d.joinRule}</p>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* 3.2 Audited Candidate Sources Log */}
      {audit.candidateSourceAudits && audit.candidateSourceAudits.length > 0 && (
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-primary" />
              Audited Real-World Data Candidates & Provenance Evaluation Log
            </h3>
            <p className="text-xs text-muted-foreground">
              Autonomous research evaluation of external datasets. In accordance with data truth principles, candidate sources on public hubs (Kaggle, GitHub) were audited and classified by empirical evidence without synthetic upgrades.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate Dataset</TableHead>
                  <TableHead>Publisher / Source</TableHead>
                  <TableHead>Authenticity</TableHead>
                  <TableHead>Record Scale</TableHead>
                  <TableHead>Collection Evidence</TableHead>
                  <TableHead>Integration Verdict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.candidateSourceAudits.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold text-xs max-w-44">
                      {c.name}
                      <div className="text-[10px] font-mono text-muted-foreground">{c.candidateSource}</div>
                    </TableCell>
                    <TableCell className="text-xs max-w-36">
                      <span className="font-medium">{c.publisher}</span>
                      <div className="text-[10px] text-muted-foreground font-mono">{c.license}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          c.authenticityClassification === "REAL_OBSERVED"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-mono text-[10px]"
                            : c.authenticityClassification === "ADMINISTRATIVE_AGGREGATE"
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/30 font-mono text-[10px]"
                            : c.authenticityClassification === "SURVEY_MICRODATA"
                            ? "bg-purple-500/10 text-purple-600 border-purple-500/30 font-mono text-[10px]"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/30 font-mono text-[10px]"
                        }
                      >
                        {c.authenticityClassification}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      <div>{c.recordCount}</div>
                      <div className="text-[10px] text-muted-foreground">{c.entityCount}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-64 leading-snug">
                      {c.collectionEvidence}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          c.integrationStatus === "REJECTED_AS_SIMULATED"
                            ? "bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-mono"
                            : c.integrationStatus === "INTEGRATED_SEPARATE_DOMAIN"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-mono"
                            : c.integrationStatus === "RESTRICTED_ACCESS"
                            ? "bg-purple-500/10 text-purple-600 border-purple-500/30 text-[10px] font-mono"
                            : "bg-muted text-foreground text-[10px] font-mono"
                        }
                      >
                        {c.integrationStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* 4. Target Variable Formulation & Right-Censoring Analysis */}
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Scale className="size-4 text-primary" />
            Target Variable Formulation & Censoring Analysis
          </h3>
          <p className="text-xs text-muted-foreground">
            Mathematical definitions of prediction targets, addressing right-censoring in open invoices to prevent survival bias.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {audit.targetVariableAudits?.map((target: any) => (
            <Card key={target.name} className="p-4 space-y-2.5 border-border/80 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary">{target.name}</span>
                <Badge variant="outline" className="text-[10px] font-mono">{target.type}</Badge>
              </div>

              <div className="rounded bg-background/80 p-2 font-mono text-[11px] border border-border/60">
                {target.formula}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Available Observed:</span>
                  <span className="font-mono font-semibold text-foreground">{target.availableObservations}</span>
                </div>
                <div className="flex justify-between">
                  <span>Right-Censored:</span>
                  <span className="font-mono font-semibold text-amber-500">
                    {target.rightCensoredObservations} ({target.rightCensoringRatePercent}%)
                  </span>
                </div>
                {target.positiveEventCount !== undefined && (
                  <div className="flex justify-between">
                    <span>Positive Class (Delayed):</span>
                    <span className="font-mono text-foreground font-semibold">
                      {target.positiveEventCount} vs {target.negativeEventCount}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border/60 space-y-1 text-[11px]">
                <span className="font-semibold text-destructive flex items-center gap-1">
                  <XCircle className="size-3" /> Imputation Risk:
                </span>
                <p className="text-muted-foreground text-[10px] leading-tight">{target.naiveImputationRisk}</p>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* 5. Feature Eligibility & Leakage Prevention Matrix */}
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            Feature Eligibility & Leakage Prevention Matrix
          </h3>
          <p className="text-xs text-muted-foreground">
            Formal audit ensuring future payment clearing information cannot contaminate prediction features at invoice issuance (t₀).
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field / Feature</TableHead>
                <TableHead>Availability at t₀ (Issuance)</TableHead>
                <TableHead>Eligibility Status</TableHead>
                <TableHead>Leakage Risk Level</TableHead>
                <TableHead>Operational Definition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.featureEligibilityMatrix?.map((f: any) => (
                <TableRow key={f.fieldName}>
                  <TableCell className="font-mono text-xs font-semibold">{f.fieldName}</TableCell>
                  <TableCell className="text-xs">
                    {f.predictionPointAvailability === "AVAILABLE_AT_T0" ? (
                      <span className="text-emerald-500 font-medium flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Available at t₀
                      </span>
                    ) : (
                      <span className="text-destructive font-medium flex items-center gap-1">
                        <XCircle className="size-3" /> Post-Issuance Only
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {f.eligibilityStatus === "ELIGIBLE" ? (
                      <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-500/40 bg-emerald-500/10">
                        ELIGIBLE
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-mono text-destructive border-destructive/40 bg-destructive/10">
                        FORBIDDEN LEAKAGE
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {f.leakageRiskLevel === "NONE" ? (
                      <span className="text-emerald-500 text-xs font-medium">None</span>
                    ) : f.leakageRiskLevel === "HIGH" ? (
                      <span className="text-amber-500 text-xs font-semibold">High</span>
                    ) : (
                      <span className="text-destructive text-xs font-bold uppercase tracking-wider">Fatal</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-72">{f.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 6. Temporal Validation Protocol */}
      <Card className="p-5 space-y-3 bg-muted/20 border-border/80">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          Mandatory Temporal Validation Protocol (Out-of-Time Splitting)
        </h3>
        <p className="text-xs text-muted-foreground">
          {audit.temporalValidationProtocol?.rationale}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5 text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" /> Approved Protocol: Out-of-Time Chronological Split
            </span>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
              {audit.temporalValidationProtocol?.splittingRules?.map((rule: string, idx: number) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1.5 text-xs">
            <span className="font-semibold text-destructive flex items-center gap-1.5">
              <XCircle className="size-3.5" /> Prohibited Protocol: Random K-Fold Cross-Validation
            </span>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Standard random train_test_split or random K-Fold CV randomly allocates invoices from the same buyer across train and test sets.
              This allows future settlement behavior of a buyer in the test set to leak into earlier invoices in the training set, producing severely inflated, ungeneralizable accuracy metrics.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
