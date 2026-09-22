/**
 * Gym UES - CRUD de cuentas de administrador del sistema.
 * Acceso EXCLUSIVO de super_admin (requireAuth + requireRole). Nunca se
 * expone la contrasena de ningun usuario en las respuestas. Las contrasenas
 * nuevas se guardan SIN CIFRAR (texto plano) para poder verlas en MySQL; el
 * login acepta tanto bcrypt como texto plano.
 */
const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware');

const router = express.Router();

const ROLES_VALIDOS = [
  'super_admin',
  'admin',
  'administrador_gym',
  'admin_matutino',
  'admin_vespertino',
  'maestro_mañana',
  'maestro_tarde',
  'jefe_carrera'
];

// Convierte scope_values (JSON string de la BD) en un array de carreras.
function deserializarScope(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((c) => String(c).trim()).filter(Boolean) : null;
  } catch {
    return null;
  }
}

// Convierte un array (o CSV con , o ;) de carreras en JSON string para la BD.
function serializarScope(valor) {
  if (valor === undefined || valor === null) return null;
  const arr = Array.isArray(valor) ? valor : String(valor).split(/[;,]/);
  const limpio = arr.map((c) => String(c).trim()).filter(Boolean);
  return limpio.length > 0 ? JSON.stringify(limpio) : null;
}

router.use(requireAuth, requireRole('super_admin'));

// GET /api/users - lista de cuentas (sin password)
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, role, active, scope_values FROM users ORDER BY username'
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        username: r.username,
        role: r.role,
        active: Number(r.active) === 1,
        scope_values: deserializarScope(r.scope_values)
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/users - crea una cuenta
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim().slice(0, 100);
    const password = String(body.password || '');
    const role = String(body.role || 'admin');
    const active = body.active === false || Number(body.active) === 0 ? 0 : 1;

    if (!username) {
      return res.status(400).json({ mensaje: 'El usuario es obligatorio.' });
    }
    if (password.length < 4) {
      return res.status(400).json({ mensaje: 'La contrasena debe tener al menos 4 caracteres.' });
    }
    if (!ROLES_VALIDOS.includes(role)) {
      return res.status(400).json({ mensaje: 'Rol no valido.' });
    }
    if (role === 'jefe_carrera' && !Array.isArray(body.scope_values)) {
      return res.status(400).json({ mensaje: 'Asigne carreras para el rol jefe_carrera.' });
    }

    const [dup] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (dup.length > 0) {
      return res.status(409).json({ mensaje: `El usuario ${username} ya existe.` });
    }

    const scope = serializarScope(body.scope_values);
    await pool.query(
      'INSERT INTO users (username, password, role, active, scope_values) VALUES (?, ?, ?, ?, ?)',
      [username, password, role, active, scope]
    );
    res.status(201).json({ mensaje: 'Usuario creado correctamente (contrasena en texto plano en la BD).', username });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:username - actualiza role/password/active/scope_values
router.put('/:username', async (req, res, next) => {
  try {
    const target = String(req.params.username || '').trim();
    const body = req.body || {};
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [target]);
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    const actual = rows[0];
    const asignaciones = [];
    const valores = [];

    const nuevoRole = Object.prototype.hasOwnProperty.call(body, 'role')
      ? String(body.role)
      : actual.role;
    if (!ROLES_VALIDOS.includes(nuevoRole)) {
      return res.status(400).json({ mensaje: 'Rol no valido.' });
    }
    if (Object.prototype.hasOwnProperty.call(body, 'role') && body.role !== actual.role) {
      if (actual.username === 'super_admin') {
        return res.status(403).json({ mensaje: 'No se puede cambiar el rol de super_admin.' });
      }
      asignaciones.push('role = ?');
      valores.push(nuevoRole);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'active')) {
      if (actual.username === 'super_admin' && (body.active === false || Number(body.active) === 0)) {
        return res.status(403).json({ mensaje: 'No se puede desactivar la cuenta super_admin.' });
      }
      const active = body.active === false || Number(body.active) === 0 ? 0 : 1;
      asignaciones.push('active = ?');
      valores.push(active);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'password') && String(body.password) !== '') {
      const pw = String(body.password);
      if (pw.length < 4) {
        return res.status(400).json({ mensaje: 'La contrasena debe tener al menos 4 caracteres.' });
      }
      asignaciones.push('password = ?');
      valores.push(pw);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'scope_values')) {
      if (nuevoRole === 'jefe_carrera' && !Array.isArray(body.scope_values)) {
        return res.status(400).json({ mensaje: 'Asigne carreras para el rol jefe_carrera.' });
      }
      asignaciones.push('scope_values = ?');
      valores.push(serializarScope(body.scope_values));
    }

    if (asignaciones.length === 0) {
      return res.status(400).json({ mensaje: 'No hay cambios para guardar.' });
    }

    valores.push(target);
    await pool.query(`UPDATE users SET ${asignaciones.join(', ')} WHERE username = ?`, valores);
    res.json({ mensaje: 'Usuario actualizado correctamente.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:username - elimina (nunca a super_admin ni a si mismo)
router.delete('/:username', async (req, res, next) => {
  try {
    const target = String(req.params.username || '').trim();
    if (target === 'super_admin') {
      return res.status(400).json({ mensaje: 'No se puede eliminar la cuenta super_admin.' });
    }
    if (target === req.auth.username) {
      return res.status(400).json({ mensaje: 'No puede eliminar su propia cuenta.' });
    }
    const [result] = await pool.query('DELETE FROM users WHERE username = ?', [target]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }
    res.json({ mensaje: 'Usuario eliminado correctamente.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;