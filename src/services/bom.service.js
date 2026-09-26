import * as bomBigQuery from "./providers/bomBigQuery.js";
import * as bomMock from "./providers/bomMock.js";

// Modo provisional: dato de prueba en data/bomMuestras.json.
// Con BQ_MOCK=false (o ausente) se consulta la tabla real de BigQuery.
const usarMock = process.env.BQ_MOCK === "true";

export function listarProductos(opts) {
  return usarMock ? bomMock.listarProductos(opts) : bomBigQuery.listarProductos(opts);
}

export function obtenerBOM(productoId, opts) {
  return usarMock ? bomMock.obtenerBOM(productoId, opts) : bomBigQuery.obtenerBOM(productoId, opts);
}