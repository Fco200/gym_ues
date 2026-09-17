import axios from 'axios';

// API alojada en Render (producción).
// En desarrollo local puedes sobreescribirla con VITE_API_URL o usar el proxy de Vite.
export const API_URL = import.meta.env.VITE_API_URL || 'https://gym-ues.onrender.com/api';

// Convierte una ruta relativa del servidor (/uploads/...) en una URL completa
export function assetUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//.test(src)) return src;
  const base = API_URL.replace(/\/api\/?$/, '');
  return `${base}${src.startsWith('/') ? src : `/${src}`}`;
}

const api = axios.create({
  baseURL: API_URL
});

export default api;