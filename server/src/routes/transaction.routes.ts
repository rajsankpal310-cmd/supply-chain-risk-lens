import { Router } from "express";
import { TransactionController } from "../controllers/transaction.controller";
import { UploadController } from "../controllers/upload.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { transactionImportSchema, transactionSchema } from "../validators/index";

const router = Router();

router.get("/", authenticate, TransactionController.getTransactions);
router.post("/", authenticate, authorize("SME_ADMIN", "ANALYST"), validate(transactionSchema), TransactionController.createTransaction);
router.get("/:id", authenticate, TransactionController.getTransactionById);
router.put("/:id", authenticate, authorize("SME_ADMIN"), TransactionController.updateTransaction);
router.delete("/:id", authenticate, authorize("SME_ADMIN"), TransactionController.deleteTransaction);
router.post("/import", authenticate, authorize("SME_ADMIN"), validate(transactionImportSchema), UploadController.importTransactions);

export default router;
