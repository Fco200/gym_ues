const express = require('express');
const router = express.Router();
const {
  login,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword
} = require('../controllers/auth.controller');

// Ruta POST para el login
router.post('/login', login);

// Flujo de recuperación de contraseña
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Cambio de contraseña desde el perfil
router.post('/change-password', changePassword);

// Actualizar datos del perfil del usuario
router.patch('/:id/profile', updateProfile);

module.exports = router;