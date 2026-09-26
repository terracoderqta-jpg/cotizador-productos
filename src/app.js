import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import materiasPrimasRoutes from "./routes/materiasPrimas.routes.js";
import productosRoutes from "./routes/productos.routes.js";
import cacheRoutes from "./routes/cache.routes.js";
import cotizacionesRoutes from "./routes/cotizaciones.routes.js";
import jvpRoutes from "./routes/jvp.routes.js";
import preciosRoutes from "./routes/precios.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// Frontend estático (Tailwind vía CDN desde public/)
app.use(express.static(path.join(__dirname, "..", "public")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Módulo 1: ABM Materias Primas
app.use("/api/materias-primas", materiasPrimasRoutes);

// Módulo 2: BOM desde BigQuery (con caché) y administración de caché
app.use("/api/productos", productosRoutes);
app.use("/api/cache", cacheRoutes);

// Módulo 3: motor de cálculo y cotizaciones
app.use("/api/cotizaciones", cotizacionesRoutes);

// JVP: movimientos de producción (CSV, sin DB)
app.use("/api/jvp", jvpRoutes);

// Precios $/kg por materia prima del JVP
app.use("/api/precios", preciosRoutes);

// 404 y manejo centralizado de errores
app.use(notFound);
app.use(errorHandler);

export default app;