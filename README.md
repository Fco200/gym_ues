# Sistema Gym UES

Sistema de control del **Gimnasio UES** (Universidad Estatal de Sonora): checador de asistencia, expedientes de alumnos, certificados médicos, reportes mensuales, horarios, reglamento y gestión de usuarios.

## Estructura

```
gym-ues-project/
├── backend/     → API (Node.js + Express 5 + MySQL) — puerto 4000
├── frontend/    → Aplicación web (React 19 + Vite) para administración
├── desktop/     → Checador de escritorio (Electron, modo kiosco)
├── package.json → Monorepo (npm workspaces) + scripts unificados
└── iniciar-sistema.bat → Arranque rápido en Windows (servidor + checador)
```

> **Un solo puerto en producción:** Express sirve la web y la API juntas en `http://localhost:4000`
> (la app web en `/` y el checador en `/checador`). Solo el modo de desarrollo usa dos puertos.

## Requisitos

- Node.js 20+ y npm 9+
- XAMPP (MySQL) con la base `gym_ues_db` (esquema en `backend/database.sql`)

## Configuración inicial

1. **Enciende XAMPP** y arranca el servicio de **MySQL**.
2. Copia los archivos de entorno de ejemplo:

   ```bash
   copy backend\.env.example backend\.env
   copy frontend\.env.example frontend\.env
   ```

3. Verifica `backend/.env` con los datos de tu MySQL (XAMPP usa por defecto el puerto **3306**):

   ```
   PORT=4000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=gym_ues_db
   ```

   > Si usas el MySQL de XAMPP, cambia `DB_PORT` a `3306`. El valor `3307` solo aplica si así lo configuraste.

4. Ejecuta `backend/database.sql` una sola vez (desde phpMyAdmin o consola) para tener el esquema y las cuentas iniciales:

   | Usuario | Correo | Contraseña | Rol |
   |---|---|---|---|
   | Super Admin | `admin@gymues.com` | `admin123` | super_admin |
   | Instructor mañana | `manana@gymues.com` | `manana123` | maestro_mañana |
   | Instructora tarde | `tarde@gymues.com` | `tarde123` | maestro_tarde |

5. Instala las dependencias:

   ```bash
   npm install
   ```

## Modo desarrollo

```bash
npm run dev
```

Levanta la **API** (`http://localhost:4000`) y la **web con recarga en vivo** (`http://localhost:5173`).

## Modo producción (un solo comando, un solo puerto)

```bash
npm start
```

Compila el frontend y lo sirve junto con la API en **`http://localhost:4000`**:

- Aplicación web → `http://localhost:4000`
- Checador web → `http://localhost:4000/checador`
- API → `http://localhost:4000/api`

## Checador de escritorio (kiosco siempre activo)

Con el servidor corriendo en el puerto 4000:

```bash
npm run desktop
```

- Abre el checador en **pantalla completa (modo kiosco)**.
- Si el servidor no responde, muestra una pantalla de espera con reloj y se **reconecta solo**.
- Salir del modo kiosco: `Ctrl + Alt + Q` (o `Ctrl + Shift + X`).
- Modo ventana (pruebas): `npm run desktop -- --windowed`.
- Apuntar al servidor de desarrollo Vite: `npm run desktop:dev`.

### Levantar TODO de una sola vez

```bash
npm run start:all
```

Compila, levanta el servidor y abre el kiosco. En Windows también puedes hacer doble clic en `iniciar-sistema.bat`.

### Arrancar el checador con Windows (arranque automático)

Activa el inicio automático del kiosco al encender la computadora:

```bash
npm run autostart:on
# desactivar:
npm run autostart:off
```

### Generar el instalador (.exe) del checador

```bash
npm run dist:desktop
```

El instalador queda en `desktop/dist/`. Instálalo en la computadora de la entrada del gimnasio.

### Arrancar el servidor como servicio (opcional, recomendado)

Con PM2 el servidor se reinicia solo si se cae y arranca con Windows:

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

## Publicar en GitHub (paso a paso)

1. **Inicializa el repositorio** (una sola vez, en la raíz del proyecto):

   ```bash
   git init
   git add .
   git commit -m "Sistema Gym UES listo para produccion"
   git branch -M main
   ```

   > `.gitignore` ya excluye `node_modules`, `dist`, `.env` y logs.

2. **Crea el repositorio en GitHub**: entra a [github.com/new](https://github.com/new), ponle nombre (por ejemplo `gym-ues-project`), déjalo vacío (sin README) y crea.

3. **Conecta y sube el proyecto** (reemplaza `TU-USUARIO`):

   ```bash
   git remote add origin https://github.com/TU-USUARIO/gym-ues-project.git
   git push -u origin main
   ```

4. **En otra computadora** clona el proyecto:

   ```bash
   git clone https://github.com/TU-USUARIO/gym-ues-project.git
   cd gym-ues-project
   npm install
   copy backend\.env.example backend\.env
   copy frontend\.env.example frontend\.env
   ```

5. A partir de ahí, cada cambio se sube con:

   ```bash
   git add .
   git commit -m "Descripcion del cambio"
   git push
   ```

> Los archivos `.env` **no se suben** (contienen la configuración local). Cada equipo crea el suyo a partir de `.env.example`.

## Funcionalidades

- Login, recuperación y cambio de contraseña (administradores e instructores).
- **Checador** de entrada/salida por número de expediente (web y de escritorio).
- **Expedientes de alumnos**: fotografía, carrera, turno, certificado médico (archivo + vigencia).
- **Historial del checador** por alumno y **reportes mensuales** con gráfica.
- Horarios por turno y reglamento en PDF.
- **Gestión de usuarios** (solo super administrador): crear/editar/eliminar administradores e instructores.
- Interfaz con iconos en todos los botones y animaciones en avisos y ventanas.

## Comandos útiles

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo: API + web con recarga |
| `npm start` | Producción: web + API en el puerto 4000 |
| `npm run start:all` | Producción + checador kiosco |
| `npm run desktop` | Solo el checador de escritorio |
| `npm run dist:desktop` | Instalador `.exe` del checador |
| `npm run autostart:on` | Arrancar el checador con Windows |
| `npm run build` | Compila el frontend |
| `npm run lint` | Lint del frontend |