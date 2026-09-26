-- Migración: permitir detalles de tareas JVP (sin materia_prima_id).
-- Ejecutar en bases ya creadas con schema.sql anterior.
ALTER TABLE cotizacion_detalles ALTER COLUMN materia_prima_id DROP NOT NULL;
ALTER TABLE cotizacion_detalles ADD COLUMN IF NOT EXISTS codigo_mp VARCHAR(50);
ALTER TABLE cotizacion_detalles ADD COLUMN IF NOT EXISTS nombre_mp VARCHAR(255);
ALTER TABLE cotizacion_detalles ADD COLUMN IF NOT EXISTS es_tarea BOOLEAN NOT NULL DEFAULT FALSE;
