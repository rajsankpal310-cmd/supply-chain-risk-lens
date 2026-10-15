import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/summary", authenticate, DashboardController.getSummary);
router.get("/metrics", authenticate, DashboardController.getSummary);

export default router;
