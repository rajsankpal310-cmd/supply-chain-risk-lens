import { Router } from "express";
import { ScenarioController } from "../controllers/scenario.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { scenarioSchema } from "../validators/index";

const router = Router();

router.get("/", authenticate, ScenarioController.getScenarios);
router.get("/:id", authenticate, ScenarioController.getScenarioById);
router.post("/", authenticate, authorize("SME_ADMIN", "ANALYST"), validate(scenarioSchema), ScenarioController.createScenario);
router.put("/:id", authenticate, authorize("SME_ADMIN", "ANALYST"), ScenarioController.updateScenario);
router.delete("/:id", authenticate, authorize("SME_ADMIN"), ScenarioController.deleteScenario);
router.post("/:id/run", authenticate, authorize("SME_ADMIN", "ANALYST"), ScenarioController.runScenario);

export default router;
