/**
 * Gym UES - Pool de conexion MySQL (mysql2) e inicializacion de esquema.
 * initDatabase() verifica que las tablas y columnas minimas existan y las
 * crea/agrega automaticamente si hacen falta (compatible con esquemas previos).
 */
const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'gym_ues_db';

// Pool de conexiones para la aplicacion
const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Definicion del esquema: columnas minimas por tabla
const TABLES = {
  students: {
    create: `
      CREATE TABLE IF NOT EXISTS students (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        student_code VARCHAR(50) NOT NULL,
        full_name VARCHAR(200) NOT NULL DEFAULT '',
        second_name VARCHAR(200) NOT NULL DEFAULT '',
        last_name VARCHAR(200) NOT NULL DEFAULT '',
        type VARCHAR(20) NOT NULL DEFAULT 'alumno',
        gender VARCHAR(20) NOT NULL DEFAULT '',
        turn VARCHAR(50) NOT NULL DEFAULT '',
        career VARCHAR(200) NOT NULL DEFAULT '',
        image_url VARCHAR(500) NOT NULL DEFAULT '',
        medical_certificate VARCHAR(255) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_students_code (student_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      student_code: "ADD COLUMN student_code VARCHAR(50) NULL AFTER id",
      full_name: "ADD COLUMN full_name VARCHAR(200) NULL AFTER student_code",
      second_name: "ADD COLUMN second_name VARCHAR(200) NULL AFTER full_name",
      last_name: "ADD COLUMN last_name VARCHAR(200) NULL AFTER second_name",
      type: "ADD COLUMN type VARCHAR(20) NULL AFTER last_name",
      gender: "ADD COLUMN gender VARCHAR(20) NULL AFTER type",
      turn: "ADD COLUMN turn VARCHAR(50) NULL AFTER gender",
      career: "ADD COLUMN career VARCHAR(200) NULL AFTER turn",
      image_url: "ADD COLUMN image_url VARCHAR(500) NULL AFTER career",
      medical_certificate: "ADD COLUMN medical_certificate VARCHAR(255) NULL AFTER image_url",
      created_at: "ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER medical_certificate"
    }
  },
  attendance: {
    create: `
      CREATE TABLE IF NOT EXISTS attendance (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        student_code VARCHAR(50) NOT NULL,
        full_name VARCHAR(200) NOT NULL DEFAULT '',
        user_type VARCHAR(20) NOT NULL DEFAULT '',
        check_in DATETIME NULL,
        check_out DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_attendance_student_code (student_code),
        KEY idx_attendance_check_in (check_in)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      student_code: "ADD COLUMN student_code VARCHAR(50) NULL AFTER id",
      full_name: "ADD COLUMN full_name VARCHAR(200) NULL AFTER student_code",
      user_type: "ADD COLUMN user_type VARCHAR(20) NULL AFTER full_name",
      check_in: "ADD COLUMN check_in DATETIME NULL AFTER user_type",
      check_out: "ADD COLUMN check_out DATETIME NULL AFTER check_in",
      created_at: "ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER check_out"
    }
  },
  settings: {
    create: `
      CREATE TABLE IF NOT EXISTS settings (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        setting_key VARCHAR(100) NOT NULL,
        setting_value LONGTEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_settings_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      setting_key: "ADD COLUMN setting_key VARCHAR(100) NULL AFTER id",
      setting_value: "ADD COLUMN setting_value LONGTEXT NULL AFTER setting_key",
      updated_at: "ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER setting_value"
    }
  },
  users: {
    create: `
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'admin',
        scope_values VARCHAR(2000) NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_users_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      username: "ADD COLUMN username VARCHAR(100) NULL AFTER id",
      password: "ADD COLUMN password VARCHAR(255) NULL AFTER username",
      role: "ADD COLUMN role VARCHAR(20) NULL AFTER password",
      scope_values: "ADD COLUMN scope_values VARCHAR(2000) NULL AFTER role",
      active: "ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER scope_values",
      created_at: "ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER active"
    }
  }
};

const DEFAULT_SETTINGS = {
  reglamento: 'REGLAMENTO DEL GIMNASIO UES\n\n1. Presentarse con una identificacion valida.\n2. Usar el uniforme correspondiente.\n3. El uso del gimnasio es exclusivo para miembros registrados.\n4. Mantener limpio el area de trabajo.',
  horarios: 'HORARIOS DEL GIMNASIO UES\n\nLunes a Viernes: 6:00 AM - 8:00 PM\nSabado: 7:00 AM - 4:00 PM\nDomingo: Cerrado'
};

// Crea la base de datos si no existe (requiere conexion sin database)
async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();
}

// Verifica si una tabla existe en information_schema
async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [DB_NAME, tableName]
  );
  return rows[0].c > 0;
}

// Devuelve el conjunto de nombres de columnas de una tabla
async function getColumns(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ?`,
    [DB_NAME, tableName]
  );
  return new Set(rows.map((r) => r.name));
}

// Crea o completa las tablas/columnas minimas necesarias
async function initDatabase() {
  await ensureDatabase();
  const conn = await pool.getConnection();
  try {
    for (const [tableName, def] of Object.entries(TABLES)) {
      if (!(await tableExists(conn, tableName))) {
        await conn.query(def.create);
      } else {
        const existing = await getColumns(conn, tableName);
        for (const [colName, alterSql] of Object.entries(def.columns)) {
          if (!existing.has(colName)) {
            try {
              await conn.query(`ALTER TABLE \`${tableName}\` ${alterSql}`);
            } catch (err) {
              // Columna duplicada o definicion ya satisfecha: se ignora
              console.log(`[db] Columna ${tableName}.${colName} ya presente o no modificable`);
            }
          }
        }
      }
    }
    await migrateLegacySchemas(conn);
    await seedDefaults();
  } finally {
    conn.release();
  }
}

// Cuentas admin iniciales: un administrador del gimnasio, los dos turnos
// (matutino y vespertino) y el jefe de carrera. Todas con acceso a CRUD de
// alumnos; solo se crean si no existen.
const DEFAULT_USERS = [
  { username: 'super_admin', role: 'super_admin' },
  { username: 'admin', role: 'admin' },
  { username: 'matutino', role: 'admin_matutino' },
  { username: 'vespertino', role: 'admin_vespertino' },
  { username: 'jefecarrera', role: 'jefe_carrera' },
  { username: 'administradorgym', role: 'administrador_gym' }
];

// Inserta datos por defecto SOLO en una instalacion nueva (tabla users vacia).
// IMPORTANTE: si ya existen usuarios en la base de datos (esquema del sistema
// anterior), NO se crea ni se modifica ninguna cuenta: se conservan tal cual
// sus usuarios, correos y contrasenas.
// Las contrasenas se guardan en TEXTO PLANO ('admin123') a proposito: el admin
// necesita verlas directamente en MySQL. El login acepta tanto texto plano
// como bcrypt (compatibilidad con instalaciones previas).
async function seedDefaults() {
  try {
    const [countRows] = await pool.query('SELECT COUNT(*) AS c FROM users');
    const totalUsers = Number(countRows[0] && countRows[0].c !== undefined ? countRows[0].c : 0);
    if (totalUsers === 0) {
      for (const cuenta of DEFAULT_USERS) {
        await pool.query(
          'INSERT INTO users (username, password, role, active) VALUES (?, ?, ?, 1)',
          [cuenta.username, 'admin123', cuenta.role]
        );
        console.log(`[db] Usuario ${cuenta.username} creado (admin123 en texto plano, rol ${cuenta.role})`);
      }
    } else {
      console.log('[db] Usuarios ya existentes: se conservan las cuentas de la base de datos.');
    }
  } catch (err) {
    console.log('[db] Seed de admins omitido:', err.message);
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const [exists] = await pool.query(
      'SELECT COUNT(*) AS c FROM settings WHERE setting_key = ?',
      [key]
    );
    if (exists[0].c === 0) {
      await pool.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)',
        [key, value]
      );
    }
  }
}

// Migra esquemas legados (sistema anterior) hacia las columnas actuales:
//  - users:      username = email; passwords planos => bcrypt.
//  - students:   rellena student_code/full_name/second_name/last_name/type
//                desde student_number/name/apellido_paterno/apellido_materno/
//                lastname/member_type.
//  - attendance: rellena user_type desde el tipo heredado.
// Es idempotente: solo actua sobre filas cuyas columnas nuevas estan vacias.
async function migrateLegacySchemas(conn) {
  // ---- students: tipo de columnas conflictivas del esquema legacy ----
  // El sistema anterior usaba turn como ENUM('mañana','tarde','general') y
  // medical_certificate como tinyint(1). Se normalizan a VARCHAR para que el
  // registro de Gym UES (Matutino/Vespertino, 'Si'/'No'/URL) se guarde tal cual.
  try {
    const [turnMeta] = await conn.query("SHOW COLUMNS FROM students LIKE 'turn'");
    if (turnMeta.length > 0 && /enum/i.test(turnMeta[0].Type || '')) {
      await conn.query("ALTER TABLE students MODIFY turn VARCHAR(50) NOT NULL DEFAULT ''");
    }
    const [mcMeta] = await conn.query("SHOW COLUMNS FROM students LIKE 'medical_certificate'");
    if (mcMeta.length > 0 && /(tinyint|int)/i.test(mcMeta[0].Type || '')) {
      await conn.query("ALTER TABLE students MODIFY medical_certificate VARCHAR(255) NULL DEFAULT ''");
      await conn.query(
        "UPDATE students SET medical_certificate = CASE WHEN medical_certificate = '1' THEN 'Si' WHEN medical_certificate = '0' THEN 'No' ELSE medical_certificate END WHERE medical_certificate IN ('0','1')"
      );
    }
  } catch (err) {
    console.log('[db] Normalizacion de columnas de students omitida:', err.message);
  }

  // El sistema anterior imponia UNIQUE en student_number; la aplicacion usa
  // student_code como clave. Se descarta el constraint para que los nuevos
  // registros (con student_number vacio) no choquen entre si ni con migrados.
  try {
    await conn.query('ALTER TABLE students DROP INDEX student_number');
  } catch (err) {
    console.log('[db] Indice unique student_number ya sin efecto:', err.message);
  }

  // ---- students: elimina la columna de huella (ya no se usa) ----
  // Solo se borra si la columna existe; si no esta, se ignora sin error.
  try {
    const cols = await getColumns(conn, 'students');
    if (cols.has('fingerprint_template')) {
      await conn.query('ALTER TABLE students DROP COLUMN fingerprint_template');
      console.log('[db] Columna fingerprint_template eliminada de students');
    }
  } catch (err) {
    console.log('[db] Eliminacion de fingerprint_template omitida:', err.message);
  }

  // ---- users ----
  try {
    const cols = await getColumns(conn, 'users');
    // El esquema legacy definia role como ENUM(super_admin/maestro_mañana/
    // maestro_tarde). Se normaliza a VARCHAR para los roles de Gym UES.
    try {
      const [roleMeta] = await conn.query("SHOW COLUMNS FROM users LIKE 'role'");
      if (roleMeta.length > 0 && /enum/i.test(roleMeta[0].Type || '')) {
        await conn.query("ALTER TABLE users MODIFY role VARCHAR(50) NOT NULL DEFAULT 'admin'");
        console.log('[db] Role de users normalizado a VARCHAR');
      }
    } catch (err) {
      console.log('[db] Normalizacion de role omitida:', err.message);
    }
    // El email era UNIQUE y NOT NULL: impide crear usuarios sin correo.
    try {
      await conn.query('ALTER TABLE users DROP INDEX email');
    } catch (err) {
      console.log('[db] Indice unique email ya sin efecto:', err.message);
    }
    try {
      const [emailMeta] = await conn.query("SHOW COLUMNS FROM users LIKE 'email'");
      if (emailMeta.length > 0 && emailMeta[0].Null === 'NO') {
        await conn.query('ALTER TABLE users MODIFY email VARCHAR(100) NULL DEFAULT NULL');
      }
    } catch (err) {
      console.log('[db] Email de users normalizado o ya opcional:', err.message);
    }
    if (cols.has('email') && cols.has('username')) {
      await conn.query("UPDATE users SET username = email WHERE username IS NULL OR username = ''");
    }
    if (cols.has('name')) {
      await conn.query("UPDATE users SET name = CONCAT('Usuario ', id) WHERE name IS NULL OR name = ''");
    }
    // Las contrasenas se conservan TAL CUAL: si ya estan cifradas (bcrypt) o en
    // texto plano, el login acepta ambos formatos. No se re-cifran aqui para que
    // las contrasenas restablecidas desde el login sean visibles en MySQL.
  } catch (err) {
    console.log('[db] Migracion de users omitida:', err.message);
  }

  // ---- students ----
  try {
    const cols = await getColumns(conn, 'students');
    const partes = [];
    if (cols.has('student_number') && cols.has('student_code')) {
      partes.push(
        "student_code = COALESCE(NULLIF(TRIM(student_code), ''), NULLIF(TRIM(student_number), ''))"
      );
    }
    if (cols.has('name') && cols.has('full_name')) {
      partes.push("full_name = COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM(name), ''))");
    }
    if (cols.has('apellido_paterno') && cols.has('second_name')) {
      partes.push(
        "second_name = COALESCE(NULLIF(TRIM(second_name), ''), NULLIF(TRIM(apellido_paterno), ''))"
      );
    }
    if (cols.has('last_name') && cols.has('apellido_materno')) {
      if (cols.has('lastname')) {
        partes.push(
          "last_name = COALESCE(NULLIF(TRIM(last_name), ''), NULLIF(TRIM(apellido_materno), ''), NULLIF(TRIM(lastname), ''))"
        );
      } else {
        partes.push(
          "last_name = COALESCE(NULLIF(TRIM(last_name), ''), NULLIF(TRIM(apellido_materno), ''))"
        );
      }
    }
    if (cols.has('type')) {
      if (cols.has('member_type')) {
        partes.push(
          "type = COALESCE(NULLIF(TRIM(type), ''), CASE WHEN TRIM(member_type) = 'estudiante' THEN 'alumno' ELSE NULLIF(TRIM(member_type), '') END)"
        );
      } else {
        partes.push("type = COALESCE(NULLIF(TRIM(type), ''), 'alumno')");
      }
    }
    if (partes.length > 0) {
      await conn.query(
        `UPDATE students SET ${partes.join(', ')}
         WHERE (student_code IS NULL OR student_code = ''
                OR full_name IS NULL OR full_name = ''
                OR type IS NULL OR type = '')`
      );
    }
  } catch (err) {
    console.log('[db] Migracion de students omitida:', err.message);
  }

  // ---- attendance ----
  try {
    const cols = await getColumns(conn, 'attendance');
    if (cols.has('user_type') && cols.has('type')) {
      await conn.query(
        `UPDATE attendance SET user_type = COALESCE(NULLIF(TRIM(user_type), ''), NULLIF(TRIM(type), ''), 'alumno')
         WHERE user_type IS NULL OR user_type = ''`
      );
    }
  } catch (err) {
    console.log('[db] Migracion de attendance omitida:', err.message);
  }

  // ---- attendance legacy (sistema anterior en C#) ----
  // La tabla del sistema anterior usaba `type` ('entrada'/'salida') y `timestamp`
  // en lugar de check_in/check_out. Se migran los registros pendientes a la
  // estructura actual de la aplicacion (idempotente, solo filas vacias).
  try {
    const cols = await getColumns(conn, 'attendance');
    if (cols.has('timestamp') && cols.has('type')) {
      const [legacy] = await conn.query(
        `SELECT * FROM attendance WHERE timestamp IS NOT NULL AND timestamp <> ''`
      );
      for (const l of legacy) {
        const tipo = String(l.type || '').trim().toLowerCase();
        const stamp = String(l.timestamp || '').slice(0, 19);
        const dia = stamp.slice(0, 10);
        if ((tipo === 'entrada' || tipo === 'in') && (l.check_in === null || l.check_in === '')) {
          await conn.query('UPDATE attendance SET check_in = ? WHERE id = ?', [stamp, l.id]);
        } else if ((tipo === 'salida' || tipo === 'out') && (l.check_out === null || l.check_out === '')) {
          const [abierto] = await conn.query(
            `SELECT id FROM attendance
             WHERE student_code = ? AND DATE(check_in) = ? AND check_out IS NULL AND id <> ?
             ORDER BY check_in ASC LIMIT 1`,
            [l.student_code, dia, l.id]
          );
          if (abierto.length > 0) {
            await conn.query('UPDATE attendance SET check_out = ? WHERE id = ?', [
              stamp,
              abierto[0].id
            ]);
          } else {
            await conn.query(
              'INSERT INTO attendance (student_code, full_name, user_type, check_out) VALUES (?, ?, ?, ?)',
              [l.student_code, l.full_name || '', l.user_type || 'alumno', stamp]
            );
          }
        }
      }
    }
  } catch (err) {
    console.log('[db] Migracion de attendance legacy omitida:', err.message);
  }
}

module.exports = { pool, initDatabase }; 
module.exports.DB_NAME = DB_NAME;