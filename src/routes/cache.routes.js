import { Router } from "express";
import * as ctrl from "../controllers/cache.controller.js";

const router = Router();

router.get("/", ctrl.estado);
router.delete("/", ctrl.limpiar);

export default router;