// Caché en memoria con vencimiento por TTL.
const cache = new Map();

function clave(key) {
  return `cache:${key}`;
}

function podarExpirados() {
  const ahora = Date.now();
  for (const [k, entrada] of cache) {
    if (ahora > entrada.expira) cache.delete(k);
  }
}

export function getCache(key) {
  const entrada = cache.get(clave(key));
  if (!entrada) return null;
  if (Date.now() > entrada.expira) {
    cache.delete(clave(key));
    return null;
  }
  return entrada.value;
}

export function setCache(key, value, ttlMs) {
  podarExpirados();
  cache.set(clave(key), { value, expira: Date.now() + ttlMs });
}

export function limpiarCache() {
  cache.clear();
}

export function infoCache() {
  const ahora = Date.now();
  const entradas = [];
  for (const [k, v] of cache) {
    if (ahora > v.expira) continue;
    entradas.push({
      key: k.replace("cache:", ""),
      expiraEnMs: v.expira - ahora,
    });
  }
  return { total: entradas.length, entradas };
}