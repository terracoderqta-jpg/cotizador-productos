import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../../utils/apiError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUTA_JSON = path.join(__dirname, "..", "..", "..", "data", "bomMuestras.json");

let datosMock = null;

function cargarDatos({ fuerza = false } = {}) {
  if (!fuerza && datosMock) return datosMock;
  try {
    datosMock = JSON.parse(readFileSync(RUTA_JSON, "utf8"));
  } catch (err) {
    console.error("[BOM-Mock] No se pudo leer data/bomMuestras.json:", err);
    throw new ApiError(500, "No se pudo leer el archivo provisional de BOM (data/bomMuestras.json)");
  }
  return datosMock;
}

function normalizarItems(items) {
  return (items ?? []).map((i) => ({
    codigo_mp: String(i.codigo_mp),
    nombre_mp: i.nombre_mp ?? String(i.codigo_mp),
    cantidad: Number(i.cantidad),
  }));
}

export function listarProductos({ force = false } = {}) {
  const datos = cargarDatos({ fuerza: force });
  return (datos.productos ?? []).map((p) => ({
    producto_id: String(p.producto_id),
    nombre_producto: p.nombre_producto ?? String(p.producto_id),
  }));
}

export function obtenerBOM(productoId, { force = false } = {}) {
  const datos = cargarDatos({ fuerza: force });
  const producto = (datos.productos ?? []).find(
    (p) => String(p.producto_id) === String(productoId)
  );
  if (!producto) {
    throw new ApiError(404, "No se encontró receta para el producto seleccionado");
  }
  return {
    producto_id: String(producto.producto_id),
    nombre_producto: producto.nombre_producto ?? String(producto.producto_id),
    fecha_vigencia: producto.fecha_vigencia ?? new Date().toISOString(),
    items: normalizarItems(producto.items),
  };
}