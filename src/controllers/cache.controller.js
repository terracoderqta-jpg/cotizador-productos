import { infoCache, limpiarCache } from "../services/cache.service.js";

export function estado(req, res) {
  res.json(infoCache());
}

export function limpiar(req, res) {
  limpiarCache();
  res.json({ ok: true, mensaje: "Caché limpiado" });
}