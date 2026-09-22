/**
 * Gym UES - Rutas de configuracion: lectura publica y actualizacion (solo admin).
 * Almacena reglamento, horarios y URLs de PDFs en la tabla settings.
 */
const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware');

const router = express.Router();

// GET /api/settings - devuelve todas las configuraciones como objeto
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
    const result = {};
    for (const r of rows) result[r.setting_key] = r.setting_value;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings - actualiza una o varias configuraciones  { clave: valor }
// Restringido EXCLUSIVAMENTE a super_admin / admin. Los maestros de turno no
// tienen permisos sobre la configuracion institucional.
router.put(
  '/',
  requireAuth,
  requireRole('super_admin', 'admin'),
  async (req, res, next) => {
  try {
    const body = req.body || {};
    const entries = Object.entries(body).filter(([k]) => /^[a-zA-Z0-9_]+$/.test(k));
    if (entries.length === 0) {
      return res.status(400).json({ mensaje: 'No hay configuraciones validas para guardar.' });
    }
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, String(value)]
      );
    }
    res.json({ mensaje: 'Configuracion guardada correctamente.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;