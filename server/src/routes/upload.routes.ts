import { Router } from "express";
import { UploadController } from "../controllers/upload.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validateUploadLimit } from "../middleware/uploadLimit.middleware";

const router = Router();

router.post("/inspect", validateUploadLimit, authenticate, authorize("SME_ADMIN", "ANALYST"), UploadController.inspectSchema);
router.post("/validate", validateUploadLimit, authenticate, authorize("SME_ADMIN", "ANALYST"), UploadController.validateDataset);
router.post("/import", validateUploadLimit, authenticate, authorize("SME_ADMIN"), UploadController.importTransactions);
router.get("/batches", authenticate, UploadController.getImportBatches);
router.get("/batches/:id", authenticate, UploadController.getImportBatchById);

export default router;
