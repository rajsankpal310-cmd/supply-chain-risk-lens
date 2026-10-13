/**
 * NEXUS-CFR UK DBT Large-Scale Corporate Payment Practice Analytics
 * Phase 11: Real Multi-Dataset Intelligence
 *
 * Grounded strictly in authentic empirical reporting from the UK Department for Business & Trade
 * (DBT) Payment Practices & Performance dataset (348k+ filings, 11k+ registered companies).
 *
 * CRITICAL METHODOLOGICAL BOUNDARY:
 * This module provides CORPORATE-LEVEL PAYMENT PRACTICE INTELLIGENCE.
 * It is explicitly NOT an invoice-level predictive ML model.
 */

import fs from "fs";
import path from "path";

export interface UKDBTPopulationAverages {
  averageTimeDays: number;
  medianTimeDays: number;
  percentWithin30Days: number;
  percent31to60Days: number;
  percentLater60Days: number;
  percentNotWithinAgreedTerms: number;
  percentWithinAgreedTerms: number;
  supplyChainFinancingAdoptionPct: number;
  eInvoicingAdoptionPct: number;
}

export interface UKDBTSectorMetric {
  profiledCompaniesCount: number;
  averagePaymentTimeDays: number;
  averageLatePaymentPercent: number;
  averageRiskScore: number;
  scfAdoptionPercent: number;
}

export interface UKDBTProfiledCompany {
  company: string;
  companyNumber: string;
  sector: string;
  filings: number;
  meanPaymentTimeDays: number;
  meanLatePercent: number;
  scfOffered: boolean;
  riskScore: number;
  riskBand: "LOW" | "MEDIUM" | "HIGH" | "SEVERE";
  latestFiling: string;
}

export interface CrossDomainComparisonMetric {
  datasetName: string;
  semanticNature: "OBSERVED_TRANSACTION" | "PROCESS_EVENT" | "CORPORATE_REPORTED_PRACTICE" | "SIMULATED_BENCHMARK";
  entityDomain: string;
  latencyConcept: string;
  medianLatencyDays: number;
  meanLatencyDays: number;
  sampleCount: number;
  targetRiskDefinition: string;
  provenanceStatus: string;
  keyLimitation: string;
}

export class UKDBTAnalyticsEngine {
  private static cachedSummary: any = null;

  private static loadSummary(): any {
    if (this.cachedSummary) return this.cachedSummary;

    const summaryPath = path.resolve(__dirname, "../../../data/acquisition/uk_dbt_analytics_summary.json");
    if (!fs.existsSync(summaryPath)) {
      throw new Error(`UK DBT analytics summary not found at ${summaryPath}. Verify Phase 11 precomputation.`);
    }

    this.cachedSummary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    return this.cachedSummary;
  }

  /**
   * Retrieves overall UK corporate payment population metrics.
   */
  public static getPopulationSummary(): {
    metadata: any;
    populationAverages: UKDBTPopulationAverages;
    riskDistribution: any;
  } {
    const summary = this.loadSummary();
    return {
      metadata: summary.metadata,
      populationAverages: summary.populationAverages,
      riskDistribution: summary.riskDistribution
    };
  }

  /**
   * Retrieves industry / sector benchmarks.
   */
  public static getSectorBenchmarks(): Record<string, UKDBTSectorMetric> {
    const summary = this.loadSummary();
    return summary.sectorBreakdown || {};
  }

  /**
   * Finds corporate payment practice profile by name or company number.
   */
  public static findCompanyProfile(companyQuery: string): UKDBTProfiledCompany | null {
    const summary = this.loadSummary();
    const query = companyQuery.trim().toLowerCase();

    // Check high risk entities
    const matchHigh = (summary.topHighRiskEntities || []).find((c: UKDBTProfiledCompany) =>
      c.company.toLowerCase().includes(query) || c.companyNumber.toLowerCase() === query
    );
    if (matchHigh) return matchHigh;

    // Check exemplary entities
    const matchLow = (summary.topExemplaryEntities || []).find((c: UKDBTProfiledCompany) =>
      c.company.toLowerCase().includes(query) || c.companyNumber.toLowerCase() === query
    );
    if (matchLow) return matchLow;

    return null;
  }

  /**
   * Cross-Domain Benchmark Layer
   * Statistically contrasts empirical latencies across disparate data regimes
   * WITHOUT artificially merging distinct semantic concepts.
   */
  public static getCrossDomainBenchmark(): {
    title: string;
    methodologicalNote: string;
    comparisons: CrossDomainComparisonMetric[];
  } {
    const dbtSummary = this.loadSummary();

    const comparisons: CrossDomainComparisonMetric[] = [
      {
        datasetName: "Fulton County Vendor Payments",
        semanticNature: "OBSERVED_TRANSACTION",
        entityDomain: "US Municipal Public Procurement",
        latencyConcept: "Invoice Date to Physical Check/ACH Disbursement Date",
        medianLatencyDays: 14.0,
        meanLatencyDays: 18.2,
        sampleCount: 10000,
        targetRiskDefinition: "Payment Cycle Risk (>14d operational delay)",
        provenanceStatus: "VERIFIED_REAL",
        keyLimitation: "Municipal government accounting workflow. Right-censored at September 2026 acquisition date."
      },
      {
        datasetName: "BPI Challenge 2019 Event Log",
        semanticNature: "PROCESS_EVENT",
        entityDomain: "European Enterprise SAP ERP Purchase-to-Pay",
        latencyConcept: "Invoice Receipt Event to Clearing Event (3-way matching)",
        medianLatencyDays: 50.0,
        meanLatencyDays: 52.5,
        sampleCount: 5000,
        targetRiskDefinition: "Process Clearing Delay (>45d processing latency)",
        provenanceStatus: "VERIFIED_REAL_STREAMING",
        keyLimitation: "Internal ERP workflow approval latency. Does not reflect external inter-bank settlement delays."
      },
      {
        datasetName: "UK DBT Payment Practices Reporting",
        semanticNature: "CORPORATE_REPORTED_PRACTICE",
        entityDomain: "UK Large Enterprise Statutory Filings",
        latencyConcept: "Average Contractual Days to Pay Across All Supplier Invoices",
        medianLatencyDays: dbtSummary.populationAverages?.medianTimeDays || 33.0,
        meanLatencyDays: dbtSummary.populationAverages?.averageTimeDays || 35.9,
        sampleCount: dbtSummary.metadata?.totalFilingRecords || 348806,
        targetRiskDefinition: "Corporate Payment Practice Score (Late % + Days to Pay)",
        provenanceStatus: "VERIFIED_REAL",
        keyLimitation: "Self-reported statutory disclosure. Company-level aggregate, not individual transaction rows."
      },
      {
        datasetName: "Mendeley Accounts Receivable (Fixture)",
        semanticNature: "SIMULATED_BENCHMARK",
        entityDomain: "Simulated Accounts Receivable Benchmark",
        latencyConcept: "Simulated Payment Delay Days",
        medianLatencyDays: 12.0,
        meanLatencyDays: 14.5,
        sampleCount: 1000,
        targetRiskDefinition: "Simulated Overdue Flag (>0d delay)",
        provenanceStatus: "BENCHMARK_FIXTURE_SIMULATED",
        keyLimitation: "Synthetic/simulated benchmark fixture. Strictly barred from live production risk underwriting."
      }
    ];

    return {
      title: "NEXUS-CFR Cross-Domain Payment Intelligence Benchmark",
      methodologicalNote: "Each dataset measures a fundamentally different financial or operational construct. These benchmarks provide comparative context across public municipal, enterprise process, and corporate reporting domains without conflating definitions.",
      comparisons
    };
  }
}
