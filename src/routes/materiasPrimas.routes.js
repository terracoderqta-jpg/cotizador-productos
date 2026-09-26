import { Router } from "express";
import * as ctrl from "../controllers/materiasPrimas.controller.js";

const router = Router();

router.get("/", ctrl.listar);
router.post("/", ctrl.crear);
router.patch("/:id/estado", ctrl.cambiarEstado);
router.get("/:id/precios", ctrl.historialPrecios);
router.post("/:id/precios", ctrl.actualizarPrecio);

export default router;