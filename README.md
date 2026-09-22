# Gym UES — Checador Biométrico

Sistema de escritorio para el Gimnasio UES: control de asistencia de **alumnos, maestros y personas exteriores** mediante lector biométrico **DigitalPersona U.are.U 4500 (USB)**, plataforma **Electron + React (Vite) + Express + MySQL**.

---

## 1. Arquitectura (una sola carpeta / monorepo)

```
gym-ues-project/
├── electron/                 # Aplicacion Electron (CommonJS)
│   ├── main.cjs              # Proceso principal: ventana, IPC, arranque del backend
│   └── preload.cjs           # API segura via contextBridge (NUNCA expone Node)
├── server/                   # Backend Express (CommonJS)
│   ├── index.js              # Servidor, CORS, JSON, /uploads estaticos, rutas /api
│   ├── db.js                 # Pool mysql2 + initDatabase() (crea/ajusta tablas y columnas)
│   ├── db-map.js             # Mapeo de la BD: columnas validas + inserciones SEGURAS (?) 
│   ├── huella.js             # Busqueda de portador por plantilla (check-in y verificación)
│   ├── middleware.js         # Autenticacion por token en memoria
│   ├── routes/               # auth, students, attendance, settings, uploads, fingerprint
│   └── uploads/              # PDFs subidos (certificados, reglamento, horarios)
├── src/                      # Frontend React + Vite (ES Modules)
│   ├── pages/               # Checador, RegistroAlumno, AdminPortal, Asistencia
│   ├── components/          # Navbar (hamburguesa), Modal, ModalPDF, OverlayMensaje, CapturaHuella
│   ├── services/            # api.js (fetch wrapper) y digitalPersonaService.js
│   └── styles/global.css    # Colores institucionales UES (guinda #800020)
├── database/
│   └── schema.sql           # Respaldo SQL: crea BD y tablas si se quiere recrear
├── .env                     # Credenciales locales (ya creado)
├── vite.config.js           # Proxy /api y /uploads -> localhost:3001
└── package.json             # Unico package con TODAS las dependencias
```

### Decisiones de arquitectura clave

- **CommonJS para Electron, ESM para el frontend.** `package.json` declara `"main": "electron/main.cjs"` y `electron/preload.cjs` usan `require/module.exports`: es el formato más robusto para Electron y `electron-builder` (evita problemas de empacado/ASAR con ESM). Vite compila `src/` (ESM) a estáticos en `dist/`, por lo que el renderer no necesita conocer módulos de Node.
- **El backend arranca de dos formas:** en desarrollo con `concurrently + nodemon`; en el ejecutable empaquetado `main.cjs` hace `require('../server/index.js')` y arranca Express dentro del proceso Electron (opción robusta, sin `child_process`).
- **Proxy biométrico en el backend.** `server/routes/fingerprint.routes.js` consume el agente local HTTPS del lector (`https://127.0.0.1:52181/dp/v1/fingerprints/capture`) con `rejectUnauthorized: false` (certificado autofirmado) y expone `/api/fingerprint/capture` al frontend. Así el `.exe` no depende del CORS del agente.
- **`app.commandLine.appendSwitch('ignore-certificate-errors')`** en `main.cjs` para que el renderer y el proceso principal toleren el certificado self-signed del agente.

---

## 2. Base de datos MySQL (XAMPP)

- Base: **`gym_ues_db`** (host `127.0.0.1`, puerto `3306`, usuario `root`, sin contraseña). La cadena de conexión vive en `server/db.js` y `.env` (`DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=`, `DB_NAME=gym_ues_db`).
- **`server/db.js → initDatabase()`** verifica que existan las tablas `students`, `attendance`, `settings` y `users`, crea las faltantes y ejecuta `ALTER TABLE ... ADD COLUMN` automáticamente con las columnas mínimas (compatible con esquemas previos).
- **Tablas:**
  - `students`: `id` (PK), `student_code` (UNIQUE), `full_name`, `second_name`, `last_name`, `type` (`alumno|maestro|exterior`), `gender`, `turn`, `medical_certificate`, `fingerprint_template` (LONGTEXT, JSON de la plantilla), `created_at`.
  - `attendance`: `id`, `student_code`, `full_name`, `user_type`, `check_in` (DATETIME), `check_out` (DATETIME), `created_at`.
  - `settings`: `id`, `setting_key` (UNIQUE), `setting_value` (LONGTEXT).
  - `users`: `id`, `username` (UNIQUE), `password` (**texto plano** para poder verla en MySQL; el login acepta también bcrypt por compatibilidad), `role`, `created_at`.
- **Cuentas iniciales** (contraseña **`admin123`**, guardada en texto plano): `super_admin` y `admin` (acceso total, incluida la configuración institucional) · `matutino`, `vespertino` (maestros de turno: solo Historial de Asistencias y CRUD de Alumnos) · `jefecarrera` · `administradorgym`. También puedes crear admins desde el Login con la clave secreta de prueba **`gymues-2026`** y restablecer contraseñas (quedan en texto plano).
- **Restricción de roles:** la pestaña "Configuración y Avisos" (reglamento y horarios) es **exclusiva de `super_admin` / `admin`**; el backend la refuerza con `requireRole` en `PUT /api/settings`.
- **Respaldo/recreación:** `database/schema.sql` crea la BD, tablas e inserts por defecto.

---

## 3. Cómo ejecutar el proyecto

### Requisitos
- Node.js 18+ (probado con v24).
- XAMPP con **MySQL corriendo** (Apache no es necesario).
- (Opcional) Agente DigitalPersona activo en `https://127.0.0.1:52181` con el lector U.are.U 4500 conectado.

### Pasos

```bash
# 1) Instalar dependencias (una sola vez)
npm install

# 2) Encender MySQL desde el Panel de control de XAMPP (boton Start en MySQL).
#    Opcional: crear la BD manualmente con el respaldo (si no, initDatabase la crea sola)
#    -> abrir phpMyAdmin -> importar database/schema.sql

# 3) Modo desarrollo (levanta backend :3001 + frontend :5173 + Electron juntos)
npm run dev
```

También puedes ejecutar las partes por separado:

```bash
npm run dev:server   # solo backend Express en :3001
npm run dev:client   # solo frontend Vite en :5173 (abrirlo en el navegador)
npm run dev:electron # espera ambos servidores y abre Electron
```

### Carpetas del ejecutable (.exe)

```bash
npm run build   # compila el frontend a dist/
npm run dist    # electron-builder -> release/Gym UES Setup.exe (target NSIS)
```

El instalador empaqueta `dist/`, `electron/`, `server/` y las dependencias de producción; los PDFs subidos se guardan en la carpeta de datos del usuario (escribible en producción).

---

## 4. Módulos y rutas de la API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login de admin (bcrypt) → devuelve token |
| POST | `/api/auth/logout` | Cierra sesión |
| GET | `/api/auth/me` | Verifica sesión |
| GET | `/api/students` | Listado (con `?q=` para buscar) |
| POST | `/api/students` | Registrar alumno/maestro/exterior |
| GET | `/api/students/:code` | Detalle por clave |
| PUT | `/api/students/:code` | Actualizar (requiere sesión) |
| DELETE | `/api/students/:code` | Eliminar (requiere sesión) |
| POST | `/api/attendance/check-in` | `{student_code, method}` o `{fingerprint_template}` |
| POST | `/api/attendance/check-out` | `{student_code}` |
| GET | `/api/attendance/today` | Registros del día |
| GET | `/api/attendance/count` | Conteo (total, entradas, salidas) |
| GET | `/api/attendance/range?desde&hasta` | Asistencia por fechas |
| GET | `/api/settings` | Configuración (reglamento, horarios, URLs PDF) |
| PUT | `/api/settings` | Guardar textos (requiere sesión) |
| GET | `/api/public/member/:code` | **Público:** ficha del miembro + últimas 5 asistencias (kiosco) |
| GET | `/api/public/count-today` | **Público:** conteos de asistencia del día (kiosco) |
| POST | `/api/public/registro` | **Público:** auto-registro del checador (alumno/maestro/exterior; límite 60/h por IP) |
| POST | `/api/uploads` | Subir PDF (multipart `file`, requiere sesión) |
| GET | `/api/fingerprint/capture` | Captura de huella (proxy → agente DigitalPersona) |
| GET | `/api/fingerprint/status` | Disponibilidad del agente |
| GET | `/api/fingerprint/sensors?q=` | Usuarios con estado de huella (panel Adaptación) |
| POST | `/api/fingerprint/verify` | Comprueba si la plantilla capturada pertenece a un registro |

> Detalle de `check-in` por huella: el backend busca en `students` el registro cuya `fingerprint_template` coincida con la captura (comparación JSON). Es la estrategia simplificada del proyecto; para un matcher biométrico real se integraría el motor del SDK en `server/routes/fingerprint.routes.js`. La lógica compartida vive en `server/huella.js` y se reutiliza en la verificación.
>
> **Sobre `server/db-map.js`:** es la única fuente de verdad de columnas por tabla; `students.routes.js` construye sus `INSERT`/`UPDATE` con `prepararInsert()`/`prepararUpdate()`, que únicamente admiten columnas mapeadas, normalizan valores y usan siempre placeholders `?`.

---

## 5. Pantallas

- **Checador (`/`)** — Reloj en tiempo real (cada segundo), entrada/salida SOLO para miembros registrados (se valida la clave contra la base de datos), botones de **Reglamento** y **Horarios**, tarjeta del miembro con foto/turno/carrera al checar, **contadores del día** en vivo, **"Consultar mi asistencia"** (historial público por clave), **módulo de "Auto-registro"** (modal público para alumnos, maestros y personas exteriores: expediente/clave, apellidos, turno, carrera, certificado médico validado por el encargado con PDF opcional y foto opcional; los 3 tipos se guardan en `students`) y **chatbot lateral** con respuestas predefinidas sobre rutinas, horarios y reglamento. Diseño responsive y compacto (cabe en pantallas de 1024×640).
- **Registro (`/registro`)** — Formulario único con pestañas **Alumno UES**, **Maestro (Mto)** y **Persona Exterior** (expediente/clave empleado o clave automática `GYM-XXXXXX`), certificado médico (PDF opcional) y foto opcional. Mismo componente (`FormularioRegistro`) que el modal del panel admin y el auto-registro del checador.
- **Asistencia (`/asistencia`)** — Tabla de registros por día o rango de fechas, conteos (total/entradas/salidas) y buscador por clave/nombre.
- **Admin (`/admin`)** — Login de pantalla completa (FormLogin) con logotipo `logo_ues.png`, chips de estado de BD y lector; panel (FormAdmin) con **header institucional fijo**: logotipo `logo_ues.png`, usuario autenticado en vivo, reloj en tiempo real y botón **Salir** que cierra sesión y regresa limpio al Login. Pestañas: **Gestión de Alumnos**, **Historial de Asistencias**, **Adaptación de Huella** (capturar/adaptar y verificar huellas reales por usuario) y **Configuración y Avisos** (reglamento/horarios, exclusiva de `super_admin`/`admin`). En Gestión de Alumnos hay un botón **"+ Agregar persona"** que abre un modal con el formulario según el tipo (alumno/maestro/exterior); cualquier rol administrador puede dar de alta personas para que chequen en el checador (los turnos/carreras de su rol solo restringen a alumnos de su scope).

## 6. Notas de seguridad

- `contextIsolation: true` y `nodeIntegration: false` en el `BrowserWindow`; el renderer solo accede a la API de `preload.cjs`.
- Consultas SQL parametrizadas con placeholders `?` en todo el backend.
- Validación de extensiones en subidas (solo `.pdf` y `.png/.jpg/.webp` en fotos) y límite de 20 MB.
- Las contraseñas se guardan **en texto plano por decisión del proyecto** (el admin las consulta en MySQL). El login acepta texto plano y bcrypt. Cambie la clave secreta por defecto (`gymues-2026`) con la variable de entorno `ADMIN_SECRET_KEY`.
- Las credenciales iniciales (`super_admin`, `admin`, `matutino`, `vespertino`, `jefecarrera`, `administradorgym`) usan la contraseña `admin123` y deben cambiarse en producción.

## 7. Empaquetado Electron (producción)

Al ejecutar la app empaquetada (`npm run build` → `.exe`), Electron crea un archivo `config.json` en el directorio de datos del usuario (`%APPDATA%/Gym UES/config.json`) con los valores por defecto de la conexión MySQL. Si el servidor MySQL no está en el puerto 3306 o usa credenciales distintas, edite ese archivo y reinicie la app.

| Campo          | Default     |
|----------------|-------------|
| `DB_HOST`      | `127.0.0.1` |
| `DB_PORT`      | `3306`      |
| `DB_USER`      | `root`      |
| `DB_PASSWORD`  | *(vacío)*   |
| `DB_NAME`      | `gym_ues_db`|
| `API_PORT`     | `3001`      |