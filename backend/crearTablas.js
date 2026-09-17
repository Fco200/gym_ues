const pool = require('./src/config/db');

async function crear() {
  try {
    console.log('Creando tablas en Aiven...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'maestro_mañana', 'maestro_tarde') NOT NULL,
        turn ENUM('mañana', 'tarde', 'general') DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_number VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        lastname VARCHAR(100) NOT NULL,
        gender ENUM('Masculino', 'Femenino', 'Otro') NOT NULL,
        turn ENUM('mañana', 'tarde') NOT NULL,
        image_url TEXT DEFAULT NULL,
        medical_certificate BOOLEAN DEFAULT FALSE,
        fingerprint_template MEDIUMTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        student_id INT DEFAULT NULL,
        type ENUM('entrada', 'salida') NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      INSERT INTO users (name, email, password, role, turn) 
      VALUES ('Super Admin UES', 'admin@gymues.com', '123456', 'super_admin', 'general')
      ON DUPLICATE KEY UPDATE name = name;
    `);

    console.log('✅ ¡Tablas creadas y usuario admin listo!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al crear tablas:', err);
    process.exit(1);
  }
}

crear();