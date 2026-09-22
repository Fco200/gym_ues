// Gym UES - Wrapper de fetch para /api.
// Usa la API preload de Electron si esta disponible; de lo contrario fetch directo.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
  return localStorage.getItem('gym_token') || '';
}

// Convierte la respuesta HTTP (fetch Response) a JSON de forma segura.
// NOTA: recibe SIEMPRE un Response real (ya resuelto). Si el cuerpo no es
// JSON valido devuelve {} para que el manejador decida el error.
function parseJson(res) {
  return res
    .json()
    .catch(() => ({}))
    .then((data) => ({ res, data }));
}

export async function api(method, path, body = null, { auth = true } = {}) {
  const token = auth ? getToken() : '';

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  // IMPORTANTE: primero se resuelve fetch() (await) y LUEGO se parsea.
  // Antes se pasaba el Promise directamente a parseJson -> se llamaba
  // res.json() sobre un Promise y lanzaba "res.json is not a function".
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const { data } = await parseJson(res);

  if (!res.ok) {
    throw new Error(data?.mensaje || data?.error || `Error ${res.status}`);
  }
  return data;
}

// Convierte una ruta relativa (/uploads/x.pdf) en URL absoluta
export function urlArchivo(ruta) {
  if (!ruta) return '';
  if (ruta.startsWith('http')) return ruta;
  return `${API_URL}${ruta}`;
}

// Almacena el token de sesion recibido en el login
export function guardarSesion(token, usuario) {
  if (token) localStorage.setItem('gym_token', token);
  if (usuario) localStorage.setItem('gym_usuario', JSON.stringify(usuario));
}

export function cerrarSesionLocal() {
  localStorage.removeItem('gym_token');
  localStorage.removeItem('gym_usuario');
}

// Autenticacion
export const login = (username, password) =>
  api('POST', '/api/auth/login', { username, password }, { auth: false });
export const logout = () => api('POST', '/api/auth/logout');
export const verificarSesion = () => api('GET', '/api/auth/me');
export const estadoAuth = () => api('GET', '/api/auth/status', null, { auth: false });
export const health = () => api('GET', '/api/health', null, { auth: false });
// Recuperacion y creacion de administradores con clave secreta (prueba)
export const restablecerPasswordPublico = (data) =>
  api('POST', '/api/auth/restablecer', data, { auth: false });
export const crearAdminPrueba = (data) =>
  api('POST', '/api/auth/register-admin', data, { auth: false });

// Usuarios del sistema (solo super_admin)
export const getUsers = () => api('GET', '/api/users');
export const createUser = (data) => api('POST', '/api/users', data);
export const updateUser = (username, data) =>
  api('PUT', `/api/users/${encodeURIComponent(username)}`, data);
export const deleteUser = (username) =>
  api('DELETE', `/api/users/${encodeURIComponent(username)}`);

// Estudiantes
export const getStudents = (q = '') =>
  api('GET', `/api/students${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const createStudent = (data) => api('POST', '/api/students', data);
export const updateStudent = (code, data) => api('PUT', `/api/students/${code}`, data);
export const deleteStudent = (code) => api('DELETE', `/api/students/${code}`);

// Asistencia
export const checarEntrada = (data) => api('POST', '/api/attendance/check-in', data);
export const checarSalida = (data) => api('POST', '/api/attendance/check-out', data);
export const getAttendanceToday = () => api('GET', '/api/attendance/today');
export const getAttendanceCount = () => api('GET', '/api/attendance/count');
export const getAttendanceRange = (desde, hasta) =>
  api('GET', `/api/attendance/range?desde=${desde}&hasta=${hasta}`);
export const getStudentAttendance = (code) =>
  api('GET', `/api/attendance/student/${encodeURIComponent(code)}`);
export const updateAttendanceRecord = (id, data) =>
  api('PUT', `/api/attendance/${id}`, data);
export const deleteAttendanceRecord = (id) =>
  api('DELETE', `/api/attendance/${id}`);

// Configuracion
export const getSettings = () => api('GET', '/api/settings');
export const updateSettings = (data) => api('PUT', '/api/settings', data);

// Consultas PUBLICAS del checador (no requieren sesion)
export const consultarMiembro = (code) =>
  api('GET', `/api/public/member/${encodeURIComponent(code)}`, null, { auth: false });
export const contadorHoyPublico = () =>
  api('GET', '/api/public/count-today', null, { auth: false });
export const registroPublico = (data) =>
  api('POST', '/api/public/registro', data, { auth: false });

// Subida de archivos (PDF o imagen; FormData; CORS del backend permite dev y
// empaquetado). Alternativa: http://localhost:3001/api/uploads
export const uploadPdf = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return uploadPdfViaFetch(fd, getToken());
};

// Misma subida, nombre generico (acepta PDFs e imagenes).
export const uploadArchivo = uploadPdf;

function uploadPdfViaFetch(fd, token) {
  return fetch(`${API_URL}/api/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data.url) throw new Error(data.mensaje || 'No se pudo subir el archivo.');
      return data;
    });
}