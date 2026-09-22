/**
 * Gym UES - Calculo del alcance (filtrado por rol) de cada usuario autenticado.
 *
 * Alcance posible:
 *  - 'todo'     : super_admin, admin y administrador_gym (ven todo).
 *  - 'turno'    : admin_matutino / admin_vespertino (solo ese turno).
 *  - 'carreras' : jefe_carrera (solo las carreras asignadas en scope_values).
 *  - 'ninguno'  : rol desconocido -> sin acceso a alumnos/asistencia.
 */
'use strict';

const ROLES_TODO = ['super_admin', 'admin', 'administrador_gym'];

const TURNO_POR_ROL = {
  admin_matutino: 'Matutino',
  admin_vespertino: 'Vespertino',
  // Roles utilizados por el sistema anterior (base de datos existente)
  maestro_mañana: 'Matutino',
  maestro_tarde: 'Vespertino'
};

async function alcanceUsuario(pool, username, role) {
  if (ROLES_TODO.includes(role)) {
    return { tipo: 'todo' };
  }
  if (TURNO_POR_ROL[role]) {
    return { tipo: 'turno', turno: TURNO_POR_ROL[role] };
  }
  if (role === 'jefe_carrera') {
    let carreras = [];
    try {
      const [rows] = await pool.query(
        'SELECT scope_values FROM users WHERE username = ? LIMIT 1',
        [username]
      );
      const raw = rows[0] && rows[0].scope_values;
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          carreras = parsed.map((c) => String(c).trim()).filter(Boolean);
        }
      }
    } catch {
      carreras = [];
    }
    return { tipo: 'carreras', carreras };
  }
  return { tipo: 'ninguno' };
}

// Construye el fragmento WHERE (alias s = students) para filtrar listados
// de alumnos o de asistencia (JOIN students s ...). Devuelve { sql, params }.
function dondeAlcanceSQL(alcance) {
  if (alcance.tipo === 'turno') {
    return { sql: 's.turn = ?', params: [alcance.turno] };
  }
  if (alcance.tipo === 'carreras') {
    const carreras = alcance.carreras || [];
    if (carreras.length === 0) return { sql: '1 = 0', params: [] };
    return {
      sql: `s.career IN (${carreras.map(() => '?').join(', ')})`,
      params: carreras
    };
  }
  if (alcance.tipo === 'ninguno') {
    return { sql: '1 = 0', params: [] };
  }
  return { sql: '1 = 1', params: [] };
}

module.exports = { alcanceUsuario, dondeAlcanceSQL };