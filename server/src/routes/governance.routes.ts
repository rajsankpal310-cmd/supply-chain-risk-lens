import { Router } from "express";
import { GovernanceController } from "../controllers/governance.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/audit", authenticate, GovernanceController.getAuditReport);

export default router;
