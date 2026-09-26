import * as service from "../services/materiasPrimas.service.js";

export async function listar(req, res, next) {
  try {
    res.json(await service.listarMateriasPrimas());
  } catch (err) {
    next(err);
  }
}

export async function crear(req, res, next) {
  try {
    const mp = await service.crearMateriaPrima(req.body);
    res.status(201).json(mp);
  } catch (err) {
    next(err);
  }
}

export async function cambiarEstado(req, res, next) {
  try {
    res.json(await service.cambiarEstado(req.params.id, req.body.estado));
  } catch (err) {
    next(err);
  }
}

export async function actualizarPrecio(req, res, next) {
  try {
    const registro = await service.actualizarPrecio(req.params.id, req.body.precio_unitario);
    res.status(201).json(registro);
  } catch (err) {
    next(err);
  }
}

export async function historialPrecios(req, res, next) {
  try {
    res.json(await service.historialPrecios(req.params.id));
  } catch (err) {
    next(err);
  }
}