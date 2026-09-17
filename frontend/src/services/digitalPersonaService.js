// =====================================================================
// digitalPersonaService.js
// Integración con el lector DigitalPersona U.are.U 4500 (USB).
//
// Se comunica con el agente local de DigitalPersona Lite Client que
// escucha en https://127.0.0.1:52181.
//
// REGLA CLAVE PARA PRUEBAS (Modo Simulación):
//   Si el servicio local no responde o el hardware no está conectado,
//   el servicio activa automáticamente un modo de SIMULACIÓN. Nadie debe
//   romper la app: las capturas se simulan generando un template Base64
//   sintético válido. Mañana, al conectar el lector por USB, el servicio
//   usará directamente el hardware real sin cambiar el código.
// =====================================================================

const AGENT_URL = 'https://127.0.0.1:52181';
const AGENT_TIMEOUT_MS = 2500;
const MOCK_DELAY_MS = 1500;

// Endpoints candidatos del agente local (se intentan en orden; al conectar
// el lector real solo hay que confirmar cuál usa tu instalación).
const STATUS_ENDPOINTS = ['/api/status', '/status', '/api/devices', '/'];
const CAPTURE_ENDPOINTS = ['/api/capture', '/capture', '/api/fingerprint/capture'];
const IDENTIFY_ENDPOINTS = ['/api/identify', '/identify'];

// Resultado en caché de la detección: 'real' | 'mock'
let detectionMode = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function requestAgent(endpoint, { method = 'GET', body = null, timeout = AGENT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(`${AGENT_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal
  })
    .then(async (res) => {
      clearTimeout(timer);
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { ok: res.ok, status: res.status, json };
    })
    .catch((error) => {
      clearTimeout(timer);
      return { ok: false, status: 0, error };
    });
}

// ---------------------------------------------------------------------
// Generación de templates sintéticos (Modo Simulación)
// ---------------------------------------------------------------------

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function seededRandom(seedValue) {
  let state = hashCode(String(seedValue)) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Template sintético determinista: mismo "seed" => mismo Base64.
// Así la verificación 1:N funciona en simulación (alta y chequeo consisten).
function buildSyntheticTemplate(seedValue) {
  const seed = seedValue ? String(seedValue).trim() : 'gym-ues-biometric';
  const rand = seededRandom(seed);
  const size = 384; // Tamaño típico de un template FID de DigitalPersona
  const bytes = new Uint8Array(size);

  const header = [0x46, 0x4d, 0x52, 0x00, 0x01, 0x00]; // "FMR\0\x01\0"
  for (let i = 0; i < header.length; i += 1) bytes[i] = header[i];

  for (let i = header.length; i < size; i += 1) {
    bytes[i] = Math.floor(rand() * 256);
  }
  return toBase64(bytes);
}

// ---------------------------------------------------------------------
// Detección de hardware / modo
// ---------------------------------------------------------------------

export async function getReaderStatus({ force = false } = {}) {
  if (detectionMode && !force) {
    return { mode: detectionMode, agentUrl: AGENT_URL, hardware: detectionMode === 'real' };
  }

  for (const endpoint of STATUS_ENDPOINTS) {
    const response = await requestAgent(endpoint);
    if (response.ok && response.json) {
      const payload = response.json;
      const hasHardware =
        payload ||
        typeof payload === 'string'; // cualquier respuesta JSON = agente vivo
      const hardwareFlag =
        payload.hardware === true ||
        payload.reader === true ||
        payload.connected === true ||
        (Array.isArray(payload.devices) && payload.devices.length > 0) ||
        (Array.isArray(payload.readers) && payload.readers.length > 0);

      detectionMode = hasHardware && hardwareFlag ? 'real' : 'mock';
      return { mode: detectionMode, agentUrl: AGENT_URL, hardware: detectionMode === 'real' };
    }
  }

  detectionMode = 'mock';
  return { mode: 'mock', agentUrl: AGENT_URL, hardware: false };
}

export function isSimulationMode() {
  return detectionMode === null || detectionMode === 'mock';
}

// ---------------------------------------------------------------------
// Captura de huella
// ---------------------------------------------------------------------

// Parámetros:
//   - seed: para el modo simulación. Pasa el student_number del alumno
//           para que su template sintético sea estable (alta ⇄ chequeo).
//   - onStatus(mensaje): callback para reflejar estados dinámicos en la UI.
//
// Devuelve { template, simulated, mode }.
export async function captureFingerprint({ seed, onStatus } = {}) {
  const status = await getReaderStatus();
  const notify = (msg) => {
    if (typeof onStatus === 'function') onStatus(msg);
  };

  if (status.mode === 'real') {
    notify('Coloque su dedo en el lector…');
    for (const endpoint of CAPTURE_ENDPOINTS) {
      const response = await requestAgent(endpoint, { method: 'POST' });
      if (response.ok && response.json) {
        const raw =
          response.json.template ||
          response.json.fingerprint ||
          response.json.data?.template ||
          (typeof response.json === 'string' ? response.json : null);
        if (raw && typeof raw === 'string' && raw.length > 0) {
          return { template: raw, simulated: false, mode: 'real' };
        }
      }
    }
    // El agente responde pero algo falló: no romper la app, simular.
  }

  // --- Modo Simulación -------------------------------------------------
  notify('Simulando lectura de huella…');
  await sleep(MOCK_DELAY_MS);
  return { template: buildSyntheticTemplate(seed), simulated: true, mode: 'mock' };
}

// ---------------------------------------------------------------------
// Verificación 1:N
// ---------------------------------------------------------------------

function templateReady(student) {
  return Boolean(
    student &&
      student.fingerprint_template &&
      String(student.fingerprint_template).trim().length > 0
  );
}

function normalizeTemplate(value) {
  return String(value || '').replace(/\s+/g, '');
}

// Identifica al alumno cuyo template coincide con la huella capturada.
//   - Intenta primero el agente local (hardware real, emparejamiento real).
//   - Si no está disponible, hace coincidencia exacta del template
//     (funciona en el Modo Simulación con templates deterministas).
export async function identifyStudent(template, biometricsList = []) {
  const list = Array.isArray(biometricsList) ? biometricsList.filter(templateReady) : [];

  if (template && detectionMode === 'real') {
    for (const endpoint of IDENTIFY_ENDPOINTS) {
      const response = await requestAgent(endpoint, {
        method: 'POST',
        body: { template, templates: list.map((s) => s.fingerprint_template), students: list }
      });
      if (response.ok && response.json) {
        const found =
          response.json.student_number ||
          response.json.id ||
          response.json.student?.student_number;
        if (found) {
          const matched = list.find(
            (s) => s.student_number === found || String(s.id) === String(found)
          );
          if (matched) return matched;
        }
      }
    }
  }

  if (template) {
    const needle = normalizeTemplate(template);
    return (
      list.find((student) => normalizeTemplate(student.fingerprint_template) === needle) ||
      null
    );
  }

  return null;
}

export { buildSyntheticTemplate };