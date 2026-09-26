import { Router } from "express";
import * as ctrl from "../controllers/bom.controller.js";

const router = Router();

router.get("/", ctrl.listarProductos);
router.get("/:productoId/bom", ctrl.obtenerBOM);

export default router;