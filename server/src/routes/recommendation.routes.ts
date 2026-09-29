import { Router } from "express";
import { RecommendationController } from "../controllers/recommendation.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get("/", authenticate, RecommendationController.getRecommendations);
router.put("/:id/status", authenticate, authorize("SME_ADMIN", "ANALYST"), RecommendationController.setStatus);

export default router;
