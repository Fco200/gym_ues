/* eslint-disable no-undef */
// Gym UES - Proceso principal de Electron (CommonJS)
// Decision de arquitectura:
//  - electron/main.cjs y electron/preload.cjs usan CommonJS (require/module.exports)
//    porque Electron carga el "main" desde package.json y es el formato mas
//    robusto/compatible con electron-builder y el empaquetado ASAR.
//  - El frontend (src/, Vite) usa ES Modules porque Vite compila y empaqueta
//    todo a archivos estaticos; no hay conflicto de runtime.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

// En modo empaquetado los PDFs se guardan en un directorio escribible del usuario
// y la conexion a MySQL se configura con un archivo config.json persistente
// (creado automaticamente la primera vez; el usuario puede editarlo y reiniciar).
if (!isDev) {
  process.env.UPLOADS_DIR = path.join(app.getPath('userData'), 'uploads');

  const cfgPath = path.join(app.getPath('userData'), 'config.json');
  const DEFAULTS = {
    DB_HOST: '127.0.0.1',
    DB_PORT: 3306,
    DB_USER: 'root',
    DB_PASSWORD: '',
    DB_NAME: 'gym_ues_db',
    API_PORT: 3001
  };
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}');
  } catch {
    cfg = {};
  }
  const merged = { ...DEFAULTS, ...cfg };
  try {
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify(merged, null, 2));
  } catch {
    /* sin permisos de escritura: se usan los valores en memoria */
  }
  process.env.DB_HOST = String(merged.DB_HOST);
  process.env.DB_PORT = String(merged.DB_PORT);
  process.env.DB_USER = String(merged.DB_USER);
  process.env.DB_PASSWORD = String(merged.DB_PASSWORD);
  process.env.DB_NAME = String(merged.DB_NAME);
  process.env.PORT = String(merged.API_PORT);
}

const API_PORT = Number(process.env.PORT || 3001);
const API_URL = `http://127.0.0.1:${API_PORT}`;

let mainWindow = null;
let backendServer = null;

// ---------------------------------------------------------------------------
// Proxy HTTP hacia el backend Express (usado por las APIs expuestas en preload)
// ---------------------------------------------------------------------------
function proxyToBackend(method, apiPath, body = null, token = '') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: API_PORT,
        path: apiPath,
        method,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data: { mensaje: data } });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// IPC handlers: conectan la API expuesta en preload con el backend
// ---------------------------------------------------------------------------
ipcMain.handle('api:request', async (_event, { method, path: apiPath, body, token }) => {
  try {
    return await proxyToBackend(method, apiPath, body, token);
  } catch (err) {
    return { status: 503, data: { mensaje: 'No se pudo conectar con el servidor local.' } };
  }
});

// ---------------------------------------------------------------------------
// Creacion de la ventana principal
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#F5F7FA',
    title: 'Gym UES',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(isDev);

  if (isDev) {
    // Modo desarrollo: Vite sirve la app en http://localhost:5173
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Modo produccion: el servidor Express esta empaquetado junto a la app
    loadBuiltApp();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Carga la app compilada (dist/index.html) esperando a que el backend escuche
// ---------------------------------------------------------------------------
function loadBuiltApp() {
  const startBackend = require('../server/index.js');
  startBackend
    .then((server) => {
      backendServer = server;
      const html = path.join(__dirname, '..', 'dist', 'index.html');
      mainWindow.loadFile(html);
    })
    .catch((err) => {
      mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    });
}

// ---------------------------------------------------------------------------
// Ciclo de vida de la aplicacion
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendServer) {
    backendServer.close();
    backendServer = null;
  }
  app.quit();
});