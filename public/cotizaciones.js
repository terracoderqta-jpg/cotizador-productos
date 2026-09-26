const $ = (sel) => document.querySelector(sel);

const formatterMoneda = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const formatterFecha = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

let detalleActual = null;
let guardadas = [];

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

function textoCliente(c) {
  return [c.cliente_nombre, c.cliente_cuit, c.cliente_telefono].filter(Boolean).join(" · ") || "—";
}

// ---------------------------------------------------------------
// Listado
// ---------------------------------------------------------------
async function cargarGuardadas() {
  const tbody = $("#tabla-guardadas");
  try {
    guardadas = await apiRequest("/api/cotizaciones?limite=100");
    renderGuardadas();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-red-500">${err.message}</td></tr>`;
  }
}

function renderGuardadas() {
  const q = $("#filtro-buscar")?.value.trim().toLowerCase() ?? "";
  const tbody = $("#tabla-guardadas");
  const filas = guardadas.filter(
    (c) =>
      !q ||
      (c.nombre_producto ?? "").toLowerCase().includes(q) ||
      (c.cliente_nombre ?? "").toLowerCase().includes(q)
  );
  $("#guardadas-count").textContent = `${filas.length} cotización(es)`;
  tbody.innerHTML = "";
  if (filas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">Sin cotizaciones guardadas.</td></tr>';
    return;
  }
  for (const c of filas) {
    const tr = document.createElement("tr");
    const td = (texto, cls) => {
      const el = document.createElement("td");
      el.className = cls;
      el.textContent = texto;
      return el;
    };
    tr.append(
      td(formatterFecha.format(new Date(c.fecha_creacion)), "px-4 py-3 text-gray-500 text-xs"),
      td(`${c.nombre_producto} (${c.producto_id})`, "px-4 py-3 font-medium text-gray-800"),
      td(textoCliente(c), "px-4 py-3 text-gray-600"),
      td(`$ ${formatterMoneda.format(Number(c.precio_final))}`, "px-4 py-3 text-right text-gray-800"),
      td(`$ ${formatterMoneda.format(Number(c.precio_bonificado))}`, "px-4 py-3 text-right text-gray-800")
    );
    const tdAcciones = document.createElement("td");
    tdAcciones.className = "px-4 py-3 text-right whitespace-nowrap";
    const btnVer = document.createElement("button");
    btnVer.className = "mr-2 text-blue-600 hover:text-blue-800 font-medium text-sm";
    btnVer.textContent = "Ver";
    btnVer.addEventListener("click", () => abrirDetalle(c.id));
    const btnEditar = document.createElement("button");
    btnEditar.className = "mr-2 text-amber-600 hover:text-amber-800 font-medium text-sm";
    btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => {
      window.location.href = `cotizacion.html?editar=${c.id}`;
    });
    const btnBorrar = document.createElement("button");
    btnBorrar.className = "text-red-600 hover:text-red-800 font-medium text-sm";
    btnBorrar.textContent = "Eliminar";
    btnBorrar.addEventListener("click", () => borrarCotizacion(c.id, c.nombre_producto));
    tdAcciones.append(btnVer, btnEditar, btnBorrar);
    tr.appendChild(tdAcciones);
    tbody.appendChild(tr);
  }
}

$("#form-filtro").addEventListener("submit", (event) => {
  event.preventDefault();
  renderGuardadas();
});

// ---------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------
async function abrirDetalle(id) {
  try {
    const detalle = await apiRequest(`/api/cotizaciones/${id}`);
    detalleActual = detalle;
    renderDetalle(detalle);
    cargarHistorialProducto(detalle.producto_id);
    const modal = $("#modal-detalle");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  } catch (err) {
    toast(err.message, false);
  }
}

function renderDetalle(d) {
  $("#modal-detalle-titulo").textContent = `Cotización - ${d.nombre_producto}`;
  const contenedor = $("#modal-detalle-resumen");
  contenedor.innerHTML = "";
  const clienteTxt = textoCliente(d);
  if (clienteTxt !== "—") {
    const cardCliente = document.createElement("div");
    cardCliente.className = "bg-blue-50 rounded-lg p-3 col-span-2 md:col-span-4";
    const label = document.createElement("p");
    label.className = "text-xs text-gray-500 font-medium";
    label.textContent = "Cliente";
    const valor = document.createElement("p");
    valor.className = "text-base font-bold text-gray-800";
    valor.textContent = clienteTxt;
    cardCliente.append(label, valor);
    contenedor.appendChild(cardCliente);
  }
  const datos = [
    { label: "Costo MP", valor: d.costo_mp_total },
    { label: "Costo Proceso", valor: d.costo_proceso },
  ];
  if (Number(d.costo_embolsado) > 0) datos.push({ label: "Embolsado", valor: d.costo_embolsado });
  if (Number(d.costo_etiquetado) > 0) datos.push({ label: "Etiquetado", valor: d.costo_etiquetado });
  datos.push(
    { label: "Costo Financiero", valor: d.porcentaje_financiero, pct: true },
    { label: "Bonificación", valor: d.porcentaje_bonificacion, pct: true },
    { label: "Precio Final", valor: d.precio_final },
    { label: "Precio Bonificado", valor: d.precio_bonificado },
  );
  for (const dato of datos) {
    const card = document.createElement("div");
    card.className = "bg-gray-50 rounded-lg p-3";
    const label = document.createElement("p");
    label.className = "text-xs text-gray-500 font-medium";
    label.textContent = dato.label;
    const valor = document.createElement("p");
    valor.className = "text-lg font-bold text-gray-800";
    valor.textContent = dato.pct
      ? `${formatterMoneda.format(dato.valor)} %`
      : `$ ${formatterMoneda.format(dato.valor)}`;
    card.append(label, valor);
    contenedor.appendChild(card);
  }
  if (Array.isArray(d.detalle_financiero) && d.detalle_financiero.length > 1) {
    const cardTramos = document.createElement("div");
    cardTramos.className = "bg-blue-50 rounded-lg p-3 col-span-2 md:col-span-4";
    const label = document.createElement("p");
    label.className = "text-xs text-gray-500 font-medium mb-1";
    label.textContent = "Costo financiero por periodo";
    cardTramos.appendChild(label);
    for (const t of d.detalle_financiero) {
      const fila = document.createElement("p");
      fila.className = "text-sm text-gray-700";
      fila.textContent = `${t.etiqueta}: ${formatterMoneda.format(Number(t.porcentaje))} %`;
      cardTramos.appendChild(fila);
    }
    contenedor.appendChild(cardTramos);
  }

  const tbody = $("#modal-detalle-items");
  tbody.innerHTML = "";
  for (const item of d.detalles) {
    const tr = document.createElement("tr");
    if (!item.cobrado) tr.className = "text-gray-400";
    const tdNombre = tdContent(item.nombre_mp, "px-4 py-2 font-medium text-gray-800");
    const tdCantidad = tdContent(formatterMoneda.format(item.cantidad_usada), "px-4 py-2 text-right");
    const tdPrecio = tdContent(`$ ${formatterMoneda.format(item.precio_unitario_aplicado)}`, "px-4 py-2 text-right");
    const tdSubtotal = tdContent(
      item.cobrado ? `$ ${formatterMoneda.format(item.cantidad_usada * item.precio_unitario_aplicado)}` : "—",
      "px-4 py-2 text-right font-semibold"
    );
    const tdCobrado = document.createElement("td");
    tdCobrado.className = "px-4 py-2";
    const badge = document.createElement("span");
    badge.className = item.cobrado
      ? "inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
      : "inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-500";
    badge.textContent = item.cobrado ? "Sí" : "No";
    tdCobrado.appendChild(badge);
    tr.append(tdNombre, tdCantidad, tdPrecio, tdSubtotal, tdCobrado);
    tbody.appendChild(tr);
  }
}

function tdContent(texto, className) {
  const td = document.createElement("td");
  td.className = className;
  td.textContent = texto;
  return td;
}

async function cargarHistorialProducto(productoId) {
  const contenedor = $("#modal-detalle-historial");
  contenedor.innerHTML = "";
  try {
    const historial = await apiRequest(
      `/api/cotizaciones/historial-producto?producto_id=${encodeURIComponent(productoId)}`
    );
    if (historial.length === 0) {
      contenedor.innerHTML =
        '<p class="text-sm text-gray-400">Sin cotizaciones previas de este producto.</p>';
      return;
    }
    for (const h of historial) {
      const fila = document.createElement("div");
      fila.className =
        "px-3 py-2 rounded flex items-center justify-between text-sm " +
        (historial.indexOf(h) === 0 ? "bg-blue-50" : "bg-gray-50");
      const precio = document.createElement("span");
      precio.className = "font-semibold text-gray-800";
      precio.textContent = `$ ${formatterMoneda.format(Number(h.precio_final))}`;
      const fecha = document.createElement("span");
      fecha.className = "text-gray-500 text-xs";
      fecha.textContent = formatterFecha.format(new Date(h.fecha_creacion));
      fila.append(precio, fecha);
      contenedor.appendChild(fila);
    }
  } catch (err) {
    contenedor.innerHTML = `<p class="text-sm text-red-500">${err.message}</p>`;
  }
}

function cerrarDetalle() {
  const modal = $("#modal-detalle");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

$("#modal-detalle-cerrar").addEventListener("click", cerrarDetalle);
$("#btn-cerrar-detalle").addEventListener("click", cerrarDetalle);
$("#modal-detalle").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) cerrarDetalle();
});

// ---------------------------------------------------------------
// Borrar
// ---------------------------------------------------------------
async function borrarCotizacion(id, nombreProducto) {
  if (!confirm(`¿Eliminar la cotización de ${nombreProducto}?`)) return;
  try {
    await apiRequest(`/api/cotizaciones/${id}`, { method: "DELETE" });
    toast("Cotización eliminada");
    cargarGuardadas();
  } catch (err) {
    toast(err.message, false);
  }
}

// ---------------------------------------------------------------
// Exportar CSV
// ---------------------------------------------------------------
function descargarCsv(nombreArchivo, contenido) {
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

$("#btn-exportar-csv").addEventListener("click", () => {
  if (!detalleActual) return;
  const d = detalleActual;
  const lineas = [
    ["Producto", d.nombre_producto],
    ["Codigo", d.producto_id],
    ["Cliente", textoCliente(d)],
    ["Fecha", new Date(d.fecha_creacion).toLocaleString()],
    [],
    ["Materia prima", "Cantidad", "Precio unitario", "Subtotal", "Cobrado"],
  ];
  for (const item of d.detalles) {
    lineas.push([
      item.nombre_mp,
      item.cantidad_usada,
      item.precio_unitario_aplicado,
      item.cobrado ? item.cantidad_usada * item.precio_unitario_aplicado : "",
      item.cobrado ? "Si" : "No",
    ]);
  }
  lineas.push([]);
  if (Array.isArray(d.detalle_financiero) && d.detalle_financiero.length > 0) {
    lineas.push(["Costo financiero por periodo", "Porcentaje"]);
    for (const t of d.detalle_financiero) {
      lineas.push([t.etiqueta, t.porcentaje]);
    }
    lineas.push([]);
  }
  lineas.push(
    ["Costo MP total", d.costo_mp_total],
    ["Costo proceso", d.costo_proceso],
    ["Embolsado", d.costo_embolsado ?? 0],
    ["Etiquetado", d.costo_etiquetado ?? 0],
    ["Costo financiero %", d.porcentaje_financiero],
    ["Bonificacion %", d.porcentaje_bonificacion],
    ["Precio final", d.precio_final],
    ["Precio bonificado", d.precio_bonificado]
  );
  const csv = lineas
    .map((fila) => fila.map((celda) => `"${String(celda ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  descargarCsv(`cotizacion_${d.producto_id}_${d.id}.csv`, csv);
});

// Inicial
cargarGuardadas();
