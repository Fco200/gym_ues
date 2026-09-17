const pool = require('../config/db');

// Tipos de integrante del gimnasio (con o sin expediente tipo "alumno")
const MEMBER_TYPES = ['estudiante', 'mto', 'externo'];

// Normaliza el género a los valores válidos de la base de datos
const GENDERS = ['Masculino', 'Femenino', 'Otro'];
function normalizeGender(value) {
  if (!value) return null;
  const match = GENDERS.find((g) => g.toLowerCase() === String(value).toLowerCase());
  return match || value;
}

function normalizeMemberType(value) {
  if (!value) return 'estudiante';
  const match = MEMBER_TYPES.find((m) => m.toLowerCase() === String(value).toLowerCase());
  return match || 'estudiante';
}

// Genera una clave de acceso única para el checador (personas externas)
function generateExternalKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `EXT-${suffix}`;
}

// Separa un nombre completo en nombre / apellido paterno / apellido materno
function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (parts.length === 1) return { name: parts[0], paterno: null, materno: null };
  if (parts.length === 2) return { name: parts[0], paterno: parts[1], materno: null };
  return {
    name: parts[0],
    paterno: parts[parts.length - 2],
    materno: parts[parts.length - 1]
  };
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

// Registrar un nuevo integrante (estudiante, MTO o persona externa)
// Archivos multipart opcionales: 'image' (foto) y 'certificate' (certificado médico)
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
    medical_certificate,
    member_type,
    fingerprint_template
  } = req.body;

  try {
    const type = normalizeMemberType(member_type);
    const legacy = splitLegacy(lastname);
    let paterno = apellido_paterno || legacy.paterno;
    let materno = apellido_materno !== undefined ? apellido_materno : legacy.materno;

    // MTO y externos registran su nombre completo (se separa en apellidos)
    let finalName = name ? name.trim() : '';
    if (type !== 'estudiante') {
      if (paterno && !materno) materno = null;
      if (!paterno) {
        const split = splitFullName(finalName);
        finalName = split.name;
        paterno = split.paterno;
        materno = split.materno;
      }
    }

    // Clave para el checador: número de empleado (MTO) o clave generada (externo)
    let finalNumber = student_number ? String(student_number).trim() : '';
    if (type === 'externo' && !finalNumber) {
      finalNumber = generateExternalKey();
      // Asegurar unicidad de la clave generada
      for (let guard = 0; guard < 20; guard += 1) {
        const [dup] = await pool.query('SELECT id FROM students WHERE student_number = ?', [finalNumber]);
        if (dup.length === 0) break;
        finalNumber = generateExternalKey();
      }
    }

    // Validaciones según el tipo
    if (!finalName || !paterno) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios (nombre y apellido paterno)'
      });
    }
    if (!finalNumber) {
      return res.status(400).json({
        error: 'Falta la clave de acceso para el checador'
      });
    }
    if (type === 'estudiante') {
      if (!gender || !turn) {
        return res.status(400).json({
          error: 'Faltan datos obligatorios del alumno (sexo, expediente y turno)'
        });
      }
    } else if (type === 'mto' && !String(student_number).trim()) {
      return res.status(400).json({
        error: 'Ingresa el número de empleado del MTO (será su clave para el checador)'
      });
    }

    // Evitar claves/expedientes duplicados
    const [exist] = await pool.query('SELECT id FROM students WHERE student_number = ?', [finalNumber]);
    if (exist.length > 0) {
      return res.status(409).json({
        error: 'Ese número de expediente / clave de acceso ya está registrado'
      });
    }

    const image_url = resolveFile(req, 'image') || req.body.image_url || null;
    const certificate_file = resolveFile(req, 'certificate') || req.body.certificate_file || null;
    const finalTurn = type === 'estudiante' ? turn : 'general';
    const finalGender = type === 'estudiante' ? normalizeGender(gender) : normalizeGender(gender) || 'Otro';
    const fingerprint = fingerprint_template ? String(fingerprint_template).trim() : null;

    const [result] = await pool.query(
      `INSERT INTO students
         (student_number, name, apellido_paterno, apellido_materno, lastname,
          gender, turn, career, image_url, certificate_file, medical_certificate, member_type,
          fingerprint_template)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalNumber,
        finalName,
        paterno,
        materno || null,
        buildLastname(paterno, materno),
        finalGender,
        finalTurn,
        career || null,
        image_url,
        certificate_file,
        medical_certificate ? 1 : 0,
        type,
        fingerprint
      ]
    );

    const typeLabel = type === 'estudiante' ? 'Alumno' : type === 'mto' ? 'MTO' : 'Persona externa';
    res.status(201).json({
      message: `¡${typeLabel} creado con éxito!`,
      studentId: result.insertId,
      student_number: finalNumber,
      member_type: type
    });
  } catch (error) {
    console.error('Error al registrar integrante:', error);
    res.status(500).json({ error: 'Error interno al registrar el integrante' });
  }
};

// Ver lista de integrantes (por turno, tipo y/o búsqueda)
const getStudents = async (req, res) => {
  const { turn, q, member_type } = req.query;

  try {
    let query = 'SELECT * FROM students';
    let params = [];
    const conditions = [];

    if (turn) {
      conditions.push('turn = ?');
      params.push(turn);
    }

    if (member_type) {
      if (String(member_type).toLowerCase() === 'access') {
        conditions.push("member_type IN ('mto','externo')");
      } else {
        conditions.push('member_type = ?');
        params.push(normalizeMemberType(member_type));
      }
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
    console.error('Error al obtener integrantes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Lista de integrantes con huella registrada, para la verificación biométrica 1:N
// (utilizada por el Checador para identificar el expediente a partir de la huella)
const getBiometrics = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, student_number, name, apellido_paterno, apellido_materno, lastname,
              gender, turn, image_url, fingerprint_template
       FROM students
       WHERE fingerprint_template IS NOT NULL AND TRIM(fingerprint_template) <> ''
       ORDER BY name ASC, apellido_paterno ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener huellas registradas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar datos del expediente completo de un alumno o integrante
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
    medical_certificate,
    member_type
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
        return res.status(409).json({ error: 'Ese número de expediente ya está registrado' });
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
         medical_certificate = COALESCE(?, medical_certificate),
         member_type = COALESCE(?, member_type)
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
        member_type ? normalizeMemberType(member_type) : null,
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
  getBiometrics,
  updateStudent,
  updateMedicalCertificate,
  deleteStudent
};