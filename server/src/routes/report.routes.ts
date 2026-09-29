import { Router } from "express";
import { ReportController } from "../controllers/report.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get("/", authenticate, ReportController.getReports);
router.post("/:id/generate", authenticate, authorize("SME_ADMIN", "ANALYST"), ReportController.generate);

export default router;
