const pool = require('./db');

// Migraciones automáticas e idempotentes.
// Se ejecutan al arrancar el servidor; no rompen esquemas existentes.
async function runMigrations() {
  try {
    // 1) students.member_type: distingue estudiantes, MTO y personal externo
    const [memberCol] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'member_type'`
    );
    if (memberCol.length === 0) {
      await pool.query(
        `ALTER TABLE students
         ADD COLUMN member_type ENUM('estudiante','mto','externo')
           NOT NULL DEFAULT 'estudiante' AFTER lastname`
      );
      console.log('✅ Migración: columna students.member_type agregada.');
    }

    // 2) students.turn acepta 'general' (MTO y externos no tienen turno)
    const [turnCol] = await pool.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'turn'`
    );
    if (turnCol.length > 0 && !String(turnCol[0].COLUMN_TYPE).includes("'general'")) {
      await pool.query(
        `ALTER TABLE students MODIFY COLUMN turn
         ENUM('mañana','tarde','general') NOT NULL DEFAULT 'mañana'`
      );
      console.log('✅ Migración: students.turn ahora acepta "general".');
    }

    // 3) Tabla settings: documentos y horario editables por el administrador
    await pool.query(
      `CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(60) NOT NULL UNIQUE,
        setting_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    // 4) students.fingerprint_template: template biométrico (huella) del alumno
    const [fingerprintCol] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'fingerprint_template'`
    );
    if (fingerprintCol.length === 0) {
      await pool.query(
        `ALTER TABLE students ADD COLUMN fingerprint_template MEDIUMTEXT NULL AFTER image_url`
      );
      console.log('✅ Migración: columna students.fingerprint_template agregada.');
    }
  } catch (error) {
    console.error('⚠️  No se pudieron aplicar las migraciones:', error.message);
  }
}

module.exports = { runMigrations };