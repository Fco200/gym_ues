/**
 * Gym UES - Servidor Express principal
 * - CORS habilitado (funciona en desarrollo Vite y en Electron empaquetado)
 * - express.json para APIs, multer para PDFs en uploads.routes
 * - Sirve /uploads como estaticos
 * - Todas las rutas bajo /api
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, pool } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Directorio de subida de PDFs (configurable para entorno empaquetado)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', async (_req, res) => {
  let db = false;
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    db = !!(rows && rows.length && rows[0].ok === 1);
  } catch {
    db = false;
  }
  res.json({ ok: true, servicio: 'Gym UES API', db, hora: new Date().toISOString() });
});

// Rutas del API
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/public', require('./routes/public.routes'));
app.use('/api/students', require('./routes/students.routes'));
app.use('/api/attendance', require('./routes/attendance.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/uploads', require('./routes/uploads.routes'));
app.use('/api/users', require('./routes/users.routes'));

// Manejo central de errores.
// FIRMA OBLIGATORIA de 4 parametros (err, req, res, next): Express solo lo
// trata como middleware de error si arity == 4. Nunca se exponen errores
// internos de Node (TypeError: "res.json is not a function", etc.) al cliente.
app.use((err, _req, res, _next) => {
  console.error('[api] Error:', err && (err.stack || err.message));
  const msg = (err && err.message) || 'Error interno del servidor';

  // Errores internos de Node siempre se reportan como genericos
  const interno =
    err instanceof TypeError ||
    err instanceof ReferenceError ||
    /(is not a function|Cannot read|is not defined|Unexpected token|Cannot set headers)/i.test(msg);

  let mensaje = 'Error interno del servidor. Intentelo nuevamente.';
  if (!interno) {
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ER_ACCESS_DENIED/i.test(msg)) {
      mensaje = 'No se pudo conectar con la base de datos MySQL. Verifique que XAMPP este encendido.';
    } else if (msg && msg !== 'Error interno del servidor') {
      mensaje = msg;
    }
  }

  if (res.headersSent) {
    return _next(err);
  }
  try {
    res.status(Number.isInteger(err && err.status) ? err.status : 500).json({ mensaje });
  } catch (e) {
    // Ultimo recurso: nunca dejar colgada la peticion
    try {
      res.end(JSON.stringify({ mensaje }));
    } catch (_e2) {
      /* sin respuesta posible */
    }
  }
});

// Inicializa el esquema y arranca el servidor
async function startServer() {
  try {
    await initDatabase();
    const server = app.listen(PORT, () => {
      console.log(`[servidor] Gym UES API escuchando en http://localhost:${PORT}`);
    });
    return server;
  } catch (err) {
    console.error('[servidor] No se pudo iniciar la base de datos:', err.message);
    console.error('[servidor] Verifique que XAMPP/MySQL este corriendo.');
    throw err;
  }
}

// Exporta startServer: nodemon lo invoca como proceso principal,
// Electron empaquetado lo invoca via require().
if (require.main === module) {
  startServer();
}

module.exports = startServer;
module.exports.app = app;
module.exports.pool = pool;
module.exports.UPLOADS_DIR = UPLOADS_DIR;