import { Router } from "express";
import { OptimizationController } from "../controllers/optimization.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { optimizationSchema } from "../validators/index";

const router = Router();

router.post("/run", authenticate, authorize("SME_ADMIN", "ANALYST"), validate(optimizationSchema), OptimizationController.runOptimization);
router.get("/:id", authenticate, OptimizationController.getOptimizationById);

export default router;
