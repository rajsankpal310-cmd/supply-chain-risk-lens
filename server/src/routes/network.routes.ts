import { Router } from "express";
import { NetworkController } from "../controllers/network.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, NetworkController.getNetwork);

export default router;
