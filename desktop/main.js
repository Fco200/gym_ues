const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');

// ============================================================================
// Configuración de la URL del checador
//  1. Argumento:  electron . --url=http://localhost:5173/checador
//  2. Variable:   CHECADOR_URL
//  3. Por defecto: servidor Express en producción (http://localhost:4000/checador)
// ============================================================================
function resolveTargetUrl() {
  const flag = process.argv.find((arg) => arg.startsWith('--url='));
  if (flag) return flag.slice('--url='.length);
  if (process.env.CHECADOR_URL) return process.env.CHECADOR_URL;
  return 'http://localhost:4000/checador';
}

function resolveKioskMode() {
  return !process.argv.includes('--windowed') && process.env.KIOSK_MODE !== '0';
}

const TARGET_URL = resolveTargetUrl();
const KIOSK = resolveKioskMode();

let mainWindow = null;
let trying = false;

// Verifica si el servidor está respondiendo
function checkServer() {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(TARGET_URL);
    } catch (error) {
      resolve(false);
      return;
    }
    const port = url.port || 80;
    const req = http.get(
      { host: url.hostname, port, path: '/', timeout: 2500 },
      (res) => {
        res.resume();
        resolve(res.statusCode < 500);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer() {
  if (trying || !mainWindow) return;
  trying = true;
  checkServer().then((ok) => {
    trying = false;
    if (ok && mainWindow) {
      mainWindow.loadURL(TARGET_URL);
    } else if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'waiting.html'));
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#1a1a2e',
    title: 'Gimnasio UES · Checador de alumnos',
    show: false,
    kiosk: KIOSK,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Si no hay servidor, mostrar la pantalla de espera con reloj
  waitForServer();

  // Reintento continuo mientras el servidor no esté disponible
  const retry = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(retry);
      return;
    }
    const current = mainWindow.webContents.getURL();
    if (!current || current.startsWith('file://')) {
      waitForServer();
    }
  }, 4000);

  // Carga exitosa: la pantalla queda activa (kiosco siempre encendido)
  mainWindow.webContents.on('did-finish-load', () => {});

  // Si el servidor se cae o da error, volver a la pantalla de espera
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadFile(path.join(__dirname, 'waiting.html'));
  });

  mainWindow.webContents.on('render-process-gone', () => {
    mainWindow.loadFile(path.join(__dirname, 'waiting.html'));
  });

  // Atajos de teclado para salir del modo kiosco (evita quedar atrapado)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const exitCombo =
      input.control && input.alt && input.key.toLowerCase() === 'q' ||
      input.control && input.shift && input.key.toLowerCase() === 'x';
    if (input.type === 'keyDown' && exitCombo) {
      app.quit();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});