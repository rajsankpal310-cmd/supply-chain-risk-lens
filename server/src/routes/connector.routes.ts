import { Router } from "express";
import { ConnectorController } from "../controllers/connector.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", ConnectorController.listConnectors);
router.get("/contract", ConnectorController.getCanonicalContract);

// Phase 5 & 6: Primary Source Onboarding Routes
router.post("/sources/register", ConnectorController.registerSource);
router.get("/sources", ConnectorController.listSources);
router.post("/sources/:sourceId/authorize", ConnectorController.authorizeSource);
router.post("/sources/:sourceId/test-connection", ConnectorController.testSourceConnection);
router.post("/sources/:sourceId/onboard", ConnectorController.onboardSourceData);

// Phase 6 & 7: First-Class Controlled File Ingestion & Audit Events
router.post("/controlled-file/ingest", ConnectorController.ingestControlledFile);
router.get("/audit/events", ConnectorController.getAuditEvents);
router.get("/template/download", ConnectorController.downloadTemplate);
router.get("/template/spec", ConnectorController.getTemplateSpec);
router.get("/acquisition/status", ConnectorController.getAcquisitionStatus);

// Phase 5: Quarantine & Review Routes
router.get("/quarantine", ConnectorController.listQuarantine);
router.post("/quarantine/:quarantineId/review", ConnectorController.reviewQuarantine);

router.get("/:id", ConnectorController.getConnector);
router.post("/:id/test", ConnectorController.testConnector);

export default router;
