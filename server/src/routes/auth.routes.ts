import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { loginSchema, registerSchema } from "../validators/index";

const router = Router();

router.post("/login", validate(loginSchema), AuthController.login);
router.post("/register", validate(registerSchema), AuthController.register);
router.get("/me", authenticate, AuthController.me);

// Organization Team Management (SME_ADMIN only)
router.get("/users", authenticate, authorize("SME_ADMIN"), AuthController.listUsers);
router.post("/users", authenticate, authorize("SME_ADMIN"), AuthController.createTeamUser);
router.delete("/users/:id", authenticate, authorize("SME_ADMIN"), AuthController.deleteTeamUser);

export default router;
