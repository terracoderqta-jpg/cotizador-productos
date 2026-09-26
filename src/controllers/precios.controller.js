import * as jvpService from "../services/jvp.service.js";
import * as mpService from "../services/materiasPrimas.service.js";
import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Lista cada NroID + Descripción del JVP con su precio vigente
 * (cruce por nombre contra materias_primas), más los costos fijos
 * por unidad (Embolsado / Etiquetado) que también se cargan acá.
 */
export async function listarPrecios(req, res, next) {
  try {
    const mps = [
      ...jvpService.listarMpsDistintas(),
      { nro_mp: "—", descripcion_mp: "EMBOLSADO", es_costo_fijo: true },
      { nro_mp: "—", descripcion_mp: "ETIQUETADO", es_costo_fijo: true },
    ];
    const nombres = mps.map((m) => m.descripcion_mp.toLowerCase());
    const { rows } = await query(
      `SELECT mp.id,
              mp.nombre,
              mp.estado,
              mp.unidad_medida,
              pa.precio_unitario AS "precio_actual"
         FROM materias_primas mp
         LEFT JOIN vista_precio_actual pa ON pa.materia_prima_id = mp.id
        WHERE LOWER(mp.nombre) = ANY($1::text[])`,
      [nombres]
    );
    const porNombre = new Map(rows.map((r) => [r.nombre.toLowerCase(), r]));
    const ids = rows.map((r) => r.id);
    let previas = [];
    if (ids.length > 0) {
      const hist = await query(
        `SELECT materia_prima_id, precio_unitario, fecha_actualizacion, rn FROM (
           SELECT h.materia_prima_id, h.precio_unitario, h.fecha_actualizacion,
                  ROW_NUMBER() OVER (PARTITION BY h.materia_prima_id ORDER BY h.fecha_actualizacion DESC) AS rn
             FROM historial_precios_mp h
            WHERE h.materia_prima_id = ANY($1::uuid[])
         ) s WHERE rn BETWEEN 2 AND 4 ORDER BY materia_prima_id, rn`,
        [ids]
      );
      previas = hist.rows;
    }
    const porId = new Map();
    for (const h of previas) {
      if (!porId.has(h.materia_prima_id)) porId.set(h.materia_prima_id, []);
      porId.get(h.materia_prima_id).push({
        precio_unitario: Number(h.precio_unitario),
        fecha_actualizacion: h.fecha_actualizacion,
      });
    }
    res.json(
      mps.map((m) => {
        const mp = porNombre.get(m.descripcion_mp.toLowerCase());
        return {
          nro_mp: m.nro_mp,
          descripcion_mp: m.descripcion_mp,
          es_costo_fijo: !!m.es_costo_fijo,
          unidad_medida: mp?.unidad_medida ?? (m.es_costo_fijo ? "u" : "kg"),
          materia_prima_id: mp?.id ?? null,
          estado: mp?.estado ?? null,
          precio_actual: mp?.precio_actual != null ? Number(mp.precio_actual) : null,
          anteriores: mp ? porId.get(mp.id) ?? [] : [],
        };
      })
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Carga precio por descripción: crea la MP si no existe
 * (unidad "kg" por defecto, "u" para costos fijos) y agrega
 * el precio al historial.
 */
export async function guardarPrecio(req, res, next) {
  try {
    const descripcion = String(req.body?.descripcion_mp ?? "").trim();
    const precio = Number(req.body?.precio_unitario);
    const unidad = req.body?.unidad_medida ? String(req.body.unidad_medida).trim() || "kg" : "kg";
    if (!descripcion) throw new ApiError(400, "Falta la descripción de la materia prima");
    if (!Number.isFinite(precio) || precio < 0) {
      throw new ApiError(400, "El precio debe ser un número mayor o igual a 0");
    }
    const { rows } = await query(
      `SELECT id FROM materias_primas WHERE LOWER(nombre) = LOWER($1)`,
      [descripcion]
    );
    let id = rows[0]?.id;
    if (!id) {
      const creada = await mpService.crearMateriaPrima({ nombre: descripcion, unidad_medida: unidad });
      id = creada.id;
    }
    const registro = await mpService.actualizarPrecio(id, precio);
    res.status(201).json(registro);
  } catch (err) {
    next(err);
  }
}
