import { Router } from "express";
import { PredictionController } from "../controllers/prediction.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, PredictionController.getPredictions);
router.get("/:id", authenticate, PredictionController.getPredictionById);

export default router;
