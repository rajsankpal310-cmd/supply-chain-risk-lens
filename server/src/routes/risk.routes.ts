import { Router } from "express";
import { RiskController } from "../controllers/risk.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/overview", authenticate, RiskController.getOverview);
router.get("/firms/:id", authenticate, RiskController.getFirmRisk);

export default router;
