/**
 * Gym UES - Subida de archivos con multer a server/uploads/.
 * Acepta PDFs (certificados/reglamento) e imagenes (fotografias de perfil).
 * Devuelve la URL publica /uploads/<archivo>. Sin autenticacion para que el
 * registro del kiosco (flujo abierto) pueda adjuntar foto y certificado.
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const esImagen = (file.mimetype || '').startsWith('image/');
    const base = `${esImagen ? 'img' : 'doc'}_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname || '').toLowerCase() || (esImagen ? '.jpg' : '.pdf');
    cb(null, `${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype || '';
    const ext = path.extname(file.originalname || '').toLowerCase();
    const esPdf = mime === 'application/pdf' || ext === '.pdf';
    const esImagen = mime.startsWith('image/') && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    if (!esPdf && !esImagen) {
      return cb(new Error('Solo se permiten archivos PDF o imagenes (JPG/PNG/WebP).'));
    }
    cb(null, true);
  }
});

// POST /api/uploads - sube un PDF o una imagen y devuelve su URL publica
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ mensaje: err.message || 'Error al subir el archivo.' });
    }
    if (!req.file) {
      return res.status(400).json({ mensaje: 'No se recibio ningun archivo.' });
    }
    const url = `/uploads/${req.file.filename}`;
    const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
    res.status(201).json({
      mensaje: 'Archivo subido correctamente.',
      url,
      urlCompleta: `${baseUrl}${url}`,
      nombre: req.file.originalname
    });
  });
});

module.exports = router;