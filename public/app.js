const $ = (sel) => document.querySelector(sel);

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

// Inicial
cargarJvp();

// ---------------------------------------------------------------
// Fórmulas JVP (lista + despliegue, CSV sin DB)
// ---------------------------------------------------------------
async function cargarJvp() {
  const buscar = $("#jvp-buscar")?.value.trim() ?? "";
  const cont = $("#lista-formulas");
  try {
    const params = new URLSearchParams();
    if (buscar) params.set("buscar", buscar);
    const formulas = await apiRequest(`/api/jvp/formulas?${params}`);
    $("#jvp-count").textContent = `${formulas.length} fórmula(s)`;
    cont.innerHTML = "";
    if (formulas.length === 0) {
      cont.innerHTML =
        '<p class="px-4 py-6 text-center text-gray-400 text-sm">Sin fórmulas para el filtro.</p>';
      return;
    }
    for (const f of formulas) {
      const item = document.createElement("div");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50";
      const titulo = document.createElement("span");
      titulo.className = "font-medium text-gray-800 text-sm";
      titulo.textContent = `${f.codigo_formula} — ${f.nombre_formula}`;
      const meta = document.createElement("span");
      meta.className = "text-xs text-gray-500 whitespace-nowrap";
      meta.textContent = `${f.movimientos} mov. · ${f.tareas} tareas ▾`;
      btn.append(titulo, meta);

      const detalle = document.createElement("div");
      detalle.className = "hidden px-4 pb-4";
      detalle.innerHTML =
        '<p class="py-3 text-sm text-gray-400">Cargando...</p>';

      btn.addEventListener("click", () => toggleFormula(f, detalle, meta));
      item.append(btn, detalle);
      cont.appendChild(item);
    }
  } catch (err) {
    cont.innerHTML = `<p class="px-4 py-6 text-center text-red-500 text-sm">${err.message}</p>`;
  }
}

async function toggleFormula(f, detalle, meta) {
  const abierto = !detalle.classList.contains("hidden");
  if (abierto) {
    detalle.classList.add("hidden");
    meta.textContent = `${f.movimientos} mov. · ${f.tareas} tareas ▾`;
    return;
  }
  meta.textContent = `${f.movimientos} mov. · ${f.tareas} tareas ▴`;
  detalle.classList.remove("hidden");
  if (detalle.dataset.cargado) return;
  try {
    const params = new URLSearchParams({ codigo: f.codigo_formula, limit: "500" });
    const data = await apiRequest(`/api/jvp/movimientos?${params}`);
    const exactos = data.movimientos.filter((m) => m.codigo_formula === f.codigo_formula);
    const parseFecha = (s) => {
      const [d, m2, y] = String(s).split("/").map(Number);
      return new Date(y || 0, (m2 || 1) - 1, d || 1).getTime();
    };
    const porFecha = new Map();
    for (const m of exactos) {
      if (!porFecha.has(m.fecha_tarea)) porFecha.set(m.fecha_tarea, new Map());
      const porTarea = porFecha.get(m.fecha_tarea);
      if (!porTarea.has(m.nro_tarea)) porTarea.set(m.nro_tarea, []);
      porTarea.get(m.nro_tarea).push(m);
    }
    const fechas = [...porFecha.keys()].sort((a, b) => parseFecha(a) - parseFecha(b));
    detalle.innerHTML = "";
    for (const fecha of fechas) {
      const porTarea = porFecha.get(fecha);
      const tareas = [...porTarea.keys()].sort((a, b) => Number(a) - Number(b));
      const totalFecha = tareas
        .flatMap((t) => porTarea.get(t))
        .reduce((acc, m) => acc + Number(m.valor_captura), 0);

      const bloqueFecha = document.createElement("div");
      bloqueFecha.className = "mt-3";

      const btnFecha = document.createElement("button");
      btnFecha.type = "button";
      btnFecha.className =
        "w-full bg-gray-100 rounded-lg px-4 py-2 flex items-center justify-between hover:bg-gray-200";
      const tituloFecha = document.createElement("span");
      tituloFecha.className = "text-sm font-semibold text-gray-700";
      tituloFecha.textContent = `Fecha ${fecha}`;
      const metaFecha = document.createElement("span");
      metaFecha.className = "text-xs text-gray-500";
      metaFecha.textContent = `${tareas.length} tarea(s) · total ${totalFecha.toLocaleString("es-AR")} ▾`;
      btnFecha.append(tituloFecha, metaFecha);

      const contTareas = document.createElement("div");
      contTareas.className = "hidden";

      btnFecha.addEventListener("click", () => {
        const cerrado = contTareas.classList.contains("hidden");
        contTareas.classList.toggle("hidden");
        metaFecha.textContent = `${tareas.length} tarea(s) · total ${totalFecha.toLocaleString("es-AR")} ${cerrado ? "▴" : "▾"}`;
      });

      for (const tarea of tareas) {
        const filas = porTarea.get(tarea);
        const totalTarea = filas.reduce((acc, m) => acc + Number(m.valor_captura), 0);

        const bloqueTarea = document.createElement("div");
        bloqueTarea.className = "border border-gray-200 rounded-lg mt-2";

        const btnTarea = document.createElement("button");
        btnTarea.type = "button";
        btnTarea.className =
          "w-full bg-gray-50 rounded-lg px-4 py-2 flex items-center justify-between hover:bg-gray-100";
        const tituloTarea = document.createElement("span");
        tituloTarea.className = "text-sm font-medium text-gray-700";
        tituloTarea.textContent = `Tarea ${tarea}`;
        const metaTarea = document.createElement("span");
        metaTarea.className = "text-xs text-gray-500";
        metaTarea.textContent = `total ${totalTarea.toLocaleString("es-AR")} ▾`;
        btnTarea.append(tituloTarea, metaTarea);

        const contFilas = document.createElement("div");
        contFilas.className = "hidden overflow-x-auto";
        let tabla =
          '<table class="min-w-full text-sm divide-y divide-gray-200">' +
          '<thead class="bg-white text-left text-xs uppercase text-gray-500"><tr>' +
          '<th class="px-4 py-2 font-medium">Materia prima</th>' +
          '<th class="px-4 py-2 font-medium text-right">Valor captura</th>' +
          "</tr></thead><tbody class='divide-y divide-gray-100'>";
        for (const m of filas) {
          tabla +=
            "<tr>" +
            `<td class="px-4 py-2 text-gray-600">${m.nro_mp} - ${m.descripcion_mp}</td>` +
            `<td class="px-4 py-2 text-right font-semibold text-gray-800">${Number(m.valor_captura).toLocaleString("es-AR")}</td>` +
            "</tr>";
        }
        tabla += "</tbody></table>";
        contFilas.innerHTML = tabla;

        btnTarea.addEventListener("click", () => {
          const cerrado = contFilas.classList.contains("hidden");
          contFilas.classList.toggle("hidden");
          metaTarea.textContent = `total ${totalTarea.toLocaleString("es-AR")} ${cerrado ? "▴" : "▾"}`;
        });

        bloqueTarea.append(btnTarea, contFilas);
        contTareas.appendChild(bloqueTarea);
      }

      bloqueFecha.append(btnFecha, contTareas);
      detalle.appendChild(bloqueFecha);
    }
    detalle.dataset.cargado = "1";
  } catch (err) {
    detalle.innerHTML = `<p class="py-3 text-sm text-red-500">${err.message}</p>`;
  }
}

$("#form-jvp").addEventListener("submit", (event) => {
  event.preventDefault();
  cargarJvp();
});
