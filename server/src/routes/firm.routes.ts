import { Router } from "express";
import { FirmController } from "../controllers/firm.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { firmSchema } from "../validators/index";

const router = Router();

router.get("/", authenticate, FirmController.getFirms);
router.get("/:id", authenticate, FirmController.getFirmById);
router.get("/:id/transactions", authenticate, FirmController.getFirmTransactions);
router.get("/:id/relationships", authenticate, FirmController.getFirmRelationships);
router.post("/", authenticate, authorize("SME_ADMIN"), validate(firmSchema), FirmController.createFirm);
router.put("/:id", authenticate, authorize("SME_ADMIN"), FirmController.updateFirm);
router.delete("/:id", authenticate, authorize("SME_ADMIN"), FirmController.deleteFirm);

export default router;
