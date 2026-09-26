# Cotizador de Productos

Aplicación web liviana para calcular precios de venta de productos, cruzando la **receta (BOM)** del producto con los **precios vigentes de materias primas**.

## Stack

- **Frontend:** HTML5 + Tailwind CSS (CDN) + JavaScript vanilla (`public/`)
- **Backend:** Node.js + Express (arquitectura limpia: `routes → controllers → services → repositories`)
- **Base de datos:** PostgreSQL (compatible con Supabase/Render)
- **BOM:** Google BigQuery (`@google-cloud/bigquery`), con modo **provisorio** de datos de prueba

## Funcionalidades

- **Módulo 1 — ABM Materias Primas:** alta, activar/inactivar, historial de precios y precio vigente por materia prima.
- **Módulo 2 — Lectura de BOM:** lista de productos y última receta desde BigQuery con caché en memoria (24 h configurable). Endpoints para limpiar/inspeccionar caché.
- **Módulo 3 — Motor de cálculo:** selector de producto, tabla interactiva (checkboxes para excluir materias primas del cobro), costos de proceso, % financiero y % bonificación. Cálculo en tiempo real y grabación de cotizaciones con detalle, edición, borrado y exportación CSV.

### Fórmulas

```
Costo MP total      = Σ (cantidad × precio unitario)  para ítems cobrados
Precio Final        = (Costo MP total + Costo Proceso) × (1 + %Financiero / 100)
Precio Bonificado   = Precio Final × (1 − %Bonificación / 100)
```

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- (opcional) Cuenta de Google Cloud con BigQuery y una service account

## Puesta en marcha local

```bash
npm install
```

1. Crear la base de datos `cotizador` y ejecutar `database/schema.sql`.
2. Copiar variables:
   ```bash
   Copy-Item .env.example .env
   ```
3. Cargar en `.env` los datos de PostgreSQL (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`).
4. Cargar materias primas desde `http://localhost:3000` (pestaña Materias Primas), nombrando igual que las recetas del BOM.
5. Arrancar:

```bash
npm run dev        # desarrollo con nodemon
npm start          # producción
```

Abrir `http://localhost:3000`.

> El modo **provisorio** (`BQ_MOCK=true` en `.env`) usa `data/bomMuestras.json` en lugar de BigQuery. Los nombres de materias primas del ABM deben coincidir con los de la receta para que el cruce de precios funcione.

## Conectar BigQuery real

1. Colocar la service account en `service-account.json` (ruta configurable con `GOOGLE_APPLICATION_CREDENTIALS`).
2. En `.env`:
   - `BQ_MOCK=false`
   - `BQ_PROJECT_ID`, `BQ_DATASET_ID`, `BQ_BOM_TABLE` con los datos reales.
3. Ajustar el mapeo de columnas si tu tabla usa otros nombres:

| Variable | Descripción | Default |
|---|---|---|
| `BQ_BOM_COL_PRODUCTO` | Código de producto | `producto` |
| `BQ_BOM_COL_NOMBRE_PRODUCTO` | Descripción del producto | `descripcion` |
| `BQ_BOM_COL_CODIGO_MP` | Código de materia prima | `codigo_mp` |
| `BQ_BOM_COL_NOMBRE_MP` | Nombre de materia prima (cruza contra `materias_primas.nombre`) | `nombre_mp` |
| `BQ_BOM_COL_CANTIDAD` | Cantidad por unidad de producto | `cantidad` |
| `BQ_BOM_COL_FECHA` | Fecha/vigencia de la receta | `fecha` |

La vista de BOM debe tener una fila por (producto, materia prima); el servicio toma el **snapshot más reciente** por producto (`QUALIFY` + `MAX(fecha)`).

## Despliegue en producción

### Base de datos: Supabase

1. Crear un proyecto en [Supabase](https://supabase.com).
2. Abrir **SQL Editor** y pegar el contenido de `database/schema.sql`.
3. En **Project Settings → Database**, copiar los datos de conexión (host, puerto `5432`, usuario, contraseña, base `postgres`).

### Backend: Render

1. Crear un **Web Service** apuntando al repositorio.
2. Runtime: **Node**, build: `npm install`, start: `npm start`.
3. Cargar variables de entorno (Environment → Environment Variables):

```
PORT=10000
PGHOST=<host supabase>
PGPORT=5432
PGUSER=<usuario>
PGPASSWORD=<password>
PGDATABASE=postgres
PGSSL=true
BQ_MOCK=true            # o false cuando haya BigQuery
PORCENTAJE_FINANCIERO_MAX=100
PORCENTAJE_BONIFICACION_MAX=100
```

4. Con BigQuery real, la service account se agrega como **Secret File** en Render (`/etc/secrets/service-account.json`) y se setea:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/service-account.json
   BQ_PROJECT_ID=...
   BQ_DATASET_ID=...
   BQ_BOM_TABLE=...
   ```
5. La app sirve el frontend estático desde `public/`. El CORS está habilitado en modo amplio.

> Nota: la caché de recetas es en memoria y se reinicia al desplegar/reiniciar el servicio. La primera consulta de cada producto vuelve a leer BigQuery.

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Health check |
| GET/POST | `/api/materias-primas` | Listar / crear materia prima |
| PATCH | `/api/materias-primas/:id/estado` | Activar / inactivar |
| GET/POST | `/api/materias-primas/:id/precios` | Historial / alta de precio |
| GET | `/api/productos` | Productos disponibles (BOM pod cache 24 h) |
| GET | `/api/productos/:productoId/bom` | Última receta del producto |
| GET | `/api/cotizaciones/preparar?producto_id=` | BOM cruzado con precios vigentes |
| POST | `/api/cotizaciones` | Grabar cotización + detalles |
| GET | `/api/cotizaciones/:id` | Detalle de cotización |
| PUT | `/api/cotizaciones/:id` | Actualizar cotización |
| DELETE | `/api/cotizaciones/:id` | Borrar cotización |
| GET | `/api/cotizaciones/historial-producto?producto_id=` | Evolución de precios del producto |
| GET/DELETE | `/api/cache` | Inspect / limpiar caché de recetas |

## Estructura

```
├── database/schema.sql          # esquema PostgreSQL
├── data/bomMuestras.json        # BOM provisional (BQ_MOCK=true)
├── public/                      # frontend (index.html, cotizacion.html, app.js, cotizacion.js)
└── src/
    ├── server.js / app.js       # arranque y configuración Express
    ├── config/                  # db.js (pg), bigquery.js
    ├── routes/                  # capa HTTP
    ├── controllers/             # orquesta requests
    ├── services/                # lógica de negocio (BOM, motor de precios, caché, cotizaciones)
    │   └── providers/           # bomMock.js y bomBigQuery.js (intercambiables)
    ├── repositories/            # consultas SQL
    ├── middlewares/             # manejo de errores
    └── utils/                   # ApiError, etc.
```

## Licencia

MIT