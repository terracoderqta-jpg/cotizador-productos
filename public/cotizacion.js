const $ = (sel) => document.querySelector(sel);

const formatterMoneda = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const formatterFecha = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

let itemsActuales = [];
let productoActual = null;
let editandoId = null;

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    headers:
      options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de servidor");
  return data;
}

function toast(message, ok = true) {
  const el = $("#toast");
  el.textContent = message;
  el.className =
    `fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white text-sm ` +
    (ok ? "bg-green-600" : "bg-red-600");
  el.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.add("hidden"), 3000);
}

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------
// Selector de productos
// ---------------------------------------------------------------
async function cargarProductos() {
  try {
    const productos = await apiRequest("/api/productos");
    const select = $("#select-producto");
    select.innerHTML = '<option value="">Seleccione un producto...</option>';
    for (const p of productos) {
      const opt = document.createElement("option");
      opt.value = p.producto_id;
      opt.textContent = `${p.nombre_producto} (${p.producto_id})`;
      select.appendChild(opt);
    }
  } catch (err) {
    toast(err.message, false);
  }
}

$("#select-producto").addEventListener("change", (event) => {
  if (event.target.value) cargarTareas(event.target.value);
});

$("#select-tarea").addEventListener("change", (event) => {
  const productoId = $("#select-producto").value;
  if (event.target.value && productoId) cargarTareaACotizar(productoId, event.target.value);
});

$("#btn-refrescar").addEventListener("click", () => {
  const id = $("#select-producto").value;
  if (!id) return toast("Seleccione un producto", false);
  cachePrecios = null; // traer $/kg vigentes de nuevo
  const tarea = $("#select-tarea").value;
  cargarCostosAdicionales();
  if (tarea) {
    cargarTareaACotizar(id, tarea);
  } else {
    cargarTareas(id);
  }
});

// ---------------------------------------------------------------
// Precios $/kg (pantalla Precios -> /api/precios) cacheados para
// cruzar cada ingrediente de la tarea con su valor vigente.
// ---------------------------------------------------------------
let cachePrecios = null;

async function obtenerMapaPrecios() {
  if (cachePrecios) return cachePrecios;
  const precios = await apiRequest("/api/precios");
  const porDescripcion = new Map();
  const porNro = new Map();
  for (const p of precios) {
    if (p.descripcion_mp) porDescripcion.set(String(p.descripcion_mp).toLowerCase(), p);
    if (p.nro_mp) porNro.set(String(p.nro_mp), p);
  }
  cachePrecios = { porDescripcion, porNro };
  return cachePrecios;
}

function buscarPrecioKg(movimiento, mapa) {
  const porDesc = mapa.porDescripcion.get(String(movimiento.descripcion_mp ?? "").toLowerCase());
  if (porDesc) return porDesc;
  return mapa.porNro.get(String(movimiento.nro_mp ?? "")) ?? null;
}

// ---------------------------------------------------------------
// Costos adicionales (Embolsado / Etiquetado): se cargan en
// Precios ($/u) y se traen de ahí a los montos.
// ---------------------------------------------------------------
async function cargarCostosAdicionales() {
  try {
    const mapa = await obtenerMapaPrecios();
    const emb = mapa.porDescripcion.get("embolsado");
    const eti = mapa.porDescripcion.get("etiquetado");
    if (emb?.precio_actual != null) $("#costo-embolsado").value = Number(emb.precio_actual);
    if (eti?.precio_actual != null) $("#costo-etiquetado").value = Number(eti.precio_actual);
  } catch {
    // Sin Precios disponibles: se dejan los montos en 0.
  }
}
async function cargarTareas(productoId) {
  const select = $("#select-tarea");
  try {
    const tareas = await apiRequest(`/api/jvp/tareas?codigo=${encodeURIComponent(productoId)}`);
    select.innerHTML = '<option value="">Seleccione una tarea...</option>';
    for (const t of tareas) {
      const opt = document.createElement("option");
      opt.value = t.nro_tarea;
      opt.textContent = `Tarea ${t.nro_tarea} — ${t.fecha_tarea} (${t.movimientos} MPs)`;
      select.appendChild(opt);
    }
    select.disabled = tareas.length === 0;
    if (tareas.length === 0) toast("El producto no tiene tareas JVP", false);
  } catch (err) {
    toast(err.message, false);
  }
}

async function cargarTareaACotizar(productoId, nroTarea) {
  try {
    const params = new URLSearchParams({ codigo: productoId, tarea: nroTarea, limit: "500" });
    const data = await apiRequest(`/api/jvp/movimientos?${params}`);
    const filas = data.movimientos.filter(
      (m) => m.codigo_formula === productoId && m.nro_tarea === nroTarea
    );
    if (filas.length === 0) return toast("La tarea no tiene movimientos", false);
    let mapaPrecios = null;
    try {
      mapaPrecios = await obtenerMapaPrecios();
    } catch {
      mapaPrecios = null;
    }
    productoActual = { id: productoId, nombre: filas[0].nombre_formula };
    itemsActuales = filas.map((m) => {
      const ref = mapaPrecios ? buscarPrecioKg(m, mapaPrecios) : null;
      const precioKg = ref?.precio_actual != null ? Number(ref.precio_actual) : null;
      const conPrecio = precioKg != null && Number.isFinite(precioKg);
      return {
        codigo_mp: m.nro_mp,
        nombre_mp: m.descripcion_mp,
        cantidad: Number(m.set_captura),
        materia_prima_id: ref?.materia_prima_id ?? null,
        precio_unitario_aplicado: conPrecio ? precioKg : null,
        cobrado: conPrecio,
        es_tarea: false,
        advertencia: conPrecio ? null : "Sin precio $/kg",
      };
    });
    const sinPrecio = itemsActuales.filter((i) => !i.cobrado).length;
    $("#info-bom").textContent =
      `Tarea ${nroTarea} del ${filas[0].fecha_tarea} ` +
      `| ${itemsActuales.length} materia(s) prima(s) (Cantidad = Set Captura, Precio = $/kg vigente)` +
      (sinPrecio > 0 ? ` | ${sinPrecio} sin precio: cargarlo en Precios` : "");
    if (sinPrecio > 0) toast(`${sinPrecio} ingrediente(s) sin precio $/kg`, false);
    renderItems();
    recalcular();
  } catch (err) {
    toast(err.message, false);
  }
}

// ---------------------------------------------------------------
// Preparar cotización (BOM + precios de PostgreSQL,
// con fallback al BOM sin precios si no hay DB)
// ---------------------------------------------------------------
async function prepararCotizacion(productoId, refrescar) {
  try {
    const url = `/api/cotizaciones/preparar?producto_id=${encodeURIComponent(productoId)}${refrescar ? "&refresh=true" : ""}`;
    const bom = await apiRequest(url);
    productoActual = { id: bom.producto_id, nombre: bom.nombre_producto };
    itemsActuales = bom.items;
    $("#info-bom").textContent =
      `Receta vigente del ${bom.fecha_vigencia ? formatterFecha.format(new Date(bom.fecha_vigencia)) : "-"} ` +
      `| ${itemsActuales.length} materia(s) prima(s)`;
    renderItems();
    recalcular();
  } catch (err) {
    // Sin PostgreSQL no hay precios: igual traer la lista a cotizar desde el BOM.
    try {
      const bomUrl = `/api/productos/${encodeURIComponent(productoId)}/bom${refrescar ? "?refresh=true" : ""}`;
      const bom = await apiRequest(bomUrl);
      productoActual = { id: bom.producto_id, nombre: bom.nombre_producto };
      itemsActuales = (bom.items || []).map((i) => ({
        codigo_mp: i.codigo_mp,
        nombre_mp: i.nombre_mp,
        cantidad: Number(i.cantidad),
        materia_prima_id: null,
        precio_unitario_aplicado: null,
        cobrado: false,
        advertencia: "Sin precio cargado",
      }));
      $("#info-bom").textContent =
        `Receta vigente del ${bom.fecha_vigencia ? formatterFecha.format(new Date(bom.fecha_vigencia)) : "-"} ` +
        `| ${itemsActuales.length} materia(s) prima(s) (sin precios: DB no disponible)`;
      renderItems();
      recalcular();
    } catch (err2) {
      toast(err.message, false);
    }
  }
}

// ---------------------------------------------------------------
// Tabla interactiva
// ---------------------------------------------------------------
function renderItems() {
  const tbody = $("#tabla-items");
  tbody.innerHTML = "";
  if (itemsActuales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-center text-gray-400">Receta sin materias primas.</td></tr>';
    $("#tabla-totales").innerHTML = "";
    return;
  }

  // TOTAL Cantidad kg (de lo tildado) para el cálculo Precio x KG por fila:
  // cada fila = totalKg / subtotal$ de la fila (ej: 5000 / 333000).
  const totalKg = itemsActuales
    .filter((i) => i.cobrado)
    .reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0);

  for (const item of itemsActuales) {
    const tr = document.createElement("tr");
    if (!item.cobrado && item.advertencia) tr.className = "bg-amber-50";

    const tdCheck = document.createElement("td");
    tdCheck.className = "px-4 py-3 text-center";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.cobrado;
    checkbox.disabled = item.precio_unitario_aplicado == null;
    checkbox.addEventListener("change", () => {
      item.cobrado = checkbox.checked;
      renderItems();
      recalcular();
    });
    tdCheck.appendChild(checkbox);

    const tdCodigo = document.createElement("td");
    tdCodigo.className = "px-4 py-3 text-gray-500";
    tdCodigo.textContent = item.codigo_mp;

    const tdNombre = document.createElement("td");
    tdNombre.className = "px-4 py-3 font-medium text-gray-800";
    tdNombre.textContent = item.nombre_mp;

    const tdCantidad = document.createElement("td");
    tdCantidad.className = "px-4 py-3 text-right text-gray-700";
    tdCantidad.textContent = formatterMoneda.format(Number(item.cantidad) || 0);

    const tdPrecio = document.createElement("td");
    tdPrecio.className = "px-4 py-3 text-right text-gray-700";
    // Precio $ = Cantidad kg x Precio $/kg (subtotal en pesos de la fila).
    if (item.precio_unitario_aplicado == null) {
      tdPrecio.textContent = "\u2014";
    } else if (item.es_tarea) {
      // Cotizaciones viejas guardadas con valor de tarea puntual.
      tdPrecio.textContent = `$ ${formatterMoneda.format(item.precio_unitario_aplicado)}`;
    } else {
      tdPrecio.textContent = `$ ${formatterMoneda.format((Number(item.cantidad) || 0) * item.precio_unitario_aplicado)}`;
    }

    const tdSubtotal = document.createElement("td");
    tdSubtotal.className = "px-4 py-3 text-right font-semibold text-gray-800";
    const subtotalFila = subtotalItem(item);
    if (!item.cobrado || !(subtotalFila > 0) || !(totalKg > 0)) {
      tdSubtotal.textContent = "\u2014";
    } else {
      // Precio x KG = (Cantidad kg x Precio $/kg) / TOTAL Cantidad kg.
      tdSubtotal.textContent = formatterMoneda.format(subtotalFila / totalKg);
    }

    const tdEstado = document.createElement("td");
    tdEstado.className = "px-4 py-3";
    const badge = document.createElement("span");
    if (!item.advertencia) {
      badge.className =
        "inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700";
      badge.textContent = "Cobra";
    } else {
      badge.className =
        "inline-block px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700";
      badge.textContent = item.advertencia;
    }
    tdEstado.appendChild(badge);

    tr.append(tdCheck, tdCodigo, tdNombre, tdCantidad, tdPrecio, tdSubtotal, tdEstado);
    tbody.appendChild(tr);
  }
}

// ---------------------------------------------------------------
// Cálculo en tiempo real (mismo criterio que el backend)
// ---------------------------------------------------------------
function subtotalItem(item) {
  if (!item.cobrado) return 0;
  return item.es_tarea
    ? item.precio_unitario_aplicado || 0
    : item.cantidad * (item.precio_unitario_aplicado || 0);
}

function sumaSubtotalesTildados() {
  return itemsActuales.reduce((acc, i) => acc + subtotalItem(i), 0);
}

// ---------------------------------------------------------------
// Costo financiero en tramos/periodos (se suman).
// ---------------------------------------------------------------
let periodosFinancieros = [{ etiqueta: "Periodo 1", porcentaje: 0 }];

function sumaFinanciero() {
  return periodosFinancieros.reduce((acc, p) => acc + numero(p.porcentaje), 0);
}

function renderPeriodos() {
  const cont = $("#lista-periodos");
  cont.innerHTML = "";
  periodosFinancieros.forEach((p, idx) => {
    const fila = document.createElement("div");
    fila.className = "flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5";

    const badge = document.createElement("span");
    badge.className =
      "w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center";
    badge.textContent = idx + 1;
    badge.title = p.etiqueta || `Periodo ${idx + 1}`;

    const label = document.createElement("span");
    label.className = "text-sm text-gray-600 flex-1 truncate";
    label.textContent = p.etiqueta || `Periodo ${idx + 1}`;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.01";
    input.value = p.porcentaje;
    input.className =
      "no-spinner w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-right text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none";
    input.addEventListener("input", () => {
      p.porcentaje = input.value;
      $("#total-financiero").textContent = `${formatterMoneda.format(sumaFinanciero())} %`;
      recalcular();
    });

    const suffix = document.createElement("span");
    suffix.className = "text-sm text-gray-400";
    suffix.textContent = "%";

    const btnQuitar = document.createElement("button");
    btnQuitar.type = "button";
    btnQuitar.textContent = "✕";
    btnQuitar.title = "Quitar periodo";
    btnQuitar.className =
      "shrink-0 w-7 h-7 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 font-bold text-sm disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400";
    btnQuitar.disabled = periodosFinancieros.length === 1;
    btnQuitar.addEventListener("click", () => {
      periodosFinancieros.splice(idx, 1);
      periodosFinancieros.forEach((q, i) => {
        q.etiqueta = `Periodo ${i + 1}`;
      });
      renderPeriodos();
      recalcular();
    });

    fila.append(badge, label, input, suffix, btnQuitar);
    cont.appendChild(fila);
  });
  $("#total-financiero").textContent = `${formatterMoneda.format(sumaFinanciero())} %`;
}

$("#btn-agregar-periodo").addEventListener("click", () => {
  periodosFinancieros.push({ etiqueta: `Periodo ${periodosFinancieros.length + 1}`, porcentaje: 0 });
  renderPeriodos();
});

function costoExtra(checkSel, inputSel) {
  if (!$(checkSel).checked) return 0;
  return numero($(inputSel).value);
}

function recalcular() {
  const costoProceso = numero($("#costo-proceso").value);
  const pctFinanciero = sumaFinanciero();
  const pctBonificacion = numero($("#porcentaje-bonificacion").value);
  // Embolsado y etiquetado (si están tildados) van a la base del costo.
  const costoBase = costoProceso + costoExtra("#check-embolsado", "#costo-embolsado") + costoExtra("#check-etiquetado", "#costo-etiquetado");

  const costoMp = itemsActuales
    .filter((i) => i.cobrado)
    .reduce((acc, i) => acc + subtotalItem(i), 0);
  const precioFinal = (costoMp + costoBase) * (1 + pctFinanciero / 100);
  const precioBonificado = Math.max(0, precioFinal * (1 - pctBonificacion / 100));

  $("#costo-mp").textContent = `$ ${formatterMoneda.format(costoMp)}`;
  $("#precio-final").textContent = `$ ${formatterMoneda.format(precioFinal)}`;
  $("#precio-bonificado").textContent = `$ ${formatterMoneda.format(precioBonificado)}`;
  actualizarTotales();
}

function actualizarTotales() {
  const tfoot = $("#tabla-totales");
  tfoot.innerHTML = "";
  const tildados = itemsActuales.filter((i) => i.cobrado);
  const sumaCantidad = tildados.reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0);
  const sumaSubtotal = tildados.reduce((acc, i) => acc + subtotalItem(i), 0);
  // TOTAL de Precio x KG = suma del Precio x KG de cada ítem tildado
  // (equivale a Total $ / TOTAL Cantidad kg).
  const totalPrecioXKg = tildados.reduce((acc, i) => {
    const sub = subtotalItem(i);
    return acc + (sub > 0 && sumaCantidad > 0 ? sub / sumaCantidad : 0);
  }, 0);
  const tr = document.createElement("tr");
  const td = (texto, cls) => {
    const c = document.createElement("td");
    c.className = cls;
    c.textContent = texto;
    return c;
  };
  tr.append(
    td("", "px-4 py-3"),
    td("", "px-4 py-3"),
    td(`TOTAL (${tildados.length} ítems)`, "px-4 py-3 text-gray-800"),
    td(formatterMoneda.format(sumaCantidad), "px-4 py-3 text-right text-gray-800"),
    td(formatterMoneda.format(sumaSubtotal), "px-4 py-3 text-right text-gray-800"),
    td(tildados.length > 0 ? formatterMoneda.format(totalPrecioXKg) : "\u2014", "px-4 py-3 text-right text-gray-800"),
    td("", "px-4 py-3")
  );
  tfoot.appendChild(tr);
}

["#costo-proceso", "#porcentaje-bonificacion", "#costo-embolsado", "#costo-etiquetado"].forEach((sel) => {
  $(sel).addEventListener("input", recalcular);
});

for (const [checkSel, inputSel] of [["#check-embolsado", "#costo-embolsado"], ["#check-etiquetado", "#costo-etiquetado"]]) {
  $(checkSel).addEventListener("change", () => {
    $(inputSel).disabled = !$(checkSel).checked;
    recalcular();
  });
}

// ---------------------------------------------------------------
// Imprimir cotización en pantalla
// ---------------------------------------------------------------
$("#btn-imprimir").addEventListener("click", () => {
  if (!productoActual) return toast("Seleccione un producto", false);
  const cliente = [
    $("#cliente-nombre").value.trim(),
    $("#cliente-cuit").value.trim(),
    $("#cliente-telefono").value.trim(),
  ].filter(Boolean).join(" · ");
  $("#print-producto").textContent =
    `${productoActual.nombre} (${productoActual.id}) — ${$("#info-bom").textContent}`;
  $("#print-cliente").textContent = cliente ? `Cliente: ${cliente}` : "";
  $("#print-fecha").textContent = `Emitida: ${new Date().toLocaleString("es-AR")}`;
  window.print();
});

// ---------------------------------------------------------------
// Grabar cotización
// ---------------------------------------------------------------
$("#form-calc").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!productoActual) return toast("Seleccione un producto", false);

  const payload = {
    producto_id: productoActual.id,
    nombre_producto: productoActual.nombre,
    cliente_nombre: $("#cliente-nombre").value.trim(),
    cliente_cuit: $("#cliente-cuit").value.trim(),
    cliente_telefono: $("#cliente-telefono").value.trim(),
    costo_proceso: numero($("#costo-proceso").value),
    costo_embolsado: costoExtra("#check-embolsado", "#costo-embolsado"),
    costo_etiquetado: costoExtra("#check-etiquetado", "#costo-etiquetado"),
    porcentaje_financiero: sumaFinanciero(),
    detalle_financiero: periodosFinancieros.map((p, i) => ({
      etiqueta: p.etiqueta || `Periodo ${i + 1}`,
      porcentaje: numero(p.porcentaje),
    })),
    porcentaje_bonificacion: numero($("#porcentaje-bonificacion").value),
    items: itemsActuales.map((i) => ({
      materia_prima_id: i.materia_prima_id,
      codigo_mp: i.codigo_mp,
      nombre_mp: i.nombre_mp,
      es_tarea: !!i.es_tarea,
      cantidad_usada: i.cantidad,
      precio_unitario_aplicado: i.precio_unitario_aplicado,
      cobrado: i.cobrado,
    })),
  };

  try {
    const url = editandoId ? `/api/cotizaciones/${editandoId}` : "/api/cotizaciones";
    const method = editandoId ? "PUT" : "POST";
    const { precio_final, precio_bonificado } = await apiRequest(url, {
      method,
      body: JSON.stringify(payload),
    });
    toast(
      editandoId
        ? `Cotización actualizada: Final $ ${formatterMoneda.format(precio_final)}`
        : `Cotización grabada: Final $ ${formatterMoneda.format(precio_final)}`
    );
    salirDeEdicion();
  } catch (err) {
    toast(err.message, false);
  }
});

// ---------------------------------------------------------------
// Modo edición de una cotización existente
// ---------------------------------------------------------------
async function iniciarEdicion(id) {
  try {
    const detalle = await apiRequest(`/api/cotizaciones/${id}`);
    editandoId = id;

    productoActual = { id: detalle.producto_id, nombre: detalle.nombre_producto };
    itemsActuales = detalle.detalles.map((d) => ({
      codigo_mp: d.codigo_mp ?? "",
      nombre_mp: d.nombre_mp,
      cantidad: Number(d.cantidad_usada),
      materia_prima_id: d.materia_prima_id,
      precio_unitario_aplicado: Number(d.precio_unitario_aplicado),
      cobrado: d.cobrado,
      es_tarea: !!d.es_tarea,
      advertencia: d.es_tarea ? "Valor de tarea (sin precio)" : null,
    }));

    $("#costo-proceso").value = Number(detalle.costo_proceso);
    setCostoExtra("#check-embolsado", "#costo-embolsado", Number(detalle.costo_embolsado) || 0);
    setCostoExtra("#check-etiquetado", "#costo-etiquetado", Number(detalle.costo_etiquetado) || 0);
    if (Array.isArray(detalle.detalle_financiero) && detalle.detalle_financiero.length > 0) {
      periodosFinancieros = detalle.detalle_financiero.map((t, i) => ({
        etiqueta: t.etiqueta || `Periodo ${i + 1}`,
        porcentaje: Number(t.porcentaje) || 0,
      }));
    } else {
      periodosFinancieros = [
        { etiqueta: "Periodo 1", porcentaje: Number(detalle.porcentaje_financiero) || 0 },
      ];
    }
    renderPeriodos();
    $("#porcentaje-bonificacion").value = Number(detalle.porcentaje_bonificacion);
    $("#cliente-nombre").value = detalle.cliente_nombre ?? "";
    $("#cliente-cuit").value = detalle.cliente_cuit ?? "";
    $("#cliente-telefono").value = detalle.cliente_telefono ?? "";

    seleccionarProductoEnSelect(detalle.producto_id, detalle.nombre_producto);
    $("#info-bom").textContent =
      `Editando cotización grabada el ${formatterFecha.format(new Date(detalle.fecha_creacion))}`;
    $("#btn-grabar").textContent = "Guardar Cambios";
    $("#btn-cancelar-edicion").classList.remove("hidden");

    renderItems();
    recalcular();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    toast(err.message, false);
  }
}

function seleccionarProductoEnSelect(productoId, nombreProducto) {
  const select = $("#select-producto");
  const existente = [...select.options].find((o) => o.value === productoId);
  if (!existente) {
    const opt = document.createElement("option");
    opt.value = productoId;
    opt.textContent = `${nombreProducto} (${productoId})`;
    select.appendChild(opt);
  }
  select.value = productoId;
}

function salirDeEdicion() {
  editandoId = null;
  $("#btn-grabar").textContent = "Grabar Cotización";
  $("#btn-cancelar-edicion").classList.add("hidden");
}

function setCostoExtra(checkSel, inputSel, monto) {
  $(checkSel).checked = monto > 0;
  $(inputSel).value = monto;
  $(inputSel).disabled = !(monto > 0);
}

function cancelarEdicion() {
  salirDeEdicion();
  productoActual = null;
  itemsActuales = [];
  $("#select-tarea").innerHTML = '<option value="">Seleccione un producto primero...</option>';
  $("#select-tarea").disabled = true;
  $("#costo-proceso").value = 0;
  setCostoExtra("#check-embolsado", "#costo-embolsado", 0);
  setCostoExtra("#check-etiquetado", "#costo-etiquetado", 0);
  periodosFinancieros = [{ etiqueta: "Periodo 1", porcentaje: 0 }];
  renderPeriodos();
  $("#porcentaje-bonificacion").value = 0;
  $("#cliente-nombre").value = "";
  $("#cliente-cuit").value = "";
  $("#cliente-telefono").value = "";
  $("#info-bom").textContent = "";
  renderItems();
  recalcular();
  toast("Edición cancelada");
}

$("#btn-cancelar-edicion").addEventListener("click", cancelarEdicion);

// Inicial
renderPeriodos();
cargarCostosAdicionales();
cargarProductos();
const idEdicion = new URLSearchParams(window.location.search).get("editar");
if (idEdicion) iniciarEdicion(idEdicion);