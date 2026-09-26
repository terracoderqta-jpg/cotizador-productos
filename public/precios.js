const $ = (sel) => document.querySelector(sel);

const formatterMoneda = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

let precios = [];

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

async function cargarPrecios() {
  const tbody = $("#tabla-precios");
  try {
    precios = await apiRequest("/api/precios");
    renderPrecios();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-red-500">${err.message}</td></tr>`;
  }
}

function renderPrecios() {
  const q = $("#filtro-buscar")?.value.trim().toLowerCase() ?? "";
  const tbody = $("#tabla-precios");
  const filas = precios.filter(
    (p) =>
      !q ||
      (p.nro_mp ?? "").toLowerCase().includes(q) ||
      (p.descripcion_mp ?? "").toLowerCase().includes(q)
  );
  $("#precios-count").textContent = `${filas.length} materia(s) prima(s)`;
  tbody.innerHTML = "";
  if (filas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">Sin materias primas.</td></tr>';
    return;
  }
  for (const p of filas) {
    const tr = document.createElement("tr");
    if (p.precio_actual == null) tr.className = "bg-amber-50";
    if (p.es_costo_fijo) tr.className += " bg-blue-50/50";
    const sufijo = p.unidad_medida === "kg" ? "/kg" : "/u";
    const td = (texto, cls) => {
      const c = document.createElement("td");
      c.className = cls;
      c.textContent = texto;
      return c;
    };
    tr.append(
      td(p.nro_mp ?? "—", "px-4 py-3 text-gray-500"),
      td(p.descripcion_mp, "px-4 py-3 font-medium text-gray-800")
    );

    const tdPrecio = document.createElement("td");
    tdPrecio.className = "px-4 py-3 text-right";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.01";
    input.value = p.precio_actual ?? "";
    input.placeholder = "0.00";
    input.className =
      "no-spinner w-32 border border-gray-300 rounded-lg px-3 py-2 text-right focus:ring-2 focus:ring-blue-500 focus:outline-none";
    tdPrecio.appendChild(input);

    const tdAnteriores = document.createElement("td");
    tdAnteriores.className = "px-4 py-3 text-xs text-gray-500";
    if (!p.anteriores || p.anteriores.length === 0) {
      tdAnteriores.textContent = "—";
    } else {
      tdAnteriores.innerHTML = p.anteriores
        .map(
          (a) =>
            `<div>$ ${formatterMoneda.format(a.precio_unitario)}${sufijo} <span class="text-gray-400">(${new Date(a.fecha_actualizacion).toLocaleDateString("es-AR")})</span></div>`
        )
        .join("");
    }

    const tdEstado = document.createElement("td");
    tdEstado.className = "px-4 py-3";
    const badge = document.createElement("span");
    if (p.precio_actual == null) {
      badge.className =
        "inline-block px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700";
      badge.textContent = "Sin precio";
    } else {
      badge.className =
        "inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700";
      badge.textContent = "Con precio";
    }
    tdEstado.appendChild(badge);

    const tdAcciones = document.createElement("td");
    tdAcciones.className = "px-4 py-3 text-right";
    const btn = document.createElement("button");
    btn.className = "bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-lg";
    btn.textContent = "Guardar";
    btn.addEventListener("click", () => guardarPrecio(p, input, btn));
    tdAcciones.appendChild(btn);

    tr.append(tdPrecio, tdAnteriores, tdEstado, tdAcciones);
    tbody.appendChild(tr);
  }
}

async function guardarPrecio(p, input, btn) {
  const valor = Number(input.value);
  const sufijo = p.unidad_medida === "kg" ? "/kg" : "/u";
  if (!Number.isFinite(valor) || valor < 0) {
    toast("Ingrese un precio válido", false);
    return;
  }
  if (p.precio_actual != null && valor !== p.precio_actual) {
    const anterior = `$ ${formatterMoneda.format(p.precio_actual)}${sufijo}`;
    const nuevo = `$ ${formatterMoneda.format(valor)}${sufijo}`;
    if (!confirm(`Cambiar precio de ${p.nro_mp} - ${p.descripcion_mp}?\n${anterior} → ${nuevo}`)) return;
  }
  btn.disabled = true;
  try {
    await apiRequest("/api/precios", {
      method: "POST",
      body: JSON.stringify({
        descripcion_mp: p.descripcion_mp,
        precio_unitario: valor,
        unidad_medida: p.es_costo_fijo ? "u" : "kg",
      }),
    });
    p.precio_actual = valor;
    toast(`Precio guardado: ${p.descripcion_mp} $ ${formatterMoneda.format(valor)}${sufijo}`);
    cargarPrecios();
  } catch (err) {
    toast(err.message, false);
  } finally {
    btn.disabled = false;
  }
}

$("#form-filtro").addEventListener("submit", (event) => {
  event.preventDefault();
  renderPrecios();
});

// Inicial
cargarPrecios();
