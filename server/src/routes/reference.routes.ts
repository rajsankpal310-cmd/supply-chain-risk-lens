import { Router } from "express";
import { ReferenceController } from "../controllers/reference.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/benchmarks", authenticate, ReferenceController.getSectorBenchmarks);

export default router;
