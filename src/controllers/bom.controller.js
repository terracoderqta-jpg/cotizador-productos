import * as bomService from "../services/bom.service.js";

export async function listarProductos(req, res, next) {
  try {
    res.json(await bomService.listarProductos({ force: req.query.refresh === "true" }));
  } catch (err) {
    next(err);
  }
}

export async function obtenerBOM(req, res, next) {
  try {
    res.json(await bomService.obtenerBOM(req.params.productoId, { force: req.query.refresh === "true" }));
  } catch (err) {
    next(err);
  }
}