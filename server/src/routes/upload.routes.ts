import { Router } from "express";
import { UploadController } from "../controllers/upload.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.post("/inspect", authenticate, authorize("SME_ADMIN", "ANALYST"), UploadController.inspectSchema);
router.post("/validate", authenticate, authorize("SME_ADMIN", "ANALYST"), UploadController.validateDataset);
router.post("/import", authenticate, authorize("SME_ADMIN"), UploadController.importTransactions);
router.get("/batches", authenticate, UploadController.getImportBatches);
router.get("/batches/:id", authenticate, UploadController.getImportBatchById);

export default router;
