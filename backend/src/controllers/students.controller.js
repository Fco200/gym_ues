const pool = require('../config/db');

// Normaliza el género a los valores válidos de la base de datos
const GENDERS = ['Masculino', 'Femenino', 'Otro'];
function normalizeGender(value) {
  if (!value) return null;
  const match = GENDERS.find((g) => g.toLowerCase() === String(value).toLowerCase());
  return match || value;
}

// Devuelve la ruta pública del archivo (foto o certificado) subido
function resolveFile(req, field) {
  if (req.files && req.files[field] && req.files[field][0]) {
    return `/uploads/${req.files[field][0].filename}`;
  }
  return null;
}

// Compone el apellido completo para la columna legacy 'lastname' (la usan los reportes)
function buildLastname(paterno, materno) {
  return [paterno, materno].filter(Boolean).join(' ').trim() || null;
}

// Supera la compatibilidad: si llegan solo 'name'/'lastname' los separa en apellidos
function splitLegacy(lastname) {
  if (!lastname) return { paterno: null, materno: null };
  const parts = String(lastname).trim().split(/\s+/);
  return { paterno: parts[0] || null, materno: parts.slice(1).join(' ') || null };
}

// Registrar un nuevo alumno (enviar archivos: 'image' y 'certificate' opcionales en multipart)
const createStudent = async (req, res) => {
  const {
    student_number,
    name,
    apellido_paterno,
    apellido_materno,
    lastname,
    gender,
    turn,
    career,
    medical_certificate
  } = req.body;

  try {
    const legacy = splitLegacy(lastname);
    const paterno = apellido_paterno || legacy.paterno;
    const materno = apellido_materno !== undefined ? apellido_materno : legacy.materno;

    if (!student_number || !name || !paterno || !gender || !turn) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios del alumno (nombre, apellido paterno, sexo, expediente y turno)'
      });
    }

    // Evitar expedientes duplicados
    const [exist] = await pool.query('SELECT id FROM students WHERE student_number = ?', [
      student_number.trim()
    ]);
    if (exist.length > 0) {
      return res.status(400).json({ error: 'Ese número de expediente ya está registrado' });
    }

    const image_url = resolveFile(req, 'image') || req.body.image_url || null;
    const certificate_file = resolveFile(req, 'certificate') || req.body.certificate_file || null;

    const [result] = await pool.query(
      `INSERT INTO students
         (student_number, name, apellido_paterno, apellido_materno, lastname,
          gender, turn, career, image_url, certificate_file, medical_certificate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student_number.trim(),
        name,
        paterno,
        materno || null,
        buildLastname(paterno, materno),
        normalizeGender(gender),
        turn,
        career || null,
        image_url,
        certificate_file,
        medical_certificate ? 1 : 0
      ]
    );

    res.status(201).json({
      message: '¡Alumno creado con éxito!',
      studentId: result.insertId
    });
  } catch (error) {
    console.error('Error al registrar alumno:', error);
    res.status(500).json({ error: 'Error interno al registrar el alumno' });
  }
};

// Ver lista de alumnos (por turno y/o búsqueda por expediente, nombre o apellidos)
const getStudents = async (req, res) => {
  const { turn, q } = req.query;

  try {
    let query = 'SELECT * FROM students';
    let params = [];
    const conditions = [];

    if (turn) {
      conditions.push('turn = ?');
      params.push(turn);
    }

    if (q && String(q).trim()) {
      const like = `%${String(q).trim()}%`;
      conditions.push(
        '(student_number LIKE ? OR name LIKE ? OR apellido_paterno LIKE ? OR apellido_materno LIKE ? OR lastname LIKE ?)'
      );
      params.push(like, like, like, like, like);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY turn ASC, apellido_paterno ASC, name ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener alumnos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar datos del expediente completo de un alumno
const updateStudent = async (req, res) => {
  const { id } = req.params;
  const {
    student_number,
    name,
    apellido_paterno,
    apellido_materno,
    lastname,
    gender,
    turn,
    career,
    medical_certificate
  } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }

    const current = rows[0];
    const newNumber = student_number ? student_number.trim() : null;

    if (newNumber) {
      const [dup] = await pool.query('SELECT id FROM students WHERE student_number = ? AND id <> ?', [
        newNumber,
        id
      ]);
      if (dup.length > 0) {
        return res.status(400).json({ error: 'Ese número de expediente ya está registrado' });
      }
    }

    const legacy = splitLegacy(lastname);
    const paterno = apellido_paterno || legacy.paterno;
    const materno = apellido_materno !== undefined ? apellido_materno : legacy.materno;

    const newImage = resolveFile(req, 'image');
    const newCertificate = resolveFile(req, 'certificate');

    await pool.query(
      `UPDATE students SET
         student_number = COALESCE(?, student_number),
         name = COALESCE(?, name),
         apellido_paterno = COALESCE(?, apellido_paterno),
         apellido_materno = COALESCE(?, apellido_materno),
         lastname = COALESCE(?, lastname),
         gender = COALESCE(?, gender),
         turn = COALESCE(?, turn),
         career = COALESCE(?, career),
         image_url = COALESCE(?, image_url),
         certificate_file = COALESCE(?, certificate_file),
         medical_certificate = COALESCE(?, medical_certificate)
       WHERE id = ?`,
      [
        newNumber || null,
        name || null,
        paterno || null,
        materno !== null && materno !== undefined ? materno : null,
        paterno || materno ? buildLastname(paterno || current.apellido_paterno, materno || current.apellido_materno) : null,
        gender ? normalizeGender(gender) : null,
        turn || null,
        career || null,
        newImage || null,
        newCertificate || null,
        medical_certificate === undefined ? null : medical_certificate ? 1 : 0,
        id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
    res.json({ message: 'Expediente actualizado correctamente.', student: updated[0] });
  } catch (error) {
    console.error('Error al actualizar alumno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Subir/actualizar el estatus del certificado médico de un alumno
const updateMedicalCertificate = async (req, res) => {
  const { id } = req.params;
  const { medical_certificate } = req.body;

  try {
    if (typeof medical_certificate !== 'boolean') {
      return res.status(400).json({ error: 'El estatus del certificado debe ser un valor booleano' });
    }

    const [result] = await pool.query('UPDATE students SET medical_certificate = ? WHERE id = ?', [
      medical_certificate ? 1 : 0,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }

    const [updated] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);

    res.json({
      message: medical_certificate
        ? 'Certificado médico marcado como vigente.'
        : 'Certificado médico marcado como no vigente.',
      student: updated[0]
    });
  } catch (error) {
    console.error('Error al actualizar certificado médico:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar un alumno del registro
const deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM students WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }

    res.json({ message: 'Alumno eliminado del registro correctamente.' });
  } catch (error) {
    console.error('Error al eliminar alumno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  createStudent,
  getStudents,
  updateStudent,
  updateMedicalCertificate,
  deleteStudent
};