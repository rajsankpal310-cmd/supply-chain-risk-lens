import { Router } from "express";
import { AlertController } from "../controllers/alert.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, AlertController.getAlerts);
router.put("/read-all", authenticate, AlertController.markAllRead);
router.put("/:id/read", authenticate, AlertController.markRead);
router.put("/:id/archive", authenticate, AlertController.archive);

export default router;
