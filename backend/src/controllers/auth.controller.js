const pool = require('../config/db');

// Controlador para el inicio de sesión
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validar que manden correo y contraseña
    if (!email || !password) {
      return res.status(400).json({ error: 'Por favor, ingresa el correo y la contraseña' });
    }

    // Buscar al usuario en la base de datos
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas (Usuario no encontrado)' });
    }

    const user = rows[0];

    // Verificar contraseña (por ahora texto plano, luego lo mejoramos con hash)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Credenciales incorrectas (Contraseña errónea)' });
    }

    // Login exitoso
    res.json({
      message: '¡Bienvenido al Sistema Gym UES!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        turn: user.turn
      }
    });

  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Paso 1 de recuperación de contraseña: verificar que el correo existe
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: 'Por favor ingresa tu correo institucional' });
    }

    const [rows] = await pool.query('SELECT id, name FROM users WHERE email = ?', [email.trim().toLowerCase()]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró ninguna cuenta con ese correo' });
    }

    res.json({
      message: `Hola ${rows[0].name}, ahora puedes restablecer tu contraseña.`,
      resetAllowed: true
    });
  } catch (error) {
    console.error('Error en recuperación de contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Paso 2 de recuperación: establecer la nueva contraseña
const resetPassword = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan datos: correo y nueva contraseña' });
    }

    const [result] = await pool.query('UPDATE users SET password = ? WHERE email = ?', [
      password,
      email.trim().toLowerCase()
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No se encontró ninguna cuenta con ese correo' });
    }

    res.json({ message: 'Contraseña actualizada correctamente, ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar datos del perfil (nombre, correo, contraseña, turno del maestro)
const updateProfile = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, turn } = req.body;

  try {
    if (!id) {
      return res.status(400).json({ error: 'Falta el identificador del usuario' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const current = users[0];

    // Si cambian el correo, verificar que no esté en uso por otro usuario
    if (email && email.trim().toLowerCase() !== current.email) {
      const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ?', [
        email.trim().toLowerCase(),
        id
      ]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Ese correo ya está registrado con otro usuario' });
      }
    }

    // Si un maestro cambia de turno, el rol también debe reflejar el nuevo turno
    let newRole = current.role;
    if (turn && current.role && current.role.startsWith('maestro')) {
      newRole = `maestro_${turn}`;
    }

    await pool.query(
      `UPDATE users SET
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         password = COALESCE(?, password),
         turn = COALESCE(?, turn),
         role = ?
       WHERE id = ?`,
      [name || null, email ? email.trim().toLowerCase() : null, password || null, turn || null, newRole, id]
    );

    const [updated] = await pool.query('SELECT id, name, email, role, turn FROM users WHERE id = ?', [id]);

    res.json({
      message: 'Perfil actualizado correctamente.',
      user: updated[0]
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Cambiar contraseña desde el perfil (valida la contraseña actual)
const changePassword = async (req, res) => {
  const { id, currentPassword, newPassword } = req.body;

  try {
    if (!id || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Faltan datos: usuario, contraseña actual y nueva contraseña' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (rows[0].password !== currentPassword) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    await pool.query('UPDATE users SET password = ? WHERE id = ?', [newPassword, id]);

    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login, forgotPassword, resetPassword, updateProfile, changePassword };