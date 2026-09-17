const express = require('express');
const router = express.Router();
const {
  registerAttendance,
  getAttendanceRecords,
  getMonthlyReports
} = require('../controllers/attendance.controller');

// Ruta para que el alumno marque entrada/salida
router.post('/check', registerAttendance);

// Ruta para que los administradores/maestros consulten las sesiones de los alumnos
router.get('/', getAttendanceRecords);

// Reporte mensual por turnos
router.get('/reports/monthly', getMonthlyReports);

module.exports = router;