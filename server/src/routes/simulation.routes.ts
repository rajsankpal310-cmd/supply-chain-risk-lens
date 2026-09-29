import { Router } from "express";
import { SimulationController } from "../controllers/simulation.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, SimulationController.getSimulations);
router.get("/:id", authenticate, SimulationController.getSimulationById);

export default router;
