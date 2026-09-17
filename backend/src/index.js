const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

const HOST_IP = require('os').networkInterfaces();
const LOCAL_IP = Object.values(HOST_IP)
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address || 'localhost';

app.use(cors());
app.use(express.json());

// Archivos estáticos (fotografías de alumnos subidas al servidor)
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Rutas de la API
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/students.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const userRoutes = require('./routes/users.routes');

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/users', userRoutes);

// En producción, Express también sirve el frontend construido (SPA)
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const hasFrontend = fs.existsSync(frontendDist);

if (hasFrontend) {
  app.use(express.static(frontendDist));
  // Toda ruta que no pertenezca a la API devuelve la aplicación (React Router)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // Sin frontend construido (solo API), ruta de prueba
  app.get('/', (req, res) => {
    res.json({ message: '¡API del Sistema Gym UES funcionando correctamente! 🚀' });
  });
}

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log('──────────────────────────────────────────────────────────────');
  console.log(`  🏋️  Sistema Gym UES`);
  console.log(`  API ............ http://localhost:${PORT}/api`);
  console.log(`  Aplicación web .. http://localhost:${PORT}${hasFrontend ? '' : '  (ejecuta "npm run build" para servirla)'}`);
  console.log(`  Red local ...... http://${LOCAL_IP}:${PORT}`);
  console.log('──────────────────────────────────────────────────────────────');
});