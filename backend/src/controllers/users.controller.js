const pool = require('../config/db');

const VALID_TURNS = ['mañana', 'tarde', 'general'];

// Listar todos los usuarios del sistema
const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, role, turn, created_at
       FROM users
       ORDER BY FIELD(role, 'super_admin') DESC, turn ASC, name ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear un nuevo administrador o instructor
const createUser = async (req, res) => {
  const { name, email, password, role, turn } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese correo' });
    }

    // Derivar el rol según el tipo y el turno
    let finalRole;
    let finalTurn;
    if (role === 'super_admin') {
      finalRole = 'super_admin';
      finalTurn = 'general';
    } else {
      const selectedTurn = (turn || '').toLowerCase();
      if (!VALID_TURNS.includes(selectedTurn) || selectedTurn === 'general') {
        return res.status(400).json({ error: 'Un instructor debe tener un turno asignado (mañana o tarde)' });
      }
      finalRole = `maestro_${selectedTurn}`;
      finalTurn = selectedTurn;
    }

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role, turn)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), normalizedEmail, password, finalRole, finalTurn]
    );

    res.status(201).json({
      message: 'Usuario creado correctamente',
      user: {
        id: result.insertId,
        name: name.trim(),
        email: normalizedEmail,
        role: finalRole,
        turn: finalTurn
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar datos de un usuario (nombre, correo, contraseña, rol, turno)
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role, turn } = req.body;

  try {
    if (!id) {
      return res.status(400).json({ error: 'Falta el identificador del usuario' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const current = users[0];

    if (email && email.trim().toLowerCase() !== current.email) {
      const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ?', [
        email.trim().toLowerCase(),
        id
      ]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Ese correo ya está registrado con otro usuario' });
      }
    }

    if (password && String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Determinar el rol final
    const requestedRole = role || current.role;
    let finalRole = requestedRole;
    let finalTurn = turn || current.turn;

    if (requestedRole === 'super_admin') {
      finalRole = 'super_admin';
      finalTurn = 'general';
    } else if (requestedRole === 'maestro' || requestedRole === `maestro_${current.turn}` || requestedRole.startsWith('maestro')) {
      const selectedTurn = (turn || current.turn || '').toLowerCase();
      if (!VALID_TURNS.includes(selectedTurn) || selectedTurn === 'general') {
        return res.status(400).json({ error: 'Un instructor debe tener un turno asignado (mañana o tarde)' });
      }
      finalRole = `maestro_${selectedTurn}`;
      finalTurn = selectedTurn;
    }

    await pool.query(
      `UPDATE users SET
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         password = COALESCE(?, password),
         turn = ?,
         role = ?
       WHERE id = ?`,
      [name || null, email ? email.trim().toLowerCase() : null, password || null, finalTurn, finalRole, id]
    );

    const [updated] = await pool.query('SELECT id, name, email, role, turn, created_at FROM users WHERE id = ?', [id]);

    res.json({
      message: 'Usuario actualizado correctamente.',
      user: updated[0]
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar un usuario
const deleteUser = async (req, res) => {
  const { id } = req.params;
  const currentUserId = Number(req.get('X-User-Id'));

  try {
    if (!id) {
      return res.status(400).json({ error: 'Falta el identificador del usuario' });
    }

    if (currentUserId && Number(id) === currentUserId) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No permitir eliminar el último super administrador
    if (users[0].role === 'super_admin') {
      const [admins] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE role = ?', ['super_admin']);
      if (Number(admins[0].total) <= 1) {
        return res.status(400).json({ error: 'No se puede eliminar el último super administrador del sistema' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };