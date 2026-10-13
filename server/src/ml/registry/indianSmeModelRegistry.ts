import fs from "fs";
import path from "path";
import crypto from "crypto";

export type IndianSmeProductionBoundary =
  | "PUBLIC_DATASET_VALIDATED"
  | "AUTHORIZED_INDIAN_SME_DATA"
  | "INDIAN_SME_MODEL_VALIDATED"
  | "INDIAN_SME_MODEL_APPROVED"
  | "INDIAN_SME_MODEL_DEPLOYED";

export interface IndianSmeModelRecord {
  modelId: string;
  name: string;
  datasetId: string;
  sourceType: string;
  sourceName: string;
  sourceVersion: string;
  datasetHash: string;
  targetId: string;
  featureVersion: string;
  trainingWindow: { start: string; end: string };
  validationWindow: { start: string; end: string };
  testWindow: { start: string; end: string };
  modelArchitecture: string;
  hyperparameters: Record<string, any>;
  classificationMetrics?: {
    rocAuc: number;
    prAuc: number;
    f1: number;
    precision: number;
    recall: number;
    brierScore: number;
    expectedCalibrationError: number;
    confusionMatrix: {
      tp: number;
      fp: number;
      fn: number;
      tn: number;
    };
  };
  regressionMetrics?: {
    mae: number;
    rmse: number;
    r2: number;
    medianAbsoluteError: number;
  };
  calibrationStatus: "CALIBRATED" | "CALIBRATION_NOT_SUPPORTED" | "INSUFFICIENT_STATISTICAL_POWER";
  dataQualityScore: number;
  governanceStatus: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
  approvalStatus: "APPROVED_FOR_DEPLOYMENT" | "AWAITING_COMMITTEE_SIGN_OFF" | "RESTRICTED";
  productionBoundary: IndianSmeProductionBoundary;
  modelArtifact: {
    weights: number[];
    intercept: number;
    featureNames: string[];
    standardScalerMeans: number[];
    standardScalerStds: number[];
  };
  artifactChecksum: string;
  createdAt: string;
  trainedAt: string;
  provenance: {
    datasetPopulation: string;
    country: "IN";
    industryCoverage: string[];
    smePopulationCount: number;
    observationPeriodDays: number;
    knownLimitations: string[];
    validationMethodology: string;
  };
}

const REGISTRY_DIR = path.resolve(__dirname, "../../../data/models");
const REGISTRY_FILE = path.join(REGISTRY_DIR, "indian_sme_payment_delay_registry.json");

export class IndianSmeModelRegistry {
  private static memoryStore: Map<string, IndianSmeModelRecord> = new Map();
  private static activeModelId: string | null = null;

  static init(): void {
    try {
      if (!fs.existsSync(REGISTRY_DIR)) {
        fs.mkdirSync(REGISTRY_DIR, { recursive: true });
      }
      if (fs.existsSync(REGISTRY_FILE)) {
        const raw = fs.readFileSync(REGISTRY_FILE, "utf-8");
        const list: IndianSmeModelRecord[] = JSON.parse(raw);
        for (const m of list) {
          this.memoryStore.set(m.modelId, m);
          if (m.productionBoundary === "INDIAN_SME_MODEL_DEPLOYED" || !this.activeModelId) {
            this.activeModelId = m.modelId;
          }
        }
      }
    } catch (err) {
      console.warn("Could not load Indian SME model registry from disk:", err);
    }
  }

  static saveModel(model: IndianSmeModelRecord): void {
    // Compute artifact checksum
    const serializedArtifact = JSON.stringify(model.modelArtifact);
    const checksum = crypto.createHash("sha256").update(serializedArtifact).digest("hex");
    model.artifactChecksum = checksum;

    this.memoryStore.set(model.modelId, model);
    this.activeModelId = model.modelId;

    // Persist to disk
    try {
      if (!fs.existsSync(REGISTRY_DIR)) {
        fs.mkdirSync(REGISTRY_DIR, { recursive: true });
      }
      const list = Array.from(this.memoryStore.values());
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist Indian SME model record to disk:", err);
    }
  }

  static getModel(modelId: string): IndianSmeModelRecord | undefined {
    return this.memoryStore.get(modelId);
  }

  static getActiveModel(): IndianSmeModelRecord | undefined {
    if (!this.activeModelId) {
      this.init();
    }
    return this.activeModelId ? this.memoryStore.get(this.activeModelId) : undefined;
  }

  static listModels(): IndianSmeModelRecord[] {
    if (this.memoryStore.size === 0) {
      this.init();
    }
    return Array.from(this.memoryStore.values());
  }

  static clear(): void {
    this.memoryStore.clear();
    this.activeModelId = null;
    if (fs.existsSync(REGISTRY_FILE)) {
      try {
        fs.unlinkSync(REGISTRY_FILE);
      } catch (e) {
        // ignore
      }
    }
  }
}

// Initial self-load
IndianSmeModelRegistry.init();
