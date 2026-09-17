const mysql = require('mysql2');
require('dotenv').config();

// Pool de conexiones: nuestra conexión a MySQL NUNCA detiene el servidor.
// Si XAMPP se apaga o reinicia, el pool se reconecta solo cuando MySQL vuelva.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Prueba la conexión al arrancar (sin bloquear el servidor si falla)
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Base de datos no disponible al iniciar:', err.message || err.code || err);
    console.error('   ⏳ El servidor sigue activo. Se reconectará automáticamente cuando MySQL/XAMPP vuelva a estar encendido.');
    return;
  }
  console.log('¡Conectado exitosamente a la base de datos MySQL (phpMyAdmin)! 📦');
  connection.release();
});

const promisePool = pool.promise();

// Errores transitorios de conexión: merecen reintento automático
const RETRYABLE = new Set([
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EPIPE',
  'EHOSTUNREACH',
  'ER_SERVER_SHUTDOWN',
  'ER_CON_COUNT_ERROR'
]);

const originalQuery = promisePool.query.bind(promisePool);

let reconnectLogPending = false;
const logReconnect = (code) => {
  if (!reconnectLogPending) {
    reconnectLogPending = true;
    console.error(`⚠️  MySQL caído o reiniciando (${code}) — reintentando conexión...`);
    setTimeout(() => { reconnectLogPending = false; }, 3000);
  }
};

// Wrapper con reintentos automáticos (solo si el error es recuperable)
promisePool.query = async function (sql, params) {
  const trimSql = sql.trim().toLowerCase().startsWith('select');
  const maxAttempts = trimSql ? 4 : 3;
  let attempts = 0;

  for (;;) {
    try {
      return params ? await originalQuery(sql, params) : await originalQuery(sql);
    } catch (error) {
      const recoverable = RETRYABLE.has(error.code);
      if (!recoverable || attempts >= maxAttempts - 1) throw error;
      attempts += 1;
      logReconnect(error.code);
      await new Promise((resolve) => setTimeout(resolve, 800 * attempts));
    }
  }
};

// Heartbeat: mantiene las conexiones vivas y reconecta el pool si XAMPP se detuvo
setInterval(async () => {
  try {
    await promisePool.query('SELECT 1');
  } catch {
    // El log de reconexión ya se registró dentro de query()
  }
}, 25000);

module.exports = promisePool;