import * as bomService from "./bom.service.js";
import * as precioService from "./precios.service.js";
import * as repo from "../repositories/cotizaciones.repository.js";
import { ApiError } from "../utils/apiError.js";

const FINANCIERO_MAX = Number(process.env.PORCENTAJE_FINANCIERO_MAX || 100);
const BONIFICACION_MAX = Number(process.env.PORCENTAJE_BONIFICACION_MAX || 100);

/**
 * Prepara el armado de cotización para un producto:
 * junta el BOM (mock o BigQuery) con los precios vigentes en PostgreSQL
 * y devuelve cada ítem con su estado para la pantalla interactiva.
 */
export async function prepararCotizacion(productoId) {
  if (!productoId) throw new ApiError(400, "Seleccione un producto");

  const bom = await bomService.obtenerBOM(productoId);
  const mps = await repo.obtenerPreciosPorNombres(bom.items.map((i) => i.nombre_mp));
  const mapaMps = new Map(mps.map((mp) => [mp.nombre.toLowerCase(), mp]));

  const items = bom.items.map((i) => {
    const mp = mapaMps.get(i.nombre_mp.toLowerCase());
    let advertencia = null;

    if (!mp) {
      advertencia = "No registrada en materias primas";
    } else if (mp.estado !== "activo") {
      advertencia = "Materia prima inactiva";
    } else if (mp.precio_unitario == null) {
      advertencia = "Sin precio cargado";
    }

    const disponible = mp && mp.estado === "activo" && mp.precio_unitario != null;

    return {
      codigo_mp: i.codigo_mp,
      nombre_mp: i.nombre_mp,
      cantidad: i.cantidad,
      materia_prima_id: mp?.id ?? null,
      precio_unitario_aplicado: disponible ? Number(mp.precio_unitario) : null,
      cobrado: disponible,
      advertencia,
    };
  });

  const costoMpTotal = precioService.calcularCostoMpTotal(items);
  const resumen = {
    costo_mp_total: costoMpTotal,
    // Con costos de proceso y % financiero en 0, el "precio final" inicial
    // coincide con el costo de MP; la pantalla lo recalcula en tiempo real.
    precio_final: precioService.calcularPrecioFinal({
      costoMpTotal,
      costoProceso: 0,
      porcentajeFinanciero: 0,
    }),
    precio_bonificado: precioService.calcularPrecioBonificado({
      precioFinal: costoMpTotal,
      porcentajeBonificacion: 0,
    }),
  };

  return {
    producto_id: bom.producto_id,
    nombre_producto: bom.nombre_producto,
    fecha_vigencia: bom.fecha_vigencia,
    items,
    resumen,
  };
}

/**
 * Recibe el payload de la pantalla, valida y recalcula TODO del lado del
 * servidor (autoritativo) antes de persistir.
 */
function validarYCalcular(payload = {}) {
  const {
    producto_id,
    nombre_producto,
    costo_proceso,
    costo_embolsado,
    costo_etiquetado,
    porcentaje_financiero,
    porcentaje_bonificacion,
    items,
  } = payload;

  if (!producto_id || !nombre_producto) {
    throw new ApiError(400, "Faltan datos del producto");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "La cotización debe incluir al menos una materia prima");
  }

  const costoProcesoNum = Number(costo_proceso || 0);
  let financieroNum = Number(porcentaje_financiero || 0);
  const bonificacionNum = Number(porcentaje_bonificacion || 0);

  // Detalle opcional de costo financiero en tramos/periodos:
  // [{ etiqueta, porcentaje }] — el % efectivo es la suma de los tramos.
  let detalleFinanciero = null;
  if (Array.isArray(payload.detalle_financiero) && payload.detalle_financiero.length > 0) {
    detalleFinanciero = payload.detalle_financiero.map((t, idx) => {
      const pct = Number(t?.porcentaje);
      const etiqueta = t?.etiqueta ? String(t.etiqueta).trim() || `Periodo ${idx + 1}` : `Periodo ${idx + 1}`;
      if (!Number.isFinite(pct) || pct < 0 || pct > FINANCIERO_MAX) {
        throw new ApiError(
          400,
          `El tramo "${etiqueta}" debe estar entre 0 y ${FINANCIERO_MAX}%`
        );
      }
      return { etiqueta, porcentaje: precioService.redondear(pct) };
    });
    financieroNum = precioService.redondear(
      detalleFinanciero.reduce((acc, t) => acc + t.porcentaje, 0)
    );
  }

  if (!Number.isFinite(costoProcesoNum) || costoProcesoNum < 0) {
    throw new ApiError(400, "El costo de proceso debe ser un número mayor o igual a 0");
  }
  const embolsadoNum = Number(costo_embolsado || 0);
  const etiquetadoNum = Number(costo_etiquetado || 0);
  if (!Number.isFinite(embolsadoNum) || embolsadoNum < 0) {
    throw new ApiError(400, "El costo de embolsado debe ser un número mayor o igual a 0");
  }
  if (!Number.isFinite(etiquetadoNum) || etiquetadoNum < 0) {
    throw new ApiError(400, "El costo de etiquetado debe ser un número mayor o igual a 0");
  }
  if (!Number.isFinite(financieroNum) || financieroNum < 0 || financieroNum > FINANCIERO_MAX) {
    throw new ApiError(400, `El costo financiero debe estar entre 0 y ${FINANCIERO_MAX}%`);
  }
  if (!Number.isFinite(bonificacionNum) || bonificacionNum < 0 || bonificacionNum > BONIFICACION_MAX) {
    throw new ApiError(400, `La bonificación debe estar entre 0 y ${BONIFICACION_MAX}%`);
  }

  const validados = items.map((item, idx) => {
    const cantidad = Number(item?.cantidad_usada);
    const precio = Number(item?.precio_unitario_aplicado);
    const cobrado = item?.cobrado === true || item?.cobrado === "true";
    const esTarea = item?.es_tarea === true || item?.es_tarea === "true";
    const numeroItem = idx + 1;

    if (!Number.isFinite(cantidad) || cantidad < 0) {
      throw new ApiError(400, `Cantidad inválida en el ítem ${numeroItem}`);
    }
    if (cobrado && !esTarea && (!item?.materia_prima_id || !Number.isFinite(precio) || precio < 0)) {
      throw new ApiError(
        400,
        `El ítem "${item?.nombre_mp || numeroItem}" no puede cobrarse: falta materia prima o precio válido`
      );
    }
    if (cobrado && esTarea && (!item?.nombre_mp || !Number.isFinite(precio) || precio < 0)) {
      throw new ApiError(
        400,
        `El ítem "${item?.nombre_mp || numeroItem}" no puede cobrarse: falta el nombre o el valor de la tarea`
      );
    }

    return {
      materia_prima_id: item?.materia_prima_id || null,
      codigo_mp: item?.codigo_mp ? String(item.codigo_mp) : null,
      nombre_mp: item?.nombre_mp ? String(item.nombre_mp) : null,
      es_tarea: esTarea,
      cantidad_usada: cantidad,
      precio_unitario_aplicado: cobrado ? precio : Number.isFinite(precio) ? precio : 0,
      cobrado,
    };
  });

  // En modo tarea el "costo" es la suma de Valor Captura de lo tildado
  // (mismo criterio que la pantalla); si no, cantidad x precio.
  const costoMpTotal = precioService.redondear(
    validados.reduce(
      (acc, i) =>
        acc + (i.cobrado ? (i.es_tarea ? i.precio_unitario_aplicado || 0 : i.cantidad_usada * (i.precio_unitario_aplicado || 0)) : 0),
      0
    )
  );
  // Embolsado y etiquetado se suman a la base del costo (con proceso),
  // antes del % financiero.
  const costoBase = precioService.redondear(costoProcesoNum + embolsadoNum + etiquetadoNum);
  const precioFinal = precioService.calcularPrecioFinal({
    costoMpTotal,
    costoProceso: costoBase,
    porcentajeFinanciero: financieroNum,
  });
  const precioBonificado = precioService.calcularPrecioBonificado({
    precioFinal,
    porcentajeBonificacion: bonificacionNum,
  });

  const registro = {
    producto_id: String(producto_id),
    nombre_producto: String(nombre_producto),
    cliente_nombre: payload.cliente_nombre ? String(payload.cliente_nombre).trim() || null : null,
    cliente_cuit: payload.cliente_cuit ? String(payload.cliente_cuit).trim() || null : null,
    cliente_telefono: payload.cliente_telefono ? String(payload.cliente_telefono).trim() || null : null,
    costo_mp_total: costoMpTotal,
    costo_proceso: costoProcesoNum,
    costo_embolsado: embolsadoNum,
    costo_etiquetado: etiquetadoNum,
    porcentaje_financiero: financieroNum,
    detalle_financiero: detalleFinanciero,
    porcentaje_bonificacion: bonificacionNum,
    precio_final: precioFinal,
    precio_bonificado: precioBonificado,
  };

  return { registro, detalles: validados };
}

export async function grabarCotizacion(payload = {}) {
  const { registro, detalles } = validarYCalcular(payload);
  return repo.createCotizacionConDetalles({ registro, detalles });
}

export async function actualizarCotizacion(id, payload = {}) {
  if (!id) throw new ApiError(400, "Falta el id de la cotización");
  const { registro, detalles } = validarYCalcular(payload);
  const cotizacion = await repo.updateCotizacionConDetalles({ id, registro, detalles });
  if (!cotizacion) throw new ApiError(404, "Cotización no encontrada");
  return cotizacion;
}

export function listar(limite) {
  return repo.findRecent(Number(limite || 20));
}

export async function obtenerDetalle(id) {
  if (!id) throw new ApiError(400, "Falta el id de la cotización");
  const cotizacion = await repo.findById(id);
  if (!cotizacion) throw new ApiError(404, "Cotización no encontrada");
  const detalles = await repo.findDetalles(id);
  return { ...cotizacion, detalles };
}

export async function historialProducto(productoId) {
  if (!productoId) throw new ApiError(400, "Falta el código de producto");
  return repo.findByProducto(productoId);
}

export async function borrarCotizacion(id) {
  const borrada = await repo.removeById(id);
  if (!borrada) throw new ApiError(404, "Cotización no encontrada");
  return { ok: true };
}