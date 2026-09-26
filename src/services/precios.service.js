const REDONDEO = 10000; // 4 decimales

export function redondear(valor) {
  return Math.round((valor + Number.EPSILON) * REDONDEO) / REDONDEO;
}

/**
 * Costo total de materias primas: suma de cantidad x precio
 * solo de los ítems marcados como cobrados.
 */
export function calcularCostoMpTotal(items) {
  const total = (items ?? [])
    .filter((i) => i.cobrado)
    .reduce((acc, i) => acc + Number(i.cantidad_usada) * Number(i.precio_unitario_aplicado || 0), 0);
  return redondear(total);
}

/**
 * Precio final = (costo MP + costo proceso) x (1 + financiero/100)
 */
export function calcularPrecioFinal({ costoMpTotal, costoProceso, porcentajeFinanciero }) {
  const base = Number(costoMpTotal || 0) + Number(costoProceso || 0);
  return redondear(base * (1 + Number(porcentajeFinanciero || 0) / 100));
}

/**
 * Precio bonificado = precio final x (1 - bonificación/100), mínimo 0.
 */
export function calcularPrecioBonificado({ precioFinal, porcentajeBonificacion }) {
  const resultado = Number(precioFinal || 0) * (1 - Number(porcentajeBonificacion || 0) / 100);
  return redondear(Math.max(0, resultado));
}