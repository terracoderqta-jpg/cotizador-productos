import { bigquery, bqConfig } from "../../config/bigquery.js";
import { getCache, setCache } from "../cache.service.js";
import { ApiError } from "../../utils/apiError.js";

const LISTA_PRODUCTOS_KEY = "productos";
const PREFIJO_BOM_KEY = "bom:";

function verificarConfiguracion() {
  if (!bqConfig.fullTable || bqConfig.fullTable.includes("undefined")) {
    throw new ApiError(
      500,
      "Configuración de BigQuery incompleta: defina BQ_PROJECT_ID, BQ_DATASET_ID y BQ_BOM_TABLE en .env"
    );
  }
}

/**
 * Lista los productos disponibles (lectura del BOM en BigQuery),
 * con caché en memoria de 24 h.
 */
export async function listarProductos({ force = false } = {}) {
  verificarConfiguracion();
  if (!force) {
    const cacheado = getCache(LISTA_PRODUCTOS_KEY);
    if (cacheado) return cacheado;
  }

  const query = `
    SELECT DISTINCT
      \`${bqConfig.colProducto}\` AS producto_id,
      \`${bqConfig.colNombreProducto}\` AS nombre_producto
    FROM \`${bqConfig.fullTable}\`
    ORDER BY nombre_producto ASC
  `;

  let rows;
  try {
    [rows] = await bigquery.query({ query, location: bqConfig.location });
  } catch (err) {
    console.error("[BigQuery] listarProductos:", err);
    throw new ApiError(502, "Error consultando BigQuery al listar productos");
  }

  const productos = rows.map((r) => ({
    producto_id: String(r.producto_id),
    nombre_producto: r.nombre_producto ?? String(r.producto_id),
  }));

  setCache(LISTA_PRODUCTOS_KEY, productos, bqConfig.cacheTtlMs);
  return productos;
}

/**
 * Obtiene la última receta (BOM) de un producto. Usa QUALIFY para
 * quedarse con el snapshot más reciente y caché de 24 h.
 */
export async function obtenerBOM(productoId, { force = false } = {}) {
  verificarConfiguracion();
  if (!productoId) throw new ApiError(400, "El código de producto es obligatorio");

  const key = `${PREFIJO_BOM_KEY}${productoId}`;
  if (!force) {
    const cacheado = getCache(key);
    if (cacheado) return cacheado;
  }

  const filtroFecha =
    bqConfig.maxDays > 0
      ? ` AND \`${bqConfig.colFecha}\` >= @fechaMinima`
      : "";

  const query = `
    SELECT
      \`${bqConfig.colProducto}\` AS producto_id,
      \`${bqConfig.colNombreProducto}\` AS nombre_producto,
      \`${bqConfig.colCodigoMp}\` AS codigo_mp,
      \`${bqConfig.colNombreMp}\` AS nombre_mp,
      \`${bqConfig.colCantidad}\` AS cantidad,
      \`${bqConfig.colFecha}\` AS fecha
    FROM \`${bqConfig.fullTable}\`
    WHERE \`${bqConfig.colProducto}\` = @productoId${filtroFecha}
    QUALIFY \`${bqConfig.colFecha}\` =
        MAX(\`${bqConfig.colFecha}\`) OVER (PARTITION BY \`${bqConfig.colProducto}\`)
    ORDER BY nombre_mp ASC
  `;

  const params = { productoId };
  if (bqConfig.maxDays > 0) {
    params.fechaMinima = {
      value: new Date(Date.now() - bqConfig.maxDays * 24 * 60 * 60 * 1000),
      parameterType: "TIMESTAMP",
    };
  }

  let rows;
  try {
    [rows] = await bigquery.query({ query, params, location: bqConfig.location });
  } catch (err) {
    console.error("[BigQuery] obtenerBOM:", err);
    throw new ApiError(502, "Error consultando BigQuery al obtener la receta");
  }

  if (rows.length === 0) {
    throw new ApiError(404, "No se encontró receta para el producto seleccionado");
  }

  const bom = {
    producto_id: String(rows[0].producto_id),
    nombre_producto: rows[0].nombre_producto ?? String(rows[0].producto_id),
    fecha_vigencia: rows[0].fecha,
    items: rows.map((r) => ({
      codigo_mp: String(r.codigo_mp),
      nombre_mp: r.nombre_mp ?? String(r.codigo_mp),
      cantidad: Number(r.cantidad),
    })),
  };

  setCache(key, bom, bqConfig.cacheTtlMs);
  return bom;
}