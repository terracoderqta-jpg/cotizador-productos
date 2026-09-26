import { BigQuery } from "@google-cloud/bigquery";

const projectId = process.env.BQ_PROJECT_ID;
const datasetId = process.env.BQ_DATASET_ID;
const bomTable = process.env.BQ_BOM_TABLE;

export const bigquery = new BigQuery({ projectId });

export const bqConfig = {
  fullTable: `${projectId}.${datasetId}.${bomTable}`,
  location: process.env.BQ_LOCATION || "US",
  // Días de antigüedad máxima de la receta aceptada (0 = sin filtro)
  maxDays: Number(process.env.BQ_BOM_MAX_DAYS || 30),
  // TTL del caché en memoria para las recetas/productos
  cacheTtlMs: Number(process.env.BQ_CACHE_TTL_HORAS || 24) * 60 * 60 * 1000,
  // Columnas de la tabla/vista BOM (ajustables según tu esquema)
  colProducto: process.env.BQ_BOM_COL_PRODUCTO || "producto",
  colNombreProducto: process.env.BQ_BOM_COL_NOMBRE_PRODUCTO || "descripcion",
  colCodigoMp: process.env.BQ_BOM_COL_CODIGO_MP || "codigo_mp",
  colNombreMp: process.env.BQ_BOM_COL_NOMBRE_MP || "nombre_mp",
  colCantidad: process.env.BQ_BOM_COL_CANTIDAD || "cantidad",
  colFecha: process.env.BQ_BOM_COL_FECHA || "fecha",
};