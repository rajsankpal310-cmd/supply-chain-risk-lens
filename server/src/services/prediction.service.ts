import { PredictionRepository } from "../repositories/prediction.repository";
import { MultiTenantModelRegistry } from "../ml/registry/modelRegistry";

export class PredictionService {
  static async getPredictions(organizationId: string, firmId?: string) {
    const where = firmId ? { firmId } : {};
    const predictions = await PredictionRepository.findMany(organizationId, where);

    const deployedModel = MultiTenantModelRegistry.getDeployedModel(organizationId, "PAYMENT_DELAY_RISK");
    const hasApprovedModel = Boolean(deployedModel && deployedModel.lifecycleState === "DEPLOYED" && deployedModel.isProductionDeployed);

    return predictions.map((p: any) => ({
      id: p.id,
      firmId: p.firmId,
      firmName: p.firm?.name || p.firmId,
      type: p.type,
      probability: p.probability,
      expectedDelayDays: p.expectedDelayDays ?? undefined,
      riskLevel: p.riskLevel,
      predictedDate: p.predictedDate ? p.predictedDate.toISOString().slice(0, 10) : undefined,
      confidence: p.confidence,
      factors: typeof p.factors === "string" ? JSON.parse(p.factors) : p.factors,
      horizon: typeof p.horizon === "string" ? JSON.parse(p.horizon) : p.horizon,
      modelVersion: p.modelVersion,
      isModelPrediction: hasApprovedModel,
      inferenceType: hasApprovedModel ? "APPROVED_ML_MODEL" : "NON_ML_FALLBACK",
      modelStatus: hasApprovedModel ? "DEPLOYED" : "ML_UNAVAILABLE_NO_APPROVED_MODEL",
      governanceNotice: hasApprovedModel ? "APPROVED_FOR_PRODUCTION" : "NOT_FOR_PRODUCTION_DECISIONING",
      disclaimer: hasApprovedModel
        ? "APPROVED_ML_MODEL: Production risk prediction evaluated against governed out-of-time test."
        : "NON_ML_FALLBACK: Benchmark portfolio risk estimate. Production ML is locked. NOT_A_MODEL_PREDICTION.",
    }));
  }

  static async getPredictionById(organizationId: string, id: string) {
    const p = await PredictionRepository.findById(id, organizationId);
    if (!p) throw { status: 404, message: "This resource is not available in your organization." };

    const deployedModel = MultiTenantModelRegistry.getDeployedModel(organizationId, "PAYMENT_DELAY_RISK");
    const hasApprovedModel = Boolean(deployedModel && deployedModel.lifecycleState === "DEPLOYED" && deployedModel.isProductionDeployed);

    return {
      id: p.id,
      firmId: p.firmId,
      firmName: p.firm?.name || p.firmId,
      type: p.type,
      probability: p.probability,
      expectedDelayDays: p.expectedDelayDays ?? undefined,
      riskLevel: p.riskLevel,
      predictedDate: p.predictedDate ? p.predictedDate.toISOString().slice(0, 10) : undefined,
      confidence: p.confidence,
      factors: typeof p.factors === "string" ? JSON.parse(p.factors) : p.factors,
      horizon: typeof p.horizon === "string" ? JSON.parse(p.horizon) : p.horizon,
      modelVersion: p.modelVersion,
      isModelPrediction: hasApprovedModel,
      inferenceType: hasApprovedModel ? "APPROVED_ML_MODEL" : "NON_ML_FALLBACK",
      modelStatus: hasApprovedModel ? "DEPLOYED" : "ML_UNAVAILABLE_NO_APPROVED_MODEL",
      governanceNotice: hasApprovedModel ? "APPROVED_FOR_PRODUCTION" : "NOT_FOR_PRODUCTION_DECISIONING",
      disclaimer: hasApprovedModel
        ? "APPROVED_ML_MODEL: Production risk prediction evaluated against governed out-of-time test."
        : "NON_ML_FALLBACK: Benchmark portfolio risk estimate. Production ML is locked. NOT_A_MODEL_PREDICTION.",
    };
  }
}
