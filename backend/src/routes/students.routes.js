const express = require('express');
const router = express.Router();
const {
  createStudent,
  getStudents,
  updateStudent,
  updateMedicalCertificate,
  deleteStudent
} = require('../controllers/students.controller');
const { upload } = require('../middlewares/upload');

const FIELDS = [
  { name: 'image', maxCount: 1 },
  { name: 'certificate', maxCount: 1 }
];

router.post('/', upload.fields(FIELDS), createStudent);
router.get('/', getStudents);

// Expediente del alumno (acepta imagen y/o certificado opcionales)
router.patch('/:id', upload.fields(FIELDS), updateStudent);

// Estatus del certificado médico
router.patch('/:id/medical-certificate', updateMedicalCertificate);

// Eliminar alumno
router.delete('/:id', deleteStudent);

module.exports = router;