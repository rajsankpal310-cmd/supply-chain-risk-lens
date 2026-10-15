import { Router } from "express";
import { SimulationController } from "../controllers/simulation.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get("/", authenticate, SimulationController.getSimulations);
router.get("/:id", authenticate, SimulationController.getSimulationById);
router.post("/run", authenticate, authorize("SME_ADMIN", "ANALYST"), SimulationController.runSimulation);

export default router;
