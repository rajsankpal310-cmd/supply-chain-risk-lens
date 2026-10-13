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

// Phase 8: BPI Enterprise ML Pipeline, Benchmarking, Lineage & Governance
router.post("/bpi/train", MLController.runBPIPipeline);
router.get("/benchmark", MLController.getBenchmarkReport);
router.get("/bpi/predictions", MLController.getBPIPredictions);
router.get("/explainability/:predictionId", MLController.getExplainability);
router.get("/provenance/:predictionId", MLController.getPredictionProvenance);
router.get("/datasets", MLController.listDatasets);
router.get("/leakage-checks", MLController.getLeakageChecks);

// Phase 9: Governed Multi-Source Intelligence & Multi-Task ML
router.get("/sources", MLController.getMultiSources);
router.get("/tasks", MLController.getTasks);
router.post("/tasks/:taskId/train", MLController.trainTask);
router.get("/mendeley/predictions", MLController.getMendeleyPredictions);
router.get("/fusion", MLController.getRiskFusion);
router.get("/networks/domains", MLController.getNetworkDomains);

// Mission 1 & 2: Indian SME Live Connectors & Specific ML
router.get("/indian-sme/status", MLController.getIndianSmeStatus);
router.get("/indian-sme/targets", MLController.getIndianSmeTargets);
router.post("/indian-sme/readiness-gate", MLController.runIndianSmeReadinessGate);
router.post("/indian-sme/pipeline/run", MLController.runIndianSmePipeline);
router.get("/indian-sme/model", MLController.getIndianSmeModel);
router.post("/indian-sme/network", MLController.getIndianSmeNetwork);
router.post("/indian-sme/cascade", MLController.simulateIndianSmeCascade);
router.post("/indian-sme/resolution", MLController.getIndianSmeResolutions);

// College Launch & Upload Validation (Stage 1 Public ML + Stage 2 Future SME Adaptation)
router.get("/college-launch/status", MLController.getCollegeLaunchStatus);
router.post("/college-launch/predict/fulton", MLController.predictFulton);
router.post("/college-launch/predict/bpi", MLController.predictBpi);
router.post("/upload/validate", MLController.validateUpload);
router.post("/adaptation/compare", MLController.compareDomainAdaptation);

export default router;

