import { Router } from "express";
import { DeadlockController } from "../controllers/deadlock.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get("/", authenticate, DeadlockController.getDeadlocks);
router.get("/:id", authenticate, DeadlockController.getDeadlockById);
router.post("/:id/resolve", authenticate, authorize("SME_ADMIN", "ANALYST"), DeadlockController.resolveDeadlock);

export default router;
