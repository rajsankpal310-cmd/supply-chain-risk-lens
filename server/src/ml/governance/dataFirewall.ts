/**
 * NEXUS-CFR Real Data Firewall
 * Phase 10: Authentic Public Data Acquisition & Integrity Enforcement
 *
 * Programmatically enforces strict separation between:
 * - VERIFIED_REAL: Authentic, verified enterprise / event transaction data (eligible for real ML)
 * - AGGREGATE_REFERENCE: Macro benchmarks / sector summaries (context priors only, never transaction ML)
 * - BENCHMARK_FIXTURE_SIMULATED: Curated synthetic or simulated datasets (testing / pipeline debug only)
 * - DEMO_FIXTURE: Representative UI demo fixtures (UI demonstration only)
 * - UNVERIFIED / RESTRICTED_REAL: Blocked from all modeling pipelines
 */

export type DataRealnessStatus =
  | "VERIFIED_REAL"
  | "VERIFIED_REAL_STREAMING"
  | "AGGREGATE_REFERENCE"
  | "BENCHMARK_FIXTURE_SIMULATED"
  | "BENCHMARK_FIXTURE"
  | "DEMO_FIXTURE"
  | "RESTRICTED_REAL"
  | "UNVERIFIED";

export type AllowedUsage =
  | "REAL_DATA_ML_TRAINING"
  | "BENCHMARK_CONTEXT_PRIORS"
  | "PIPELINE_TESTING_ONLY"
  | "UI_DEMO_ONLY"
  | "BLOCKED";

export interface FirewallDecision {
  permitted: boolean;
  provenance: DataRealnessStatus;
  allowedUsage: AllowedUsage;
  reason: string;
}

export class DataFirewallViolationError extends Error {
  public readonly provenance: DataRealnessStatus;
  public readonly attemptedUsage: string;

  constructor(provenance: DataRealnessStatus, attemptedUsage: string, reason: string) {
    super(`[DATA FIREWALL VIOLATION] Cannot use dataset with provenance '${provenance}' for '${attemptedUsage}'. Reason: ${reason}`);
    this.name = "DataFirewallViolationError";
    this.provenance = provenance;
    this.attemptedUsage = attemptedUsage;
  }
}

export class DataFirewall {
  /**
   * Asserts that a dataset is authorized and eligible for real-data ML model training.
   * Throws DataFirewallViolationError if non-real data attempts to train a real ML model.
   */
  public static assertRealMLTrainingAllowed(
    datasetId: string,
    provenance: DataRealnessStatus,
    targetName: string
  ): void {
    if (provenance !== "VERIFIED_REAL" && provenance !== "VERIFIED_REAL_STREAMING") {
      let explanation = "";
      if (provenance === "BENCHMARK_FIXTURE_SIMULATED" || provenance === "BENCHMARK_FIXTURE") {
        explanation = "Simulated / fixture datasets are restricted to integration tests and pipeline debugging. They must NEVER be used to claim real-world empirical performance.";
      } else if (provenance === "AGGREGATE_REFERENCE") {
        explanation = "Aggregate reference benchmarks contain sector-level summaries, not transaction-level instances. They must NOT be fed as training observations to transactional ML models.";
      } else if (provenance === "DEMO_FIXTURE") {
        explanation = "Demo fixtures contain stylized mock entities and are strictly intended for UI demonstrations.";
      } else {
        explanation = "Unverified or restricted real data is blocked pending formal authentication and legal consent.";
      }

      throw new DataFirewallViolationError(
        provenance,
        "REAL_DATA_ML_TRAINING",
        `Dataset '${datasetId}' (Target: '${targetName}') was blocked by DataFirewall. ${explanation}`
      );
    }
  }

  /**
   * Evaluates the allowed usage category for any dataset.
   */
  public static evaluateUsage(provenance: DataRealnessStatus): FirewallDecision {
    switch (provenance) {
      case "VERIFIED_REAL":
      case "VERIFIED_REAL_STREAMING":
        return {
          permitted: true,
          provenance,
          allowedUsage: "REAL_DATA_ML_TRAINING",
          reason: "Authentic, independently verified public empirical or authorized enterprise data. Full ML training permitted.",
        };

      case "AGGREGATE_REFERENCE":
        return {
          permitted: true,
          provenance,
          allowedUsage: "BENCHMARK_CONTEXT_PRIORS",
          reason: "Sector / national statistical benchmark. Permitted exclusively for macro priors, distribution comparisons, and risk contextualization.",
        };

      case "BENCHMARK_FIXTURE_SIMULATED":
      case "BENCHMARK_FIXTURE":
        return {
          permitted: true,
          provenance,
          allowedUsage: "PIPELINE_TESTING_ONLY",
          reason: "Curated or simulated dataset. Permitted for integration tests, pipeline contracts, and algorithm regression testing only.",
        };

      case "DEMO_FIXTURE":
        return {
          permitted: true,
          provenance,
          allowedUsage: "UI_DEMO_ONLY",
          reason: "Synthetic demonstration fixture. Permitted exclusively for offline UI layout rendering.",
        };

      case "RESTRICTED_REAL":
        return {
          permitted: false,
          provenance,
          allowedUsage: "BLOCKED",
          reason: "Proprietary or restricted dataset lacking formal execution authorization.",
        };

      case "UNVERIFIED":
      default:
        return {
          permitted: false,
          provenance: "UNVERIFIED",
          allowedUsage: "BLOCKED",
          reason: "Dataset has not passed source provenance or cryptographic verification.",
        };
    }
  }
}
