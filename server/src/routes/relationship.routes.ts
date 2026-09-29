import { Router } from "express";
import { RelationshipController } from "../controllers/relationship.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validate } from "../middleware/validation.middleware";
import { relationshipSchema } from "../validators/index";

const router = Router();

router.get("/", authenticate, RelationshipController.getRelationships);
router.get("/:id", authenticate, RelationshipController.getRelationshipById);
router.post("/", authenticate, authorize("SME_ADMIN"), validate(relationshipSchema), RelationshipController.createRelationship);
router.put("/:id", authenticate, authorize("SME_ADMIN"), RelationshipController.updateRelationship);
router.delete("/:id", authenticate, authorize("SME_ADMIN"), RelationshipController.deleteRelationship);

export default router;
