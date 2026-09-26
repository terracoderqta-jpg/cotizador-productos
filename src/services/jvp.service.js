import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUTA_CSV = path.join(__dirname, "..", "..", "jvp 2026 08.csv");

let cache = null;

function cargar() {
  if (cache) return cache;
  const texto = readFileSync(RUTA_CSV, "utf8");
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  const cabecera = lineas[0].replace(/^\uFEFF/, "").split(";");
  cache = lineas.slice(1).map((linea) => {
    const partes = linea.split(";");
    const fila = {};
    cabecera.forEach((col, i) => {
      fila[col] = (partes[i] ?? "").trim();
    });
    return {
      nro_tarea: fila["NroID Tarea"] ?? "",
      fecha_tarea: fila["Fecha Tarea"] ?? "",
      set_tarea: Number((fila["Set Tarea"] ?? "0").replace(",", ".")) || 0,
      codigo_formula: fila["Codigo de Formula"] ?? "",
      nombre_formula: fila["Nombre Formula"] ?? "",
      set_captura: Number((fila["Set Captura"] ?? "0").replace(",", ".")) || 0,
      valor_captura: Number((fila["Valor Captura"] ?? "0").replace(",", ".")) || 0,
      nro_mp: fila["NroID Materia Prima"] ?? "",
      descripcion_mp: fila["Descripcion Materia Prima"] ?? "",
    };
  });
  return cache;
}

export function listarMovimientos({ codigo = "", tarea = "", buscar = "", limit = 100 } = {}) {
  const filas = cargar();
  const cod = String(codigo).toLowerCase().trim();
  const tar = String(tarea).trim();
  const q = String(buscar).toLowerCase().trim();
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 2000);
  const filtradas = filas.filter((f) => {
    if (cod && !f.codigo_formula.toLowerCase().includes(cod)) return false;
    if (tar && f.nro_tarea !== tar) return false;
    if (
      q &&
      !(
        f.descripcion_mp.toLowerCase().includes(q) ||
        f.nombre_formula.toLowerCase().includes(q) ||
        f.nro_tarea.includes(q)
      )
    )
      return false;
    return true;
  });
  return { total: filtradas.length, movimientos: filtradas.slice(0, lim) };
}

export function listarMpsDistintas() {
  const filas = cargar();
  const mapa = new Map();
  for (const f of filas) {
    if (!mapa.has(f.nro_mp)) {
      mapa.set(f.nro_mp, { nro_mp: f.nro_mp, descripcion_mp: f.descripcion_mp });
    }
  }
  return [...mapa.values()].sort((a, b) => Number(a.nro_mp) - Number(b.nro_mp));
}

export function listarFormulas({ buscar = "" } = {}) {  const filas = cargar();
  const q = String(buscar).toLowerCase().trim();
  const mapa = new Map();
  for (const f of filas) {
    if (
      q &&
      !(
        f.codigo_formula.toLowerCase().includes(q) ||
        f.nombre_formula.toLowerCase().includes(q)
      )
    )
      continue;
    if (!mapa.has(f.codigo_formula)) {
      mapa.set(f.codigo_formula, {
        codigo_formula: f.codigo_formula,
        nombre_formula: f.nombre_formula,
        movimientos: 0,
        tareas: new Set(),
      });
    }
    const e = mapa.get(f.codigo_formula);
    e.movimientos += 1;
    e.tareas.add(f.nro_tarea);
  }
  return [...mapa.values()]
    .map((e) => ({ ...e, tareas: e.tareas.size }))
    .sort((a, b) => a.codigo_formula.localeCompare(b.codigo_formula));
}

export function listarTareas(codigo = "") {
  const filas = cargar();
  const cod = String(codigo).trim().toLowerCase();
  const mapa = new Map();
  for (const f of filas) {
    if (cod && f.codigo_formula.toLowerCase() !== cod) continue;
    if (!mapa.has(f.nro_tarea)) {
      mapa.set(f.nro_tarea, {
        nro_tarea: f.nro_tarea,
        fecha_tarea: f.fecha_tarea,
        set_tarea: f.set_tarea,
        codigo_formula: f.codigo_formula,
        movimientos: 0,
      });
    }
    mapa.get(f.nro_tarea).movimientos += 1;
  }
  const parseFecha = (s) => {
    const [d, m, y] = String(s).split("/").map(Number);
    return new Date(y || 0, (m || 1) - 1, d || 1).getTime();
  };
  return [...mapa.values()].sort(
    (a, b) => parseFecha(a.fecha_tarea) - parseFecha(b.fecha_tarea) || Number(a.nro_tarea) - Number(b.nro_tarea)
  );
}
