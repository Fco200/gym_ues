/**
 * Gym UES - Rutas de autenticacion: login, logout y verificacion de sesion.
 * Las contraseñas se comparan con bcrypt (nunca se almacenan en texto plano).
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireAuth, createToken, revokeToken } = require('../middleware');

const router = express.Router();

// Clave secreta para crear administradores de prueba y restablecer contrasenas
// (solo para desarrollo/prueba). Se puede cambiar con la variable de entorno
// ADMIN_SECRET_KEY.
const SECRET_ADMIN = process.env.ADMIN_SECRET_KEY || 'gymues-2026';

const ROLES_REGISTRABLES = [
  'super_admin',
  'admin',
  'administrador_gym',
  'admin_matutino',
  'admin_vespertino',
  'maestro_mañana',
  'maestro_tarde',
  'jefe_carrera'
];

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ mensaje: 'Usuario y contraseña son obligatorios.' });
    }
    const [rows] = await pool.query(
      'SELECT id, username, password, role, active FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas.' });
    }
    const user = rows[0];
    if (Number(user.active) === 0) {
      return res.status(403).json({ mensaje: 'Esta cuenta esta desactivada. Contacte al super_admin.' });
    }
    // Soporta contrasenas cifradas (bcrypt) y en texto plano (las restablecidas
    // desde el login o creadas con clave secreta se guardan SIN cifrar para
    // poder verlas en MySQL).
    let valid = false;
    if (String(user.password).startsWith('$2')) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      valid = String(user.password) === password;
    }
    if (!valid) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas.' });
    }
    const token = createToken(user);
    res.json({ token, usuario: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  revokeToken(req.auth.token);
  res.json({ mensaje: 'Sesion cerrada correctamente.' });
});

// GET /api/auth/me - verifica sesion
// NOTA: la firma es (req, res). Antes se usaba (_req) y se hacia referencia a
// req.auth, lo que lanzaba "req is not defined" (error tipo res.json is not a function).
router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, usuario: { username: req.auth.username, role: req.auth.role } });
});

// GET /api/auth/status - estado de la conexion y cuentas de administrador.
// Sirve para que el login indique si la BD responde y cuantos usuarios existen.
router.get('/status', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT username, role FROM users ORDER BY username');
    res.json({
      db: true,
      cuentas: rows.map((r) => ({ username: r.username, role: r.role }))
    });
  } catch (err) {
    res.status(503).json({
      db: false,
      mensaje: 'No se pudo conectar con la base de datos. Verifique que XAMPP/MySQL este encendido.'
    });
  }
});

// POST /api/auth/restablecer - "Olvide mi contrasena": la restablece pedida la
// clave secreta de prueba. La contrasena se guarda SIN CIFRAR en la base de
// datos (el login la compara en texto plano) para poder verla en MySQL.
router.post('/restablecer', async (req, res, next) => {
  try {
    const { secret, username, password } = req.body || {};
    if (String(secret || '') !== SECRET_ADMIN) {
      return res.status(403).json({ mensaje: 'Clave secreta incorrecta.' });
    }
    const user = String(username || '').trim();
    const pass = String(password || '');
    if (!user || pass.length < 4) {
      return res.status(400).json({ mensaje: 'Usuario y nueva contrasena (min. 4 caracteres) son obligatorios.' });
    }
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [user]);
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'No existe un usuario con ese nombre de usuario.' });
    }
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [pass, rows[0].id]);
    res.json({ mensaje: 'Contrasena restablecida. Queda guardada en texto plano en la base de datos.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register-admin - crea un administrador nuevo pidiendo la clave
// secreta (solo para prueba). La contrasena se guarda SIN CIFRAR para poder
// verla en MySQL.
router.post('/register-admin', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (String(body.secret || '') !== SECRET_ADMIN) {
      return res.status(403).json({ mensaje: 'Clave secreta incorrecta.' });
    }
    const username = String(body.username || '').trim().slice(0, 100);
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    const role = String(body.role || 'admin');
    if (!username || password.length < 4) {
      return res.status(400).json({ mensaje: 'Usuario y contrasena (min. 4 caracteres) son obligatorios.' });
    }
    if (!ROLES_REGISTRABLES.includes(role)) {
      return res.status(400).json({ mensaje: 'Rol no valido.' });
    }
    const [dup] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (dup.length > 0) {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con ese nombre de usuario.' });
    }
    const [colsRaw] = await pool.query('SHOW COLUMNS FROM users');
    const cols = colsRaw.map((c) => c.Field);
    const valores = { username, password, role };
    if (cols.includes('active')) valores.active = 1;
    if (cols.includes('name')) valores.name = name || username;
    if (cols.includes('email')) valores.email = username;
    if (cols.includes('type')) valores.type = 'general';
    const campos = Object.keys(valores);
    await pool.query(
      `INSERT INTO users (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
      campos.map((c) => valores[c])
    );
    res.status(201).json({ mensaje: 'Administrador creado correctamente. Contrasena en texto plano en la base de datos.', username });
  } catch (err) {
    next(err);
  }
});

module.exports = router;