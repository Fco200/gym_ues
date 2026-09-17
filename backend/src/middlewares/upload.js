const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurable por variable de entorno (en Render se apunta al disco persistente)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');

// Garantizar que el directorio de subidas exista
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${safeExt}`);
  }
});

const fileFilter = (req, file, cb) => {
  // El certificado puede ser PDF o cualquier extensión de documento
  if (file.fieldname === 'certificate') {
    cb(null, true);
    return;
  }
  // La foto debe ser una imagen
  if (file.fieldname === 'image' && file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
    return;
  }
  cb(new Error('Solo se permiten imágenes en la foto y PDF/documentos en el certificado'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB máximo por archivo
});

module.exports = { upload, UPLOADS_DIR };