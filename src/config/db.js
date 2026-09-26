import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

// Pool compartido para PostgreSQL (local, Supabase o Render).
// Supabase/Render requieren SSL -> activar con PGSSL=true en .env
export const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

export const query = (text, params) => pool.query(text, params);