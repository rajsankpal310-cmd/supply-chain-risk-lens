import { Router } from "express";
import { DecisionNetworkController } from "../controllers/decisionNetwork.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get("/", authenticate, DecisionNetworkController.getOverview);
router.get("/nodes/:firmId", authenticate, DecisionNetworkController.getNodeContext);
router.post("/runs", authenticate, authorize("SME_ADMIN", "ANALYST"), DecisionNetworkController.createRun);
router.get("/runs/:runId", authenticate, DecisionNetworkController.getRunById);
router.post("/runs/:runId/simulate", authenticate, DecisionNetworkController.simulateRun);
router.post("/options/:optionId/review", authenticate, authorize("SME_ADMIN", "ANALYST"), DecisionNetworkController.reviewOption);

export default router;
