import * as service from "../services/cotizaciones.service.js";

export async function listar(req, res, next) {
  try {
    res.json(await service.listar(req.query.limite));
  } catch (err) {
    next(err);
  }
}

export async function preparar(req, res, next) {
  try {
    res.json(await service.prepararCotizacion(req.query.producto_id));
  } catch (err) {
    next(err);
  }
}

export async function crear(req, res, next) {
  try {
    const cotizacion = await service.grabarCotizacion(req.body);
    res.status(201).json(cotizacion);
  } catch (err) {
    next(err);
  }
}

export async function obtenerDetalle(req, res, next) {
  try {
    res.json(await service.obtenerDetalle(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function historialProducto(req, res, next) {
  try {
    res.json(await service.historialProducto(req.query.producto_id));
  } catch (err) {
    next(err);
  }
}

export async function borrar(req, res, next) {
  try {
    res.json(await service.borrarCotizacion(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function actualizar(req, res, next) {
  try {
    res.json(await service.actualizarCotizacion(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}