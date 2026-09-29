import { Router } from "express";
import { MLController } from "../controllers/ml.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/targets", MLController.getTargets);
router.get("/features", MLController.getFeatures);
router.get("/readiness", MLController.getReadiness);
router.post("/pipeline/run", MLController.runPipeline);
router.get("/models", MLController.listModels);
router.get("/models/:modelId", MLController.getModelDetails);
router.post("/models/:modelId/transition", MLController.transitionModelLifecycle);
router.post("/predict", MLController.predictInvoice);
router.get("/monitoring", MLController.getMonitoring);
router.get("/risk-bands", MLController.getRiskBands);
router.get("/data-arrival/assessment", MLController.getDataArrivalAssessment);
router.post("/data-arrival/dry-run", MLController.runDataArrivalDryRun);
router.post("/models/:modelId/rollback", MLController.rollbackModel);

// Phase 5: Real Authorized Data Acquisition & First Evidence Run
router.post("/evidence/run", MLController.executeEvidenceRun);
router.get("/evidence/status", MLController.getEvidenceStatus);

export default router;
