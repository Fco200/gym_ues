const mysql = require('mysql2');
require('dotenv').config();

// Creamos un pool de conexiones para mayor rendimiento y estabilidad
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Probamos la conexión de manera automática al arrancar
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error al conectar a la base de datos MySQL:', err.message);
    return;
  }
  console.log('¡Conectado exitosamente a la base de datos MySQL (phpMyAdmin)! 📦');
  connection.release();
});

// Exportamos la versión con promesas para usar async/await fácilmente
module.exports = pool.promise();