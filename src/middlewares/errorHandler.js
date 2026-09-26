export function notFound(req, res) {
  res.status(404).json({ error: "Ruta no encontrada" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  console.error("[ERROR]", err);
  const status = err.status || 500;
  const message = err.expose ? err.message : "Error interno del servidor";
  res.status(status).json({ error: message });
}