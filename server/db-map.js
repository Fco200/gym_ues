/**
 * Gym UES - Mapeo central de la base de datos y construccion SEGURA de consultas.
 *
 * Objetivos:
 *   1) Ser la UNICA fuente de verdad de las columnas de cada tabla.
 *   2) Normalizar (recortar, canonicalizar enums, serializar JSON, etc.) todo
 *      valor antes de tocar la base de datos.
 *   3) Construir INSERT / UPDATE usando SIEMPRE marcadores ? (parametrizados) y
 *      unicamente las columnas mapeadas. Ninguna cadena del cliente llega al SQL.
 *
 * Regla de oro: ninguna ruta arma SQL con datos del cliente; siempre pasa por
 * estas utilidades (o por mysql2 con placeholders ?).
 */
'use strict';

// Mapas de valores celebrados para campos tipo enum (alias -> valor canonico).
const OPCIONES = {
  tipo: {
    alumno: 'alumno',
    estudiante: 'alumno',
    maestro: 'maestro',
    docente: 'maestro',
    exterior: 'exterior',
    externo: 'exterior'
  },
  genero: {
    '': '',
    femenino: 'Femenino',
    masculino: 'Masculino',
    otro: 'Otro'
  },
  turno: {
    '': '',
    matutino: 'Matutino',
    manana: 'Matutino',
    'mañana': 'Matutino',
    vespertino: 'Vespertino',
    tarde: 'Vespertino',
    sabatino: 'Sabatino',
    general: ''
  }
};

// Columnas admitidas por tabla. Cada definicion indica como normalizar el valor.
//  - protegida:    no se recibe del cliente ni se inserta/actualiza (id, timestamps).
//  - soloInsert:   se puede insertar pero NO actualizar (student_code).
//  - omitirSi... : base: valor por defecto que se inserta si el cliente no lo envia.
const SCHEMA = {
  students: {
    id: { tipo: 'entero', protegida: true },
    student_code: { tipo: 'texto', max: 50, soloInsert: true },
    full_name: { tipo: 'texto', max: 200 },
    second_name: { tipo: 'texto', max: 200 },
    last_name: { tipo: 'texto', max: 200 },
    type: { tipo: 'enum', opciones: OPCIONES.tipo, base: 'alumno' },
    gender: { tipo: 'enum', opciones: OPCIONES.genero, base: '' },
    turn: { tipo: 'enum', opciones: OPCIONES.turno, base: '' },
    career: { tipo: 'texto', max: 200, base: '' },
    image_url: { tipo: 'texto', max: 500, base: '' },
    medical_certificate: { tipo: 'texto', max: 255, base: 'No' },
    created_at: { tipo: 'texto', protegida: true }
  },
  attendance: {
    id: { tipo: 'entero', protegida: true },
    student_code: { tipo: 'texto', max: 50 },
    full_name: { tipo: 'texto', max: 200, base: '' },
    user_type: { tipo: 'texto', max: 20, base: 'alumno' },
    check_in: { tipo: 'fecha' },
    check_out: { tipo: 'fecha' },
    created_at: { tipo: 'texto', protegida: true }
  },
  settings: {
    id: { tipo: 'entero', protegida: true },
    setting_key: { tipo: 'texto', max: 100 },
    setting_value: { tipo: 'texto', max: 100000, base: '' },
    updated_at: { tipo: 'texto', protegida: true }
  },
  users: {
    id: { tipo: 'entero', protegida: true },
    username: { tipo: 'texto', max: 100 },
    password: { tipo: 'texto', max: 255 },
    role: { tipo: 'texto', max: 50, base: 'admin' },
    scope_values: { tipo: 'texto', max: 2000, base: null },
    active: { tipo: 'entero', base: 1 },
    created_at: { tipo: 'texto', protegida: true }
  }
};

/**
 * Normaliza un valor segun la definicion de su columna.
 * Devuelve { valor } o { error }.
 */
function normalizarValor(def, valor) {
  const ausente = valor === undefined || valor === null;

  switch (def.tipo) {
    case 'texto': {
      const texto = String(valor === undefined || valor === null ? '' : valor)
        .trim()
        .slice(0, def.max || 200);
      return { valor: texto };
    }

    case 'enum': {
      const v = String(valor === undefined || valor === null ? '' : valor).trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(def.opciones, v)) {
        return { valor: def.opciones[v] };
      }
      return { error: `valor no permitido: "${v}"` };
    }

    case 'entero': {
      const n = Number(valor);
      return Number.isInteger(n) ? { valor: n } : { error: 'debe ser un entero' };
    }

    case 'fecha': {
      if (ausente || valor === '') return { valor: null };
      return { valor: String(valor).trim().slice(0, 19) };
    }

    default:
      return { valor: String(valor === undefined || valor === null ? '' : valor) };
  }
}

/**
 * Prepara un INSERT de una entidad a partir de un objeto arbitrario.
 * Devuelve { columnas, valores, placeholders, errores } listo para
 * pool.query(\`INSERT INTO tabla (cols) VALUES (placeholders)\`, valores).
 */
function prepararInsert(entidad, datos) {
  const defEntidad = SCHEMA[entidad] || {};
  const raw = datos && typeof datos === 'object' ? datos : {};
  const columnas = [];
  const valores = [];
  const errores = [];

  for (const [col, def] of Object.entries(defEntidad)) {
    if (def.protegida) continue;
    const presente = Object.prototype.hasOwnProperty.call(raw, col);
    let valor = presente ? raw[col] : undefined;
    if (!presente && def.base !== undefined) valor = def.base;
    if (!presente && def.base === undefined) valor = null;

    const res = normalizarValor(def, valor);
    if (res.error) {
      errores.push(`${col}: ${res.error}`);
      continue;
    }
    columnas.push(col);
    valores.push(res.valor);
  }

  return {
    columnas,
    valores,
    placeholders: columnas.map(() => '?').join(', '),
    errores
  };
}

/**
 * Prepara un UPDATE de una entidad con las columnas presentes en `datos`.
 * Devuelve { asignaciones, valores, errores }. Las columnas marcadas como
 * protegidas o soloInsert nunca se actualizan.
 */
function prepararUpdate(entidad, datos) {
  const defEntidad = SCHEMA[entidad] || {};
  const raw = datos && typeof datos === 'object' ? datos : {};
  const asignaciones = [];
  const valores = [];
  const errores = [];

  for (const [col, def] of Object.entries(defEntidad)) {
    if (def.protegida || def.soloInsert) continue;
    if (!Object.prototype.hasOwnProperty.call(raw, col)) continue;

    const res = normalizarValor(def, raw[col]);
    if (res.error) {
      errores.push(`${col}: ${res.error}`);
      continue;
    }
    asignaciones.push(`\`${col}\` = ?`);
    valores.push(res.valor);
  }

  return { asignaciones, valores, errores };
}

/** Devuelve la lista de columnas de una entidad (para documentacion / CLI). */
function columnasDe(entidad) {
  return Object.entries(SCHEMA[entidad] || {})
    .filter(([, def]) => !def.protegida)
    .map(([col]) => col);
}

module.exports = { SCHEMA, prepararInsert, prepararUpdate, columnasDe, normalizarValor };