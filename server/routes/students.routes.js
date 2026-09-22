/**
 * Gym UES - CRUD de estudiantes (alumnos, maestros y personas exteriores).
 * - Alumno/Maestro: el codigo lo ingresa el usuario (expediente / clave empleado).
 * - Exterior: se genera una clave aleatoria tipo GYM-XXXXXX (unica).
 *
 * SEGURIDAD: todas las rutas exigen sesion (requireAuth) y se filtra/valida el
 * alcance del rol (server/scope.js): turno para admin_matutino/admin_vespertino,
 * carreras para jefe_carrera. Los INSERT/UPDATE pasan por db-map.js.
 */
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware');
const { prepararInsert, prepararUpdate } = require('../db-map');
const { alcanceUsuario, dondeAlcanceSQL } = require('../scope');
const { generarClaveUnica } = require('../keygen');

const router = express.Router();

const VALID_TYPES = ['alumno', 'maestro', 'exterior'];

// GET /api/students - listado dentro del alcance, con busqueda opcional (?q=)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const q = String(req.query.q || '').trim().slice(0, 100);
    let rows;
    if (q) {
      [rows] = await pool.query(
        `SELECT s.* FROM students s
         WHERE ${whereSql}
           AND (s.student_code LIKE ? OR s.full_name LIKE ?
                OR s.second_name LIKE ? OR s.last_name LIKE ?)
         ORDER BY s.created_at DESC`,
        [...params, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]
      );
    } else {
      [rows] = await pool.query(
        `SELECT s.* FROM students s WHERE ${whereSql} ORDER BY s.created_at DESC`,
        params
      );
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/students/:code - detalle por codigo (dentro del alcance)
router.get('/:code', requireAuth, async (req, res, next) => {
  try {
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const [rows] = await pool.query(
      `SELECT s.* FROM students s WHERE s.student_code = ? AND ${whereSql} LIMIT 1`,
      [req.params.code, ...params]
    );
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Estudiante no encontrado.' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/students - registrar alumno / maestro / exterior (requiere sesion)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    if (alcance.tipo === 'ninguno') {
      return res.status(403).json({ mensaje: 'No tiene permisos para registrar alumnos.' });
    }
    const body = { ...(req.body || {}) };
    const type = String(body.type || 'alumno').trim().toLowerCase() || 'alumno';
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ mensaje: 'Tipo de persona invalido.' });
    }

    // admin_matutino / admin_vespertino: solo pueden registrar de su turno.
    // Personas exteriores y maestros pueden registrarse con cualquier turno.
    if (alcance.tipo === 'turno' && type !== 'exterior') {
      if (body.turn && String(body.turn).trim() && String(body.turn).trim() !== alcance.turno) {
        return res.status(403).json({ mensaje: `Solo puede registrar alumnos del turno ${alcance.turno}.` });
      }
      body.turn = alcance.turno;
    }

    // jefe_carrera: la restriccion de carreras aplica solo a alumnos.
    if (alcance.tipo === 'carreras' && type === 'alumno') {
      const career = String(body.career || '').trim();
      const permitidas = (alcance.carreras || []).map((c) => c.toLowerCase());
      if (!career || !permitidas.includes(career.toLowerCase())) {
        return res.status(403).json({ mensaje: 'Solo puede registrar alumnos de sus carreras asignadas.' });
      }
    }

    const nombre = String(body.full_name || '').trim();
    const segundo = String(body.second_name || '').trim();
    const apellido = String(body.last_name || '').trim();
    if (!nombre || !segundo || !apellido) {
      return res.status(400).json({ mensaje: 'Nombre y apellidos son obligatorios.' });
    }

    let studentCode = String(body.student_code || '').trim().slice(0, 50);
    if (type === 'exterior' || !studentCode) {
      studentCode = await generarClaveUnica();
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

// PUT /api/students/:code - actualizar (requiere sesion y permiso sobre el alumno)
router.put('/:code', requireAuth, async (req, res, next) => {
  try {
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const [existing] = await pool.query(
      `SELECT s.* FROM students s WHERE s.student_code = ? AND ${whereSql} LIMIT 1`,
      [req.params.code, ...params]
    );
    if (existing.length === 0) {
      return res.status(404).json({ mensaje: 'Estudiante no encontrado.' });
    }

    const body = { ...(req.body || {}) };
    const tipoActual = String(existing[0].type || 'alumno');
    if (alcance.tipo === 'turno' && tipoActual !== 'exterior') {
      if (body.turn && String(body.turn).trim() && String(body.turn).trim() !== alcance.turno) {
        return res.status(403).json({ mensaje: `Solo puede editar alumnos del turno ${alcance.turno}.` });
      }
      body.turn = alcance.turno;
    }
    if (alcance.tipo === 'carreras' && tipoActual === 'alumno' && body.career !== undefined) {
      const career = String(body.career || '').trim();
      const permitidas = (alcance.carreras || []).map((c) => c.toLowerCase());
      if (!career || !permitidas.includes(career.toLowerCase())) {
        return res.status(403).json({ mensaje: 'Solo puede asignar carreras de su lista autorizada.' });
      }
    }

    const { asignaciones, valores, errores } = prepararUpdate('students', body);
    if (errores.length > 0) {
      return res.status(400).json({ mensaje: 'Datos invalidos: ' + errores.join('; ') });
    }
    if (asignaciones.length === 0) {
      return res.status(400).json({ mensaje: 'No hay campos para actualizar.' });
    }

    const [result] = await pool.query(
      `UPDATE students SET ${asignaciones.join(', ')} WHERE student_code = ?`,
      [...valores, req.params.code]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Estudiante no encontrado.' });
    }
    const [updated] = await pool.query('SELECT * FROM students WHERE student_code = ? LIMIT 1', [
      req.params.code
    ]);
    res.json({ mensaje: 'Registro actualizado.', estudiante: updated[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/students/:code - solo alumnos dentro del alcance
router.delete('/:code', requireAuth, async (req, res, next) => {
  try {
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const [rows] = await pool.query(
      `SELECT s.id FROM students s WHERE s.student_code = ? AND ${whereSql} LIMIT 1`,
      [req.params.code, ...params]
    );
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Estudiante no encontrado.' });
    }
    const [result] = await pool.query('DELETE FROM students WHERE student_code = ?', [
      req.params.code
    ]);
    res.json({ mensaje: 'Registro eliminado.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.VALID_TYPES = VALID_TYPES;