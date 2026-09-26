import { Router } from "express";
import * as ctrl from "../controllers/precios.controller.js";

const router = Router();

router.get("/", ctrl.listarPrecios);
router.post("/", ctrl.guardarPrecio);

export default router;
