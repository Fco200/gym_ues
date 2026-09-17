# Sistema Gym UES

Sistema de control del **Gimnasio UES** (Universidad Estatal de Sonora): checador de asistencia, expedientes de alumnos, certificados médicos, reportes mensuales, horarios, reglamento y gestión de usuarios.

## Estructura

```
gym-ues-project/
├── backend/     → API (Node.js + Express 5 + MySQL) en el puerto 4000
├── frontend/    → Aplicación web (React 19 + Vite) para administración
├── desktop/     → Checador de escritorio (Electron, modo kiosco)
└── package.json → Monorepo (npm workspaces) + scripts unificados
```

## Requisitos

- Node.js 20+ y npm 9+
- MySQL (phpMyAdmin/XAMPP) con la base `gym_ues_db` (esquema en `backend/database.sql`)

## Configuración inicial

En `backend/.env` ajusta tu base de datos (por defecto: `localhost:3307`, usuario `root`, sin contraseña):

```
PORT=4000
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=gym_ues_db
```

Ejecuta `backend/database.sql` una sola vez para tener el esquema y las cuentas iniciales:

| Usuario | Correo | Contraseña | Rol |
|---|---|---|---|
| Super Admin | `admin@gymues.com` | `admin123` | super_admin |
| Instructor mañana | `manana@gymues.com` | `manana123` | maestro_mañana |
| Instructora tarde | `tarde@gymues.com` | `tarde123` | maestro_tarde |

## Comandos (desde la raíz del proyecto)

### Un solo comando, todo en marcha (desarrollo)

```bash
npm run dev
```

Levanta la **API** (`http://localhost:4000`) y la **web** (`http://localhost:5173`) al mismo tiempo.

### Producción (un solo puerto, Express sirve todo)

```bash
npm start
```

Compila el frontend y lo sirve Express en `http://localhost:4000` (la app web y la API comparten puerto). Acceso a la web: `http://localhost:4000` · Checador: `http://localhost:4000/checador`.

### Checador de escritorio (kiosco siempre activo)

```bash
npm start
# en otra terminal…
npm run desktop
```

- Lanza Electron en **pantalla completa** conectado a `http://localhost:4000/checador`.
- Si el servidor no responde, muestra una pantalla de espera con reloj y se reconecta automáticamente.
- Salir del modo kiosco: `Ctrl + Alt + Q` (o `Ctrl + Shift + X`).
- En modo ventana: `npm run desktop -- --windowed`.
- Apuntarlo al servidor de desarrollo Vite: `npm run desktop:dev`.

### Empaquetar el instalador de Windows (.exe) del checador

```bash
npm run dist:desktop
```

Genera el instalador en `desktop/dist/`.

### Otros

| Comando | Descripción |
|---|---|
| `npm run dev:client` | Solo el frontend (Vite) |
| `npm run dev:server` | Solo el backend (nodemon) |
| `npm run build` | Compila el frontend |
| `npm run lint` | Lint del frontend |

## Funcionalidades

- Login, recuperación y cambio de contraseña (administradores e instructores).
- **Checador** de entrada/salida por número de expediente (web y de escritorio).
- **Expedientes de alumnos**: fotografía, carrera, turno, certificado médico (archivo + vigencia).
- **Historial del checador** por alumno y **reportes mensuales** con gráfica.
- Horarios por turno y reglamento en PDF.
- **Gestión de usuarios** (solo super administrador): crear/editar/eliminar administradores e instructores.


echo "# gym_ues" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/Fco200/gym_ues.git
git push -u origin main