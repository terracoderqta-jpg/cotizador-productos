import "dotenv/config";
import { pool, query } from "../src/config/db.js";
import * as precioService from "../src/services/precios.service.js";
import * as repo from "../src/repositories/cotizaciones.repository.js";
import { obtenerBOM } from "../src/services/providers/bomMock.js";

// Materias primas que cruzan con data/bomMuestras.json
const MATERIAS = [
  { nombre: "Polietileno HD", unidad_medida: "kg", precio: 1.85 },
  { nombre: "Polietileno LD", unidad_medida: "kg", precio: 1.95 },
  { nombre: "Pigmento Negro", unidad_medida: "kg", precio: 4.2 },
  { nombre: "Masterbatch Blanco", unidad_medida: "kg", precio: 3.6 },
  { nombre: "Tinta Flexografica", unidad_medida: "kg", precio: 2.5 },
  { nombre: "Resina PET", unidad_medida: "kg", precio: 2.1 },
];

// Cotizaciones de ejemplo para probar el historial
const COTIZACIONES_EJEMPLO = [
  { productoId: "PROD-001", costoProceso: 0.02, porcentajeFinanciero: 5, porcentajeBonificacion: 10 },
  { productoId: "PROD-002", costoProceso: 0.03, porcentajeFinanciero: 5, porcentajeBonificacion: 5 },
];

async function seedMateriasPrimas() {
  let creadas = 0;
  let preciosCargados = 0;

  for (const mp of MATERIAS) {
    const existente = await query(
      `SELECT id FROM materias_primas WHERE LOWER(nombre) = LOWER($1)`,
      [mp.nombre]
    );
    let id;
    if (existente.rows[0]) {
      id = existente.rows[0].id;
    } else {
      const { rows: [creada] } = await query(
        `INSERT INTO materias_primas (nombre, unidad_medida) VALUES ($1, $2) RETURNING id`,
        [mp.nombre, mp.unidad_medida]
      );
      id = creada.id;
      creadas++;
      console.log(`  + Materia prima creada: ${mp.nombre} (${mp.unidad_medida})`);
    }

    const conPrecio = await query(
      `SELECT 1 FROM historial_precios_mp WHERE materia_prima_id = $1 LIMIT 1`,
      [id]
    );
    if (!conPrecio.rows[0]) {
      await query(
        `INSERT INTO historial_precios_mp (materia_prima_id, precio_unitario) VALUES ($1, $2)`,
        [id, mp.precio]
      );
      preciosCargados++;
      console.log(`  + Precio cargado: ${mp.nombre} = $ ${mp.precio}`);
    }
  }

  return { creadas, preciosCargados };
}

async function seedCotizacionesSiVacias() {
  const { rows: [existe] } = await query(`SELECT 1 FROM cotizaciones LIMIT 1`);
  if (existe) {
    console.log("  = Hay cotizaciones cargadas, se omiten las de ejemplo.");
    return 0;
  }

  let insertadas = 0;
  for (const ej of COTIZACIONES_EJEMPLO) {
    const bom = obtenerBOM(ej.productoId);
    const mps = await repo.obtenerPreciosPorNombres(bom.items.map((i) => i.nombre_mp));
    const mapa = new Map(mps.map((m) => [m.nombre.toLowerCase(), m]));

    const detalles = bom.items.map((i) => {
      const mp = mapa.get(i.nombre_mp.toLowerCase());
      const disponible = mp && mp.estado === "activo" && mp.precio_unitario != null;
      return {
        materia_prima_id: mp?.id ?? null,
        cantidad_usada: i.cantidad,
        precio_unitario_aplicado: disponible ? Number(mp.precio_unitario) : 0,
        cobrado: disponible,
      };
    });

    const costoMpTotal = precioService.calcularCostoMpTotal(detalles);
    const precioFinal = precioService.calcularPrecioFinal({
      costoMpTotal,
      costoProceso: ej.costoProceso,
      porcentajeFinanciero: ej.porcentajeFinanciero,
    });
    const precioBonificado = precioService.calcularPrecioBonificado({
      precioFinal,
      porcentajeBonificacion: ej.porcentajeBonificacion,
    });

    const registro = {
      producto_id: bom.producto_id,
      nombre_producto: bom.nombre_producto,
      costo_mp_total: costoMpTotal,
      costo_proceso: ej.costoProceso,
      porcentaje_financiero: ej.porcentajeFinanciero,
      porcentaje_bonificacion: ej.porcentajeBonificacion,
      precio_final: precioFinal,
      precio_bonificado: precioBonificado,
    };

    await repo.createCotizacionConDetalles({ registro, detalles });
    insertadas++;
    console.log(`  + Cotización de ejemplo: ${bom.nombre_producto} = $ ${precioFinal}`);
  }
  return insertadas;
}

async function main() {
  console.log("== Carga de datos de ejemplo ==");
  const mpCount = await seedMateriasPrimas();
  const cotCount = await seedCotizacionesSiVacias();
  console.log("== Resumen ==");
  console.log(
    `Materias primas creadas: ${mpCount.creadas} | precios cargados: ${mpCount.preciosCargados}`
  );
  console.log(`Cotizaciones de ejemplo insertadas: ${cotCount}`);
  console.log("Listo. Arranca la app con `npm run dev`.");
}

main()
  .catch((err) => {
    console.error("[SEED] Error:", err.message);
    console.error("Verificá que PostgreSQL esté disponible y el .env configurado.");
    process.exitCode = 1;
  })
  .finally(() => pool.end());