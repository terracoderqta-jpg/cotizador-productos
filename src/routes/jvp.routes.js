import { Router } from "express";
import * as ctrl from "../controllers/jvp.controller.js";

const router = Router();

router.get("/movimientos", ctrl.listarMovimientos);
router.get("/formulas", ctrl.listarFormulas);
router.get("/tareas", ctrl.listarTareas);

export default router;
