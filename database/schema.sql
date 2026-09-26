-- =============================================================
-- Esquema de base de datos: Cotizador de Productos
-- PostgreSQL 14+ (compatible con Supabase / Render)
-- =============================================================

-- Extensión para generar UUIDs (gen_random_uuid está disponible
-- en PG 13+ sin la extensión pgcrypto, pero la dejamos por compat.)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------
-- 1. materias_primas
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materias_primas (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre         VARCHAR(255) NOT NULL,
    unidad_medida  VARCHAR(50)  NOT NULL,
    estado         VARCHAR(20)  NOT NULL DEFAULT 'activo'
                   CHECK (estado IN ('activo', 'inactivo')),
    fecha_creacion TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_nombre
    ON materias_primas (LOWER(nombre));

-- -------------------------------------------------------------
-- 2. historial_precios_mp (precio actual = último por materia prima)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_precios_mp (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    materia_prima_id   UUID NOT NULL REFERENCES materias_primas (id) ON DELETE CASCADE,
    precio_unitario    NUMERIC(15, 4) NOT NULL CHECK (precio_unitario >= 0),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_precios_mp_mp_fecha
    ON historial_precios_mp (materia_prima_id, fecha_actualizacion DESC);

-- Vista: precio vigente (más reciente) por materia prima
CREATE OR REPLACE VIEW vista_precio_actual AS
SELECT DISTINCT ON (h.materia_prima_id)
       h.materia_prima_id,
       h.precio_unitario,
       h.fecha_actualizacion
FROM historial_precios_mp h
ORDER BY h.materia_prima_id, h.fecha_actualizacion DESC;

-- -------------------------------------------------------------
-- 3. cotizaciones
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cotizaciones (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id            VARCHAR(255) NOT NULL,
    nombre_producto        VARCHAR(255) NOT NULL,
    cliente_nombre         VARCHAR(255),
    cliente_cuit           VARCHAR(50),
    cliente_telefono       VARCHAR(100),
    costo_mp_total         NUMERIC(15, 4) NOT NULL DEFAULT 0,
    costo_proceso          NUMERIC(15, 4) NOT NULL DEFAULT 0,
    costo_embolsado        NUMERIC(15, 4) NOT NULL DEFAULT 0,
    costo_etiquetado       NUMERIC(15, 4) NOT NULL DEFAULT 0,
    porcentaje_financiero  NUMERIC(8, 4)  NOT NULL DEFAULT 0,
    detalle_financiero     JSONB, -- [{etiqueta, porcentaje}] tramos que suman porcentaje_financiero
    porcentaje_bonificacion NUMERIC(8, 4) NOT NULL DEFAULT 0,
    precio_final           NUMERIC(15, 4) NOT NULL DEFAULT 0,
    precio_bonificado      NUMERIC(15, 4) NOT NULL DEFAULT 0,
    fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_producto
    ON cotizaciones (producto_id, fecha_creacion DESC);

-- -------------------------------------------------------------
-- 4. cotizacion_detalles
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cotizacion_detalles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id           UUID NOT NULL REFERENCES cotizaciones (id) ON DELETE CASCADE,
    materia_prima_id        UUID REFERENCES materias_primas (id),
    codigo_mp               VARCHAR(50),
    nombre_mp               VARCHAR(255),
    es_tarea                BOOLEAN NOT NULL DEFAULT FALSE,
    cantidad_usada          NUMERIC(15, 6) NOT NULL DEFAULT 0,
    precio_unitario_aplicado NUMERIC(15, 4) NOT NULL DEFAULT 0,
    cobrado                 BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_cotiz_det_cotizacion
    ON cotizacion_detalles (cotizacion_id);