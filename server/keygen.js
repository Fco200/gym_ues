/**
 * Gym UES - Generacion de claves unicas para personas exteriores (GYM-XXXXXX).
 * Compartido por students.routes y public.routes para no duplicar logica.
 */
'use strict';

const { pool } = require('./db');

function generarClaveExterior() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'GYM-';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Genera una clave exterior verificando en la BD que no este en uso.
async function generarClaveUnica() {
  for (let i = 0; i < 10; i += 1) {
    const code = generarClaveExterior();
    const [dup] = await pool.query('SELECT id FROM students WHERE student_code = ? LIMIT 1', [
      code
    ]);
    if (dup.length === 0) return code;
  }
  return `GYM-${Date.now().toString(36).toUpperCase()}`;
}

module.exports = { generarClaveExterior, generarClaveUnica };