-- Migración: datos de cliente (opcionales) en cotizaciones.
-- Ejecutar en bases ya creadas con schema.sql anterior.
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(255);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS cliente_cuit VARCHAR(50);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS cliente_telefono VARCHAR(100);
