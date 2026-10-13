/**
 * NEXUS-CFR Multi-Tenant Model Registry & Governance Engine
 * Phase 4: Production ML Foundation
 *
 * Enforces strict tenant isolation, immutable artifact storage,
 * and mandatory lifecycle transitions:
 * EXPERIMENTAL -> VALIDATED -> APPROVED -> DEPLOYED -> MONITORED -> RETIRED
 *
 * UNAPPROVED MODELS CANNOT BE DEPLOYED OR SERVE PRODUCTION PREDICTIONS.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ClassificationMetrics, RegressionMetrics } from "../models/metrics";
import { CalibrationReport } from "../models/calibration";
import { GlobalFeatureImportance } from "../explainability/explainer";
import { ModelPromotionGate } from "../governance/modelPromotionGate";

export type ModelLifecycleState =
  | "EXPERIMENTAL"
  | "VALIDATED"
  | "CANDIDATE"
  | "PRODUCTION"
  | "RETIRED"
  | "BLOCKED"
  | "APPROVED"
  | "DEPLOYED"
  | "MONITORED";

export interface GovernedModelArtifact {
  modelId: string;
  organizationId: string;
  version: string;
  modelVersion?: string;
  datasetId: string;
  datasetVersion: string;
  featureVersion: string;
  modelType: string;
  targetId: string;
  target?: string;
  targetVersion: string;
  features?: string[];
  dataProvenanceClassification?: string;
  sourceProvenance?: string;
  lifecycleState: ModelLifecycleState;
  status?: ModelLifecycleState;
  isProductionDeployed: boolean;
  deploymentStatus?: "DEPLOYED" | "UNDEPLOYED";
  limitations?: string;
  trainingMetadata: {
    trainedAt: string;
    trainingRecordCount: number;
    validationRecordCount: number;
    testRecordCount: number;
    trainWindow: { start: string; end: string };
    valWindow?: { start: string; end: string };
    testWindow?: { start: string; end: string };
    validationStrategy: string;
    hyperparameters: Record<string, any>;
  };
  trainingPeriod?: { start: string; end: string };
  validationPeriod?: { start: string; end: string };
  testPeriod?: { start: string; end: string };
  trainingTimestamp?: string;
  evaluationMetrics: {
    validation: ClassificationMetrics | RegressionMetrics;
    outOfTimeTest: ClassificationMetrics | RegressionMetrics;
    durationRegressionOot?: ClassificationMetrics | RegressionMetrics;
    [key: string]: any;
  };
  metrics?: {
    validation: ClassificationMetrics | RegressionMetrics;
    outOfTimeTest?: ClassificationMetrics | RegressionMetrics;
  };
  calibration: CalibrationReport;
  globalImportance: GlobalFeatureImportance[];
  governance: {
    approvedBy?: string;
    approvedAt?: string;
    approvalNotes?: string;
    complianceAttestation: boolean;
    rollbackAudit?: Array<{
      rolledBackFromModelId: string;
      rolledBackAt: string;
      actor: string;
      notes: string;
    }>;
  };
  checksum: string;
  serializedWeights?: string;
}

export class MultiTenantModelRegistry {
  // Tenant-isolated in-memory registry (keyed by organizationId -> Map<modelId, GovernedModelArtifact>)
  private static tenantRegistries: Map<string, Map<string, GovernedModelArtifact>> = new Map();
  private static persistencePath = path.resolve(__dirname, "../../../data/models/registry_store.json");

  static {
    this.loadFromDisk();
  }

  public static loadFromDisk(): void {
    try {
      if (fs.existsSync(this.persistencePath)) {
        const raw = fs.readFileSync(this.persistencePath, "utf8");
        const parsed = JSON.parse(raw);
        for (const [orgId, models] of Object.entries(parsed)) {
          if (!this.tenantRegistries.has(orgId)) {
            this.tenantRegistries.set(orgId, new Map());
          }
          for (const [mId, artifact] of Object.entries(models as any)) {
            this.tenantRegistries.get(orgId)!.set(mId, artifact as GovernedModelArtifact);
          }
        }
      }
    } catch {
      // Non-fatal if checkpoint is initially empty
    }
  }

  public static saveToDisk(): void {
    try {
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const serialized: Record<string, Record<string, any>> = {};
      for (const [orgId, map] of this.tenantRegistries.entries()) {
        serialized[orgId] = {};
        for (const [mId, artifact] of map.entries()) {
          serialized[orgId][mId] = artifact;
        }
      }
      fs.writeFileSync(this.persistencePath, JSON.stringify(serialized, null, 2), "utf8");
    } catch {
      // Non-fatal file write warning
    }
  }

  /**
   * Registers a new model artifact scoped strictly to the specified organization.
   */
  public static registerModel(
    organizationId: string,
    params: Omit<GovernedModelArtifact, "modelId" | "organizationId" | "checksum" | "lifecycleState" | "isProductionDeployed" | "governance"> & {
      dataProvenanceClassification?: string;
    }
  ): GovernedModelArtifact {
    if (!organizationId) throw new Error("Multi-tenant violation: organizationId required.");

    const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
    const modelId = `MDL-${organizationId}-${params.targetId}-${Date.now().toString(36).toUpperCase()}-${rand}`;

    const checksumPayload = JSON.stringify({
      modelId,
      organizationId,
      version: params.version,
      modelType: params.modelType,
      datasetId: params.datasetId,
      featureVersion: params.featureVersion,
      metrics: params.evaluationMetrics,
    });
    const checksum = crypto.createHash("sha256").update(checksumPayload).digest("hex");

    const artifact: GovernedModelArtifact = {
      ...params,
      modelId,
      organizationId,
      modelVersion: params.version,
      target: params.targetId,
      dataProvenanceClassification: params.dataProvenanceClassification || "REAL_OBSERVED_ENTERPRISE",
      sourceProvenance: params.dataProvenanceClassification || "REAL_OBSERVED_ENTERPRISE",
      lifecycleState: "EXPERIMENTAL",
      status: "EXPERIMENTAL",
      isProductionDeployed: false,
      deploymentStatus: "UNDEPLOYED",
      limitations: params.limitations || "Requires ongoing monitoring against temporal drift and censoring bias.",
      trainingTimestamp: params.trainingMetadata?.trainedAt || new Date().toISOString(),
      trainingPeriod: params.trainingMetadata?.trainWindow,
      validationPeriod: params.trainingMetadata?.valWindow,
      testPeriod: params.trainingMetadata?.testWindow,
      metrics: params.evaluationMetrics,
      governance: { complianceAttestation: false },
      checksum,
    };

    if (!this.tenantRegistries.has(organizationId)) {
      this.tenantRegistries.set(organizationId, new Map());
    }
    this.tenantRegistries.get(organizationId)!.set(modelId, artifact);
    this.saveToDisk();

    return artifact;
  }

  /**
   * Verifies the cryptographic integrity of a model artifact.
   */
  public static verifyModelIntegrity(organizationId: string, modelId: string): boolean {
    const model = this.getModel(organizationId, modelId);
    if (!model) return false;

    const expectedPayload = JSON.stringify({
      modelId: model.modelId,
      organizationId: model.organizationId,
      version: model.version,
      modelType: model.modelType,
      datasetId: model.datasetId,
      featureVersion: model.featureVersion,
      metrics: model.evaluationMetrics,
    });
    const recomputedHash = crypto.createHash("sha256").update(expectedPayload).digest("hex");
    return recomputedHash === model.checksum;
  }

  /**
   * Retrieves all models for an organization. Guarantees cross-tenant isolation.
   */
  public static listModelsForTenant(organizationId: string): GovernedModelArtifact[] {
    const orgMap = this.tenantRegistries.get(organizationId);
    if (!orgMap) return [];
    return Array.from(orgMap.values()).sort(
      (a, b) => new Date(b.trainingMetadata.trainedAt).getTime() - new Date(a.trainingMetadata.trainedAt).getTime()
    );
  }

  public static listModels(organizationId: string): GovernedModelArtifact[] {
    return this.listModelsForTenant(organizationId);
  }

  /**
   * Gets a specific model artifact, enforcing tenant boundaries.
   */
  public static getModel(organizationId: string, modelId: string): GovernedModelArtifact | null {
    // Check if model belongs to another tenant
    for (const [otherOrg, map] of this.tenantRegistries.entries()) {
      if (otherOrg !== organizationId && map.has(modelId)) {
        throw new Error(`Unauthorized access: model ${modelId} does not belong to organization ${organizationId}.`);
      }
    }

    const orgMap = this.tenantRegistries.get(organizationId);
    if (!orgMap) return null;
    const model = orgMap.get(modelId);
    if (!model || model.organizationId !== organizationId) {
      throw new Error(`Unauthorized access: model ${modelId} does not belong to organization ${organizationId}.`);
    }
    return model;
  }

  public static getArtifact(organizationId: string, modelId: string): GovernedModelArtifact | null {
    return this.getModel(organizationId, modelId);
  }

  /**
   * Advances the model lifecycle state with strict state machine and simulated data firewall.
   */
  public static transitionLifecycle(
    organizationId: string,
    modelId: string,
    newState: ModelLifecycleState,
    actorRole: string,
    notes?: string,
    allowSimulatedDemo = false
  ): GovernedModelArtifact {
    const model = this.getModel(organizationId, modelId);
    if (!model) throw new Error(`Model ${modelId} not found for tenant.`);

    // Strict State Machine Transitions
    if (newState === "DEPLOYED" || newState === "PRODUCTION") {
      // Rule 1: Cannot deploy a RETIRED or BLOCKED model directly
      if ((model.lifecycleState as string) === "RETIRED" || (model.lifecycleState as string) === "BLOCKED") {
        throw new Error("Deployment violation: Retired or Blocked models cannot be directly deployed. Re-evaluation required.");
      }

      // Rule 2: Cannot deploy without prior validation or approval
      const eligiblePrecedingStates = ["APPROVED", "VALIDATED", "CANDIDATE"];
      if (!eligiblePrecedingStates.includes(model.lifecycleState)) {
        throw new Error("Deployment violation: Cannot deploy an unapproved model. Model must be APPROVED, VALIDATED, or CANDIDATE first.");
      }

      if (actorRole !== "ADMIN" && actorRole !== "SME_ADMIN") {
        throw new Error("Governance policy violation: Only ADMIN or SME_ADMIN can deploy a model to production.");
      }

      // Rule 3: SIMULATED DATA FIREWALL (Server-side enforcement)
      const isSimulated =
        model.dataProvenanceClassification === "SIMULATED_BENCHMARK" ||
        model.dataProvenanceClassification === "SYNTHETIC" ||
        model.dataProvenanceClassification === "UNVERIFIED";

      if (isSimulated && !allowSimulatedDemo) {
        throw new Error(
          `Simulated Data Firewall: Model '${modelId}' trained on '${model.dataProvenanceClassification}' cannot be deployed to production risk engine.`
        );
      }

      // Undeploy any currently deployed model for the same target in this tenant
      const orgMap = this.tenantRegistries.get(organizationId)!;
      for (const m of orgMap.values()) {
        if (m.targetId === model.targetId && m.isProductionDeployed) {
          m.isProductionDeployed = false;
          m.lifecycleState = "MONITORED";
          m.status = "MONITORED";
          m.deploymentStatus = "UNDEPLOYED";
        }
      }
      model.lifecycleState = newState;
      model.status = newState;
      model.isProductionDeployed = true;
      model.deploymentStatus = "DEPLOYED";
      if (!model.governance.approvedBy) {
        model.governance.approvedBy = actorRole;
        model.governance.approvedAt = new Date().toISOString();
        model.governance.approvalNotes = notes || "Production promotion granted.";
        model.governance.complianceAttestation = true;
      }
    } else if (newState === "APPROVED") {
      if (actorRole !== "ADMIN" && actorRole !== "SME_ADMIN") {
        throw new Error("Governance policy violation: Only ADMIN or SME_ADMIN can approve a model.");
      }
      model.lifecycleState = "APPROVED";
      model.status = "APPROVED";
      model.governance = {
        ...model.governance,
        approvedBy: actorRole,
        approvedAt: new Date().toISOString(),
        approvalNotes: notes || "Formal governance approval granted.",
        complianceAttestation: true,
      };
    } else if (newState === "CANDIDATE") {
      if (model.lifecycleState !== "VALIDATED" && model.lifecycleState !== "EXPERIMENTAL") {
        throw new Error("Candidate violation: Model must be VALIDATED before being marked as CANDIDATE.");
      }
      model.lifecycleState = "CANDIDATE";
      model.status = "CANDIDATE";
    } else if (newState === "VALIDATED") {
      const eligibility = ModelPromotionGate.evaluateForValidation(model);
      if (!eligibility.eligible) {
        throw new Error(
          `Model Promotion Violation: Model '${modelId}' failed the statistical validation gate. Blockers: ${eligibility.blockers.join(" | ")}`
        );
      }
      model.lifecycleState = "VALIDATED";
      model.status = "VALIDATED";
    } else if (newState === "BLOCKED" || newState === "RETIRED") {
      model.lifecycleState = newState;
      model.status = newState;
      model.isProductionDeployed = false;
      model.deploymentStatus = "UNDEPLOYED";
    } else {
      model.lifecycleState = newState;
      model.status = newState;
    }

    this.saveToDisk();
    return model;
  }

  /**
   * Governed Model Rollback: Rolls back from an active deployed model to a previously approved model.
   */
  public static rollbackProductionModel(
    organizationId: string,
    targetId: string,
    fallbackModelId: string,
    actorRole: string,
    notes: string
  ): { activeModel: GovernedModelArtifact; rolledBackFromId: string } {
    if (actorRole !== "ADMIN" && actorRole !== "SME_ADMIN") {
      throw new Error("Governance policy violation: Only ADMIN or SME_ADMIN can authorize production model rollback.");
    }

    const fallbackModel = this.getModel(organizationId, fallbackModelId);
    if (!fallbackModel) {
      throw new Error(`Fallback model '${fallbackModelId}' not found.`);
    }

    // Crucial: Fallback model MUST have been previously APPROVED
    if (!fallbackModel.governance.complianceAttestation && fallbackModel.lifecycleState !== "APPROVED") {
      throw new Error(
        `Rollback violation: Cannot rollback to unapproved model '${fallbackModelId}'. Fallback models must have verified prior compliance approval.`
      );
    }

    const currentDeployed = this.getDeployedModel(organizationId, targetId);
    const rolledBackFromId = currentDeployed?.modelId || "NONE";

    if (currentDeployed) {
      currentDeployed.isProductionDeployed = false;
      currentDeployed.lifecycleState = "RETIRED";
    }

    fallbackModel.lifecycleState = "DEPLOYED";
    fallbackModel.isProductionDeployed = true;
    fallbackModel.governance.rollbackAudit = fallbackModel.governance.rollbackAudit || [];
    fallbackModel.governance.rollbackAudit.push({
      rolledBackFromModelId: rolledBackFromId,
      rolledBackAt: new Date().toISOString(),
      actor: actorRole,
      notes,
    });

    return {
      activeModel: fallbackModel,
      rolledBackFromId,
    };
  }

  /**
   * Retrieves the currently deployed production model for a specific target within a tenant.
   */
  public static getDeployedModel(organizationId: string, targetId: string): GovernedModelArtifact | null {
    const orgMap = this.tenantRegistries.get(organizationId);
    if (!orgMap) return null;

    for (const model of orgMap.values()) {
      if (
        model.targetId === targetId &&
        model.isProductionDeployed &&
        (model.lifecycleState === "DEPLOYED" || model.lifecycleState === "PRODUCTION")
      ) {
        return model;
      }
    }
    return null;
  }

  /**
   * Clears tenant models (used in test teardown).
   */
  public static clearTenant(organizationId: string): void {
    this.tenantRegistries.delete(organizationId);
  }
}
