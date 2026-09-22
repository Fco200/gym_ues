/**
 * Gym UES - Rutas PUBLICAS del kiosco (no requieren sesion).
 * - GET /api/public/member/:code   : tarjeta del miembro + ultimas asistencias.
 * - GET /api/public/count-today    : conteo de asistencias del dia (kiosco).
 * Solo se exponen campos de visualizacion (nunca datos sensibles de usuarios).
 * Todas las consultas usan placeholders ? (parametrizadas).
 */
const express = require('express');
const { pool } = require('../db');
const { prepararInsert } = require('../db-map');
const { generarClaveUnica } = require('../keygen');

const router = express.Router();

function pad(n) {
  return String(n).padStart(2, '0');
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Auto-registro del kiosco: limite anti-spam por IP (60 registros / hora).
const VALID_TYPES = ['alumno', 'maestro', 'exterior'];
const LIMITE_REGISTRO_HORA = 60;
const registrosPorIp = new Map();

function comprobarLimiteIp(ip) {
  const ahora = Date.now();
  const entrada = registrosPorIp.get(ip);
  if (!entrada || ahora - entrada.hora >= 3600000) {
    registrosPorIp.set(ip, { hora: ahora, n: 1 });
    return true;
  }
  if (entrada.n >= LIMITE_REGISTRO_HORA) return false;
  entrada.n += 1;
  return true;
}

// GET /api/public/member/:code - informacion publica de un miembro registrado
// y sus 5 ultimas asistencias. Permite al kiosco "consultar mi asistencia".
router.get('/member/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().slice(0, 50);
    if (!code) {
      return res.status(400).json({ mensaje: 'Ingrese la clave del usuario.' });
    }
    const [rows] = await pool.query(
      'SELECT * FROM students WHERE student_code = ? LIMIT 1',
      [code]
    );
    if (rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Clave no encontrada. Verifique que este registrado en el gimnasio.'
      });
    }
    const s = rows[0];
    const estudiante = {
      student_code: s.student_code,
      full_name: `${s.full_name} ${s.second_name} ${s.last_name}`.trim(),
      type: s.type,
      gender: s.gender,
      turn: s.turn,
      career: s.career,
      image_url: s.image_url,
      certificadoVigente: String(s.medical_certificate || '') === 'Si'
    };
    const [registros] = await pool.query(
      `SELECT id, check_in, check_out
       FROM attendance
       WHERE student_code = ?
       ORDER BY COALESCE(check_in, created_at) DESC
       LIMIT 5`,
      [code]
    );
    res.json({ estudiante, registros });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/count-today - conteos del dia para el checador (sin sesion)
router.get('/count-today', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(check_in IS NOT NULL) AS entradas,
         SUM(check_out IS NOT NULL) AS salidas
       FROM attendance
       WHERE DATE(COALESCE(check_in, created_at)) = ?`,
      [hoy()]
    );
    res.json({
      total: rows[0].total || 0,
      entradas: rows[0].entradas || 0,
      salidas: rows[0].salidas || 0
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/public/registro - auto-registro abierto del checador para alumnos,
// maestros y personas exteriores (sin sesion). Los 3 tipos se guardan en la
// tabla students. Para exteriores la clave GYM-XXXXXX se genera sola.
// Limitado por IP para evitar spam (60 registros / hora).
router.post('/registro', async (req, res, next) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'desconocida';
    if (!comprobarLimiteIp(ip)) {
      return res.status(429).json({
        mensaje: 'Se alcanzo el limite de auto-registros desde este dispositivo. Intente mas tarde.'
      });
    }

    const body = { ...(req.body || {}) };
    const type = String(body.type || 'alumno').trim().toLowerCase() || 'alumno';
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ mensaje: 'Tipo de persona invalido.' });
    }

    const nombre = String(body.full_name || '').trim();
    const segundo = String(body.second_name || '').trim();
    const apellido = String(body.last_name || '').trim();
    if (!nombre || !segundo || !apellido) {
      return res.status(400).json({ mensaje: 'Nombre y apellidos son obligatorios.' });
    }

    // Alumno/Maestro: se exige el expediente / clave de empleado que digito el
    // usuario. Exterior: la clave GYM-XXXXXX se genera automaticamente.
    let studentCode = String(body.student_code || '').trim().slice(0, 50);
    if (!studentCode) {
      if (type === 'exterior') {
        studentCode = await generarClaveUnica();
      } else {
        return res.status(400).json({
          mensaje: type === 'alumno' ? 'Ingrese el expediente del alumno.' : 'Ingrese la clave de empleado del maestro.'
        });
      }
    } else {
      const [dup] = await pool.query('SELECT id FROM students WHERE student_code = ? LIMIT 1', [
        studentCode
      ]);
      if (dup.length > 0) {
        return res.status(409).json({ mensaje: `La clave ${studentCode} ya esta registrada.` });
      }
    }

    const { columnas, valores, errores } = prepararInsert('students', {
      ...body,
      student_code: studentCode
    });
    if (errores.length > 0) {
      return res.status(400).json({ mensaje: 'Datos invalidos: ' + errores.join('; ') });
    }

    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO students (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
        valores
      );
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ mensaje: `La clave ${studentCode} ya esta registrada.` });
      }
      throw err;
    }

    const [created] = await pool.query('SELECT * FROM students WHERE id = ? LIMIT 1', [
      result.insertId
    ]);
    res.status(201).json({ mensaje: 'Registro creado correctamente.', estudiante: created[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;