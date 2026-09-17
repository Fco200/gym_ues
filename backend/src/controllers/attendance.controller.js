const pool = require('../config/db');

// Registrar entrada o salida de un alumno
const registerAttendance = async (req, res) => {
  const { student_number, type } = req.body; // type: 'entrada' o 'salida'

  try {
    if (!student_number || !type) {
      return res.status(400).json({ error: 'Faltan datos (número de alumno o tipo de registro)' });
    }

    const validTypes = ['entrada', 'salida'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'El tipo de registro debe ser entrada o salida' });
    }

    // Buscar al alumno por su número de expediente/identificador
    const [students] = await pool.query('SELECT * FROM students WHERE student_number = ?', [student_number.trim()]);

    if (students.length === 0) {
      return res.status(404).json({ error: 'Alumno no encontrado en el sistema' });
    }

    const student = students[0];

    // Registrar la asistencia
    await pool.query(
      'INSERT INTO attendance (student_id, type, timestamp) VALUES (?, ?, NOW())',
      [student.id, type]
    );

    const fullName = `${student.name} ${student.apellido_paterno || ''} ${student.apellido_materno || ''}`.replace(/\s+/g, ' ').trim();

    const typeLabel = student.member_type === 'mto'
      ? 'MTO'
      : student.member_type === 'externo'
        ? 'Persona externa'
        : 'Alumno';

    res.json({
      message: `¡${type.charAt(0).toUpperCase() + type.slice(1)} registrada con éxito!`,
      student: {
        student_number: student.student_number,
        name: fullName,
        turn: student.turn,
        member_type: student.member_type || 'estudiante',
        type_label: typeLabel,
        image_url: student.image_url || null,
        medical_certificate: Boolean(student.medical_certificate)
      }
    });

  } catch (error) {
    console.error('Error en el checador:', error);
    res.status(500).json({ error: 'Error interno al registrar la asistencia' });
  }
};

// Obtener historial de asistencias (filtrable por turno, fecha y/o número de expediente)
const getAttendanceRecords = async (req, res) => {
  const { turn, date, student_number } = req.query; // Puedes filtrar por turno, fecha y/o alumno

  try {
    let query = `
      SELECT a.id, s.student_number, s.name, s.apellido_paterno, s.apellido_materno,
             s.lastname, s.turn, a.type, a.timestamp
      FROM attendance a
      JOIN students s ON a.student_id = s.id
    `;
    let params = [];
    let conditions = [];

    if (turn) {
      conditions.push('s.turn = ?');
      params.push(turn);
    }

    if (date) {
      conditions.push('DATE(a.timestamp) = ?');
      params.push(date);
    }

    if (student_number && String(student_number).trim()) {
      conditions.push('s.student_number = ?');
      params.push(String(student_number).trim());
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY a.timestamp DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);

  } catch (error) {
    console.error('Error al obtener asistencias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Reporte mensual: resumen por turno, detalle por alumno y actividad diaria
const getMonthlyReports = async (req, res) => {
  const { month, turn } = req.query; // month: 'YYYY-MM', turn opcional

  try {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'El mes debe tener el formato YYYY-MM' });
    }

    // Resumen por turno (con filtro opcional por turno)
    let summaryQuery = `
      SELECT s.turn,
             COUNT(DISTINCT a.student_id) AS alumnos_activos,
             SUM(CASE WHEN a.type = 'entrada' THEN 1 ELSE 0 END) AS entradas,
             SUM(CASE WHEN a.type = 'salida' THEN 1 ELSE 0 END) AS salidas,
             COUNT(a.id) AS asistencias
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE DATE_FORMAT(a.timestamp, '%Y-%m') = ?
    `;
    const summaryParams = [month];

    if (turn) {
      summaryQuery += ' AND s.turn = ?';
      summaryParams.push(turn);
    }

    summaryQuery += ' GROUP BY s.turn ORDER BY s.turn ASC';

    const [summary] = await pool.query(summaryQuery, summaryParams);

    // Detalle por alumno (con su turno), opcionalmente filtrado por turno
    let detailQuery = `
      SELECT s.id, s.student_number, s.name, s.lastname, s.turn, s.medical_certificate,
             COUNT(a.id) AS asistencias,
             SUM(CASE WHEN a.type = 'entrada' THEN 1 ELSE 0 END) AS entradas,
             SUM(CASE WHEN a.type = 'salida' THEN 1 ELSE 0 END) AS salidas
      FROM students s
      LEFT JOIN attendance a
        ON a.student_id = s.id AND DATE_FORMAT(a.timestamp, '%Y-%m') = ?
    `;
    const params = [month];

    if (turn) {
      detailQuery += ' WHERE s.turn = ?';
      params.push(turn);
    }

    detailQuery += ' GROUP BY s.id ORDER BY s.turn ASC, s.name ASC';

    const [students] = await pool.query(detailQuery, params);

    // Actividad diaria del mes (para la gráfica)
    const [daily] = await pool.query(
      `SELECT DATE_FORMAT(a.timestamp, '%Y-%m-%d') AS day, s.turn,
              SUM(CASE WHEN a.type = 'entrada' THEN 1 ELSE 0 END) AS entradas,
              SUM(CASE WHEN a.type = 'salida' THEN 1 ELSE 0 END) AS salidas
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE DATE_FORMAT(a.timestamp, '%Y-%m') = ?
       GROUP BY day, s.turn
       ORDER BY day ASC`,
      [month]
    );

    // Totales generales
    let total = { alumnos: 0, asistencias: 0, entradas: 0, salidas: 0, alumnos_activos: 0 };
    summary.forEach((s) => {
      total.asistencias += Number(s.asistencias) || 0;
      total.entradas += Number(s.entradas) || 0;
      total.salidas += Number(s.salidas) || 0;
      total.alumnos_activos += Number(s.alumnos_activos) || 0;
    });

    res.json({ month, summary, students, daily, total });
  } catch (error) {
    console.error('Error al generar reporte mensual:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { registerAttendance, getAttendanceRecords, getMonthlyReports };