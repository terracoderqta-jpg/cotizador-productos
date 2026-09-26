import { pool, query } from "../config/db.js";

/**
 * Trae las materias primas (con su precio vigente) cuyo nombre coincide
 * con los nombres del BOM. El cruce es por nombre normalizado (minúsculas).
 */
export async function obtenerPreciosPorNombres(nombres) {
  if (nombres.length === 0) return [];
  const { rows } = await query(
    `SELECT mp.id,
            mp.nombre,
            mp.estado,
            pa.precio_unitario
       FROM materias_primas mp
       LEFT JOIN vista_precio_actual pa ON pa.materia_prima_id = mp.id
      WHERE LOWER(mp.nombre) = ANY($1::text[])`,
    [nombres.map((n) => String(n).toLowerCase())]
  );
  return rows;
}

export async function findRecent(limite = 20) {
  const { rows } = await query(
    `SELECT c.*,
            (SELECT COUNT(*) FROM cotizacion_detalles d WHERE d.cotizacion_id = c.id) AS "total_items"
       FROM cotizaciones c
      ORDER BY c.fecha_creacion DESC
      LIMIT $1`,
    [limite]
  );
  return rows;
}

/**
 * Inserta la cotización y sus detalles dentro de una transacción.
 */
export async function createCotizacionConDetalles({ registro, detalles }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [cotizacion] } = await client.query(
      `INSERT INTO cotizaciones
        (producto_id, nombre_producto, cliente_nombre, cliente_cuit, cliente_telefono,
         costo_mp_total, costo_proceso, costo_embolsado, costo_etiquetado,
         porcentaje_financiero, detalle_financiero, porcentaje_bonificacion, precio_final, precio_bonificado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        registro.producto_id,
        registro.nombre_producto,
        registro.cliente_nombre,
        registro.cliente_cuit,
        registro.cliente_telefono,
        registro.costo_mp_total,
        registro.costo_proceso,
        registro.costo_embolsado || 0,
        registro.costo_etiquetado || 0,
        registro.porcentaje_financiero,
        registro.detalle_financiero ? JSON.stringify(registro.detalle_financiero) : null,
        registro.porcentaje_bonificacion,
        registro.precio_final,
        registro.precio_bonificado,
      ]
    );

    for (const d of detalles) {
      await client.query(
        `INSERT INTO cotizacion_detalles
          (cotizacion_id, materia_prima_id, codigo_mp, nombre_mp, es_tarea,
           cantidad_usada, precio_unitario_aplicado, cobrado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [cotizacion.id, d.materia_prima_id, d.codigo_mp, d.nombre_mp, d.es_tarea,
         d.cantidad_usada, d.precio_unitario_aplicado, d.cobrado]
      );
    }

    await client.query("COMMIT");
    return cotizacion;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function findById(id) {
  const { rows } = await query(`SELECT * FROM cotizaciones WHERE id = $1`, [id]);
  return rows[0];
}

export async function findDetalles(cotizacionId) {
  const { rows } = await query(
    `SELECT d.id,
            d.cantidad_usada,
            d.precio_unitario_aplicado,
            d.cobrado,
            d.codigo_mp,
            d.es_tarea,
            COALESCE(mp.nombre, d.nombre_mp, '(materia prima no disponible)') AS "nombre_mp"
       FROM cotizacion_detalles d
       LEFT JOIN materias_primas mp ON mp.id = d.materia_prima_id
      WHERE d.cotizacion_id = $1
      ORDER BY d.cobrado DESC, mp.nombre ASC`,
    [cotizacionId]
  );
  return rows;
}

export async function findByProducto(productoId, limite = 10) {
  const { rows } = await query(
    `SELECT id, nombre_producto, precio_final, precio_bonificado, fecha_creacion
       FROM cotizaciones
      WHERE producto_id = $1
      ORDER BY fecha_creacion DESC
      LIMIT $2`,
    [productoId, limite]
  );
  return rows;
}

export async function removeById(id) {
  const { rows } = await query(`DELETE FROM cotizaciones WHERE id = $1 RETURNING id`, [id]);
  return rows[0];
}

/**
 * Actualiza la cotización y reemplaza sus detalles dentro de una transacción.
 */
export async function updateCotizacionConDetalles({ id, registro, detalles }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [cotizacion] } = await client.query(
      `UPDATE cotizaciones
          SET producto_id = $1, nombre_producto = $2,
              cliente_nombre = $3, cliente_cuit = $4, cliente_telefono = $5,
              costo_mp_total = $6, costo_proceso = $7,
              costo_embolsado = $8, costo_etiquetado = $9,
              porcentaje_financiero = $10, detalle_financiero = $11, porcentaje_bonificacion = $12,
              precio_final = $13, precio_bonificado = $14
        WHERE id = $15
        RETURNING *`,
      [
        registro.producto_id,
        registro.nombre_producto,
        registro.cliente_nombre,
        registro.cliente_cuit,
        registro.cliente_telefono,
        registro.costo_mp_total,
        registro.costo_proceso,
        registro.costo_embolsado || 0,
        registro.costo_etiquetado || 0,
        registro.porcentaje_financiero,
        registro.detalle_financiero ? JSON.stringify(registro.detalle_financiero) : null,
        registro.porcentaje_bonificacion,
        registro.precio_final,
        registro.precio_bonificado,
        id,
      ]
    );

    if (!cotizacion) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(`DELETE FROM cotizacion_detalles WHERE cotizacion_id = $1`, [id]);
    for (const d of detalles) {
      await client.query(
        `INSERT INTO cotizacion_detalles
          (cotizacion_id, materia_prima_id, codigo_mp, nombre_mp, es_tarea,
           cantidad_usada, precio_unitario_aplicado, cobrado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, d.materia_prima_id, d.codigo_mp, d.nombre_mp, d.es_tarea,
         d.cantidad_usada, d.precio_unitario_aplicado, d.cobrado]
      );
    }

    await client.query("COMMIT");
    return cotizacion;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}