import { ApiError } from "../utils/apiError.js";
import * as repo from "../repositories/materiasPrimas.repository.js";

const ESTADOS = new Set(["activo", "inactivo"]);

export async function listarMateriasPrimas() {
  return repo.findAll();
}

export async function crearMateriaPrima({ nombre, unidad_medida } = {}) {
  const nombreLimpio = (nombre || "").trim();
  const unidadLimpia = (unidad_medida || "").trim();

  if (!nombreLimpio) throw new ApiError(400, "El nombre es obligatorio");
  if (!unidadLimpia) throw new ApiError(400, "La unidad de medida es obligatoria");

  return repo.create({ nombre: nombreLimpio, unidad_medida: unidadLimpia });
}

export async function cambiarEstado(id, estado) {
  if (!ESTADOS.has(estado)) {
    throw new ApiError(400, "Estado inválido: debe ser 'activo' o 'inactivo'");
  }
  const mp = await repo.updateEstado(id, estado);
  if (!mp) throw new ApiError(404, "Materia prima no encontrada");
  return mp;
}

export async function actualizarPrecio(id, precio) {
  const precioNumerico = Number(precio);
  if (!Number.isFinite(precioNumerico) || precioNumerico < 0) {
    throw new ApiError(400, "El precio unitario debe ser un número mayor o igual a 0");
  }
  const registro = await repo.insertPrecio(id, precioNumerico);
  if (!registro) throw new ApiError(404, "Materia prima no encontrada");
  return registro;
}

export async function historialPrecios(id) {
  const mp = await repo.findById(id);
  if (!mp) throw new ApiError(404, "Materia prima no encontrada");
  return repo.findPrecios(id);
}