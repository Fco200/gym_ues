const pool = require('../config/db');

const VALID_KEYS = ['reglamento_pdf', 'horario_pdf', 'reglamento_text', 'horario'];

// Obtener todas las configuraciones como un objeto { clave: valor }
const getSettings = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value FROM settings ORDER BY setting_key ASC'
    );
    const settings = {};
    rows.forEach((row) => {
      const key = row.setting_key;
      let value = row.setting_value;
      if (key === 'horario') {
        try { value = JSON.parse(row.setting_value); } catch { value = null; }
      }
      settings[key] = value;
    });
    res.json(settings);
  } catch (error) {
    console.error('Error al obtener configuraciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Guardar o actualizar el valor de una configuración
const updateSetting = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  try {
    if (!VALID_KEYS.includes(key)) {
      return res.status(400).json({ error: 'Clave de configuración no válida' });
    }

    let stored = value;
    if (typeof value === 'object' && value !== null) {
      stored = JSON.stringify(value);
    }
    if (stored === undefined || stored === null) stored = '';

    await pool.query(
      `INSERT INTO settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, String(stored)]
    );

    const [updated] = await pool.query(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      [key]
    );

    let result = updated[0]?.setting_value ?? null;
    if (key === 'horario') {
      try { result = JSON.parse(result); } catch { result = null; }
    }

    res.json({ key, value: result, message: 'Configuración guardada correctamente.' });
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Subir un PDF de documento oficial (reglamento u horario)
const uploadSettingDocument = async (req, res) => {
  const { key } = req.params;

  try {
    if (!VALID_KEYS.includes(key) || (key !== 'reglamento_pdf' && key !== 'horario_pdf')) {
      return res.status(400).json({ error: 'Clave no válida para subir documento' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Adjunta un archivo PDF' });
    }

    const value = `/uploads/${req.file.filename}`;

    await pool.query(
      `INSERT INTO settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value]
    );

    res.json({ key, value, message: 'Documento subido correctamente.' });
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ error: 'Error interno al subir el documento' });
  }
};

module.exports = { getSettings, updateSetting, uploadSettingDocument };