-- =====================================================
-- Sistema Gym UES - Referencia del esquema existente
-- IMPORTANTE: Las tablas YA existen en la base de datos
-- 'gym_ues_db'. Este archivo NO crea, NO borra ni altera
-- ninguna tabla (evita tablas duplicadas).
-- Ejecutar solo las sentencias de SEMILLAS opcionales que
-- necesites; son inofensivas (no duplican registros).
-- =====================================================

USE gym_ues_db;

-- -----------------------------------------------------
-- Esquema vigente (solo referencia, ya aplicado):
--   users       (id, name, email UNI, password, role
--                ENUM('super_admin','maestro_mañana','maestro_tarde'),
--                turn ENUM('mañana','tarde','general') DEFAULT 'general',
--                created_at)
--   students    (id, student_number UNI, name,
--                apellido_paterno VARCHAR(100) NOT NULL,
--                apellido_materno VARCHAR(100) NULL,
--                lastname (columna legacy para reportes),
--                member_type ENUM('estudiante','mto','externo') DEFAULT 'estudiante',
--                gender ENUM('Masculino','Femenino','Otro'),
--                turn ENUM('mañana','tarde','general'),
--                career VARCHAR(150) NULL,
--                image_url VARCHAR(255), certificate_file VARCHAR(255),
--                medical_certificate TINYINT(1), created_at)
--   attendance  (id, user_id NULL, student_id NULL, type
--                ENUM('entrada','salida'), timestamp)
--   settings    (id, setting_key UNI, setting_value, updated_at)
--                keys: reglamento_pdf | horario_pdf | reglamento_text | horario(JSON)
-- -----------------------------------------------------

-- -----------------------------------------------------
-- MIGRACIONES YA APLICADAS (solo referencia, NO volver a ejecutar):
-- ALTER TABLE students
--   ADD COLUMN apellido_paterno VARCHAR(100) NOT NULL DEFAULT '' AFTER name,
--   ADD COLUMN apellido_materno VARCHAR(100) DEFAULT NULL AFTER apellido_paterno,
--   ADD COLUMN certificate_file VARCHAR(255) DEFAULT NULL AFTER image_url;
-- ALTER TABLE students ADD COLUMN career VARCHAR(150) DEFAULT NULL AFTER turn;
-- UPDATE students SET apellido_paterno = SUBSTRING_INDEX(lastname,' ',1), ...;
-- -------
-- Las siguientes se aplican automáticamente al iniciar el backend:
-- ALTER TABLE students ADD COLUMN member_type ENUM('estudiante','mto','externo')
--   NOT NULL DEFAULT 'estudiante' AFTER lastname;
-- ALTER TABLE students MODIFY COLUMN turn ENUM('mañana','tarde','general') NOT NULL DEFAULT 'mañana';
-- CREATE TABLE IF NOT EXISTS settings (...);
-- -----------------------------------------------------

-- -----------------------------------------------------
-- SEMILLAS OPCIONALES (idempotentes, no duplican datos)
-- -----------------------------------------------------

-- 2 super administradores + instructores de ambos turnos
INSERT INTO users (name, email, password, role, turn)
SELECT * FROM (
  SELECT 'Super Admin UES', 'admin@gymues.com', 'admin123', 'super_admin', 'general'
  UNION ALL SELECT 'Super Admin 2', 'super@gymues.com', 'super123', 'super_admin', 'general'
  UNION ALL SELECT 'Maestro Turno Mañana', 'manana@gymues.com', 'manana123', 'maestro_mañana', 'mañana'
  UNION ALL SELECT 'Maestra Turno Tarde', 'tarde@gymues.com', 'tarde123', 'maestro_tarde', 'tarde'
) t
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = t.email);

-- Alumnos de ejemplo (columnas nuevas de apellidos)
INSERT INTO students
  (student_number, name, apellido_paterno, apellido_materno, lastname, gender, turn, medical_certificate)
SELECT * FROM (
  SELECT 'UES-0001', 'María', 'López', 'Portillo', 'López Portillo', 'Femenino', 'mañana', 1
  UNION ALL SELECT 'UES-0002', 'Carlos', 'Ramírez', 'Funes', 'Ramírez Funes', 'Masculino', 'mañana', 0
  UNION ALL SELECT 'UES-0003', 'José', 'Hernández', 'Cruz', 'Hernández Cruz', 'Masculino', 'mañana', 1
  UNION ALL SELECT 'UES-0004', 'Ana', 'Martínez', 'Dávila', 'Martínez Dávila', 'Femenino', 'mañana', 0
  UNION ALL SELECT 'UES-0005', 'Pedro', 'García', 'Mejía', 'García Mejía', 'Masculino', 'tarde', 1
  UNION ALL SELECT 'UES-0006', 'Lucía', 'Pérez', 'Aguilar', 'Pérez Aguilar', 'Femenino', 'tarde', 1
  UNION ALL SELECT 'UES-0007', 'Diego', 'Molina', 'Serrano', 'Molina Serrano', 'Masculino', 'tarde', 0
  UNION ALL SELECT 'UES-0008', 'Rosa', 'Castro', 'Villeda', 'Castro Villeda', 'Femenino', 'tarde', 1
) t
WHERE NOT EXISTS (SELECT 1 FROM students WHERE student_number = t.student_number);