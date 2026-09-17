const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSetting,
  uploadSettingDocument
} = require('../controllers/settings.controller');
const { upload } = require('../middlewares/upload');

// Configuraciones del sistema (documentos y horario)
router.get('/', getSettings);
router.put('/:key', updateSetting);

// Subir PDF de reglamento u horario
router.post('/:key/pdf', upload.single('document'), uploadSettingDocument);

module.exports = router;