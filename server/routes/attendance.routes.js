/**
 * Gym UES - Rutas de asistencia: check-in, check-out, registros y conteos.
 * Check-in/check-out son PUBLICOS (kiosco) y quedan SOLO por student_code con
 * method 'manual'. Las consultas (today/count/range) exigen sesion y se filtran
 * por el alcance del rol (server/scope.js).
 *
 * SEGURIDAD: todas las consultas usan placeholders ? (parametrizados).
 * Horas y fechas calculadas en hora local del servidor (no UTC).
 */
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware');
const { alcanceUsuario, dondeAlcanceSQL } = require('../scope');

const router = express.Router();

// Hora local en formato YYYY-MM-DD HH:MM:SS (no UTC)
function pad(n) {
  return String(n).padStart(2, '0');
}

function ahora() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// POST /api/attendance/check-in  { student_code }
router.post('/check-in', async (req, res, next) => {
  try {
    const body = req.body || {};
    const code = String(body.student_code || '').trim();
    if (!code) {
      return res.status(400).json({ mensaje: 'Ingrese la clave del alumno.' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM students WHERE student_code = ? LIMIT 1',
      [code]
    );
    const estudiante = rows[0] || null;
    // Solo se registra asistencia a personas YA registradas en el sistema.
    if (!estudiante) {
      return res.status(400).json({
        mensaje: 'Clave no registrada. Registre al alumno/maestro/exterior en Gestion de Alumnos o en Registro primero.'
      });
    }

    // Unica regla anti-spam: esperar 1 minuto entre marcadas de ENTRADA.
    // Excepcion: si la ultima marcada del dia ya tiene SALIDA registrada,
    // se permite un nuevo check-in inmediatamente (sin esperar el minuto).
    const [ultimo] = await pool.query(
      `SELECT check_in, check_out FROM attendance
       WHERE student_code = ?
       ORDER BY COALESCE(check_in, created_at) DESC LIMIT 1`,
      [code]
    );
    if (ultimo.length > 0 && ultimo[0].check_in && !ultimo[0].check_out) {
      const prev = new Date(ultimo[0].check_in).getTime();
      const faltan = 60000 - (Date.now() - prev);
      if (faltan > 0) {
        const seg = Math.ceil(faltan / 1000);
        return res.json({
          yaRegistrado: true,
          codigo: code,
          mensaje: `Espere ${seg} s para registrar otra entrada (ya marco entrada a las ${ultimo[0].check_in}).`
        });
      }
    }

    const fullName = estudiante
      ? `${estudiante.full_name} ${estudiante.second_name} ${estudiante.last_name}`.trim()
      : '';
    await pool.query(
      'INSERT INTO attendance (student_code, full_name, user_type, check_in) VALUES (?, ?, ?, ?)',
      [code, fullName, estudiante ? estudiante.type : 'exterior', ahora()]
    );

    res.status(201).json({
      mensaje: `Entrada registrada a las ${new Date().toLocaleTimeString('es-SV')} para ${fullName || code}.`,
      nombre: fullName,
      codigo: code
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/attendance/check-out  { student_code }
router.post('/check-out', async (req, res, next) => {
  try {
    const body = req.body || {};
    const code = String(body.student_code || '').trim();
    if (!code) {
      return res.status(400).json({ mensaje: 'Ingrese la clave del alumno.' });
    }

    const [open] = await pool.query(
      `SELECT * FROM attendance
       WHERE student_code = ? AND DATE(check_in) = ? AND check_out IS NULL
       LIMIT 1`,
      [code, hoy()]
    );
    if (open.length > 0) {
      await pool.query('UPDATE attendance SET check_out = ? WHERE id = ?', [ahora(), open[0].id]);
      return res.json({
        mensaje: `Salida registrada a las ${new Date().toLocaleTimeString('es-SV')} para ${open[0].full_name || code}.`,
        nombre: open[0].full_name,
        codigo: code
      });
    }

    // Salida sin entrada abierta (salida opcional): se registra igual para que
    // la Salida del checador siempre funcione. Al no haber entrada previa, la
    // entrada se deja como NULL (fila valida para el historial).
    const [rows] = await pool.query(
      'SELECT * FROM students WHERE student_code = ? LIMIT 1',
      [code]
    );
    const estudiante = rows[0] || null;
    if (!estudiante) {
      return res.status(400).json({
        mensaje: 'Clave no registrada. Registre al alumno/maestro/exterior en Gestion de Alumnos o en Registro primero.'
      });
    }
    const fullName = `${estudiante.full_name} ${estudiante.second_name} ${estudiante.last_name}`.trim() || code;
    await pool.query(
      'INSERT INTO attendance (student_code, full_name, user_type, check_in, check_out) VALUES (?, ?, ?, NULL, ?)',
      [code, fullName || code, estudiante ? estudiante.type : 'exterior', ahora()]
    );
    res.json({
      mensaje: `Salida registrada a las ${new Date().toLocaleTimeString('es-SV')} para ${fullName || code} (sin entrada abierta).`,
      nombre: fullName || code,
      codigo: code
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/today - registros de hoy (dentro del alcance)
router.get('/today', requireAuth, async (req, res, next) => {
  try {
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const [rows] = await pool.query(
      `SELECT a.* FROM attendance a
       LEFT JOIN students s ON s.student_code = a.student_code
       WHERE DATE(COALESCE(a.check_in, a.created_at)) = ? AND ${whereSql}
       ORDER BY a.check_in DESC`,
      [hoy(), ...params]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/count - conteo del dia (dentro del alcance)
router.get('/count', requireAuth, async (req, res, next) => {
  try {
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(a.check_in IS NOT NULL) AS entradas,
         SUM(a.check_out IS NOT NULL) AS salidas
       FROM attendance a
       LEFT JOIN students s ON s.student_code = a.student_code
       WHERE DATE(COALESCE(a.check_in, a.created_at)) = ? AND ${whereSql}`,
      [hoy(), ...params]
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

// GET /api/attendance/range?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&q=...]
// Historial por fechas y busqueda, dentro del alcance del rol.
router.get('/range', requireAuth, async (req, res, next) => {
  try {
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const desde = req.query.desde || hoy();
    const hasta = req.query.hasta || desde;
    const q = String(req.query.q || '').trim().slice(0, 100);

    const sql = `SELECT a.* FROM attendance a
      LEFT JOIN students s ON s.student_code = a.student_code
      WHERE DATE(COALESCE(a.check_in, a.created_at)) BETWEEN ? AND ? AND ${whereSql}`;
    const valores = [desde, hasta, ...params];
    let sqlFinal = sql;
    if (q) {
      sqlFinal += ' AND (a.student_code LIKE ? OR a.full_name LIKE ?)';
      valores.push(`%${q}%`, `%${q}%`);
    }
    sqlFinal += ' ORDER BY a.check_in DESC';

    const [rows] = await pool.query(sqlFinal, valores);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/student/:code - historial completo de un alumno
// (dentro del alcance del rol). Muestra entrada, salida y fecha.
router.get('/student/:code', requireAuth, async (req, res, next) => {
  try {
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const [rows] = await pool.query(
      `SELECT a.* FROM attendance a
       LEFT JOIN students s ON s.student_code = a.student_code
       WHERE a.student_code = ? AND ${whereSql}
       ORDER BY COALESCE(a.check_in, a.created_at) DESC`,
      [req.params.code, ...params]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/attendance/:id - corrige los horarios de un registro (dentro del alcance)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensaje: 'ID invalido.' });
    }
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const [rows] = await pool.query(
      `SELECT a.id FROM attendance a
       LEFT JOIN students s ON s.student_code = a.student_code
       WHERE a.id = ? AND ${whereSql} LIMIT 1`,
      [id, ...params]
    );
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Registro de asistencia no encontrado.' });
    }

    const body = req.body || {};
    const asignaciones = [];
    const valores = [];
    function formatearFecha(v) {
      const d = new Date(String(v).replace('T', ' '));
      if (Number.isNaN(d.getTime())) return null;
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
    for (const campo of ['check_in', 'check_out']) {
      if (!Object.prototype.hasOwnProperty.call(body, campo)) continue;
      const v = body[campo];
      if (v === null || v === '') {
        asignaciones.push(`${campo} = NULL`);
      } else {
        const extra = formatearFecha(v);
        if (!extra) {
          return res.status(400).json({ mensaje: `Formato de ${campo} invalido.` });
        }
        asignaciones.push(`${campo} = ?`);
        valores.push(extra);
      }
    }
    if (asignaciones.length === 0) {
      return res.status(400).json({ mensaje: 'No hay cambios para guardar.' });
    }
    valores.push(id);
    await pool.query(`UPDATE attendance SET ${asignaciones.join(', ')} WHERE id = ?`, valores);
    res.json({ mensaje: 'Registro de asistencia actualizado.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/attendance/:id - elimina un registro (dentro del alcance)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensaje: 'ID invalido.' });
    }
    const alcance = await alcanceUsuario(pool, req.auth.username, req.auth.role);
    const { sql: whereSql, params } = dondeAlcanceSQL(alcance);
    const [rows] = await pool.query(
      `SELECT a.id FROM attendance a
       LEFT JOIN students s ON s.student_code = a.student_code
       WHERE a.id = ? AND ${whereSql} LIMIT 1`,
      [id, ...params]
    );
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Registro de asistencia no encontrado.' });
    }
    await pool.query('DELETE FROM attendance WHERE id = ?', [id]);
    res.json({ mensaje: 'Registro de asistencia eliminado.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;