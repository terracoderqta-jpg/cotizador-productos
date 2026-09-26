import { Router } from "express";
import * as ctrl from "../controllers/cotizaciones.controller.js";

const router = Router();

router.get("/", ctrl.listar);
router.get("/preparar", ctrl.preparar);
router.get("/historial-producto", ctrl.historialProducto);
router.post("/", ctrl.crear);
router.get("/:id", ctrl.obtenerDetalle);
router.put("/:id", ctrl.actualizar);
router.delete("/:id", ctrl.borrar);

export default router;