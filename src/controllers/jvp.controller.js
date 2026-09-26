import * as jvpService from "../services/jvp.service.js";

export async function listarMovimientos(req, res, next) {
  try {
    res.json(
      jvpService.listarMovimientos({
        codigo: req.query.codigo ?? "",
        tarea: req.query.tarea ?? "",
        buscar: req.query.buscar ?? "",
        limit: req.query.limit ?? 100,
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function listarFormulas(req, res, next) {
  try {
    res.json(jvpService.listarFormulas({ buscar: req.query.buscar ?? "" }));
  } catch (err) {
    next(err);
  }
}

export async function listarTareas(req, res, next) {
  try {
    res.json(jvpService.listarTareas(req.query.codigo ?? ""));
  } catch (err) {
    next(err);
  }
}
