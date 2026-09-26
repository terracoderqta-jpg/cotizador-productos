import { pool, query } from "../config/db.js";

export async function findAll() {
  const { rows } = await query(
    `SELECT mp.id,
            mp.nombre,
            mp.unidad_medida,
            mp.estado,
            mp.fecha_creacion,
            pa.precio_unitario AS "precio_actual",
            pa.fecha_actualizacion AS "ultimo_precio_fecha"
       FROM materias_primas mp
       LEFT JOIN vista_precio_actual pa ON pa.materia_prima_id = mp.id
      ORDER BY mp.nombre ASC`
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(`SELECT * FROM materias_primas WHERE id = $1`, [id]);
  return rows[0];
}

export async function create({ nombre, unidad_medida }) {
  const { rows } = await query(
    `INSERT INTO materias_primas (nombre, unidad_medida)
     VALUES ($1, $2)
     RETURNING *`,
    [nombre, unidad_medida]
  );
  return rows[0];
}

export async function updateEstado(id, estado) {
  const { rows } = await query(
    `UPDATE materias_primas
        SET estado = $1
      WHERE id = $2
      RETURNING *`,
    [estado, id]
  );
  return rows[0];
}

export async function findPrecios(materiaPrimaId) {
  const { rows } = await query(
    `SELECT h.id,
            h.precio_unitario,
            h.fecha_actualizacion
       FROM historial_precios_mp h
      WHERE h.materia_prima_id = $1
      ORDER BY h.fecha_actualizacion DESC`,
    [materiaPrimaId]
  );
  return rows;
}

/**
 * Inserta un precio dentro de una transacción con bloqueo compartido
 * sobre la materia prima, de modo que dos altas simultáneas del mismo
 * producto no compartan el mismo timestamp y siempre quede "el más
 * reciente" bien definido.
 */
export async function insertPrecio(materiaPrimaId, precioUnitario) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query(
      `SELECT id FROM materias_primas WHERE id = $1 FOR SHARE`,
      [materiaPrimaId]
    );
    if (lock.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const { rows } = await client.query(
      `INSERT INTO historial_precios_mp (materia_prima_id, precio_unitario)
       VALUES ($1, $2)
       RETURNING *`,
      [materiaPrimaId, precioUnitario]
    );
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}