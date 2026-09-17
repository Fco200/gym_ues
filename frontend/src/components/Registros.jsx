import { useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from './common/Modal';
import ConfirmModal from './common/ConfirmModal';
import Icon from './common/Icon';

const TURNS = ['mañana', 'tarde'];
const GENDERS = ['Masculino', 'Femenino'];
const OTHER_CAREER = '__otra__';

const CAREERS = [
  'Licenciatura en Administración de Empresas',
  'Licenciatura en Ciencias de la Comunicación',
  'Licenciatura en Contaduría Pública',
  'Licenciatura en Derecho',
  'Licenciatura en Educación Física y Deporte',
  'Licenciatura en Gastronomía',
  'Licenciatura en Nutrición',
  'Licenciatura en Psicología',
  'Licenciatura en Trabajo Social',
  'Ingeniería en Tecnología Ambiental',
  'Ingeniería en Tecnología de Software',
  'Ingeniería en Tecnología Industrial'
];

function normalizeTurn(raw) {
  const value = String(raw || '').toLowerCase();
  if (value.startsWith('t')) return 'tarde';
  return 'mañana';
}

function fullName(s) {
  return [s?.name, s?.apellido_paterno, s?.apellido_materno].filter(Boolean).join(' ').trim();
}

function fileExt(file) {
  const match = String(file || '').match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toUpperCase() : 'ARCHIVO';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  const d = date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const t = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return `${d} · ${t}`;
}

export default function Registros() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'super_admin';

  const [students, setStudents] = useState([]);
  const [expedienteQ, setExpedienteQ] = useState('');
  const [nameQ, setNameQ] = useState('');
  const [turn, setTurn] = useState(isSuperAdmin ? 'todos' : user.turn);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [toast, setToast] = useState('');

  const fetchStudents = async (selectedTurn) => {
    setLoading(true);
    setError('');
    try {
      const query = selectedTurn && selectedTurn !== 'todos' ? `?turn=${encodeURIComponent(selectedTurn)}` : '';
      const response = await api.get(`/students${query}`);
      setStudents(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible cargar los alumnos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(turn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSuperAdmin && user.turn && user.turn !== turn) {
      handleTurnChange(user.turn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.turn]);

  const handleTurnChange = (value) => {
    setTurn(value);
    fetchStudents(value);
  };

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const filtered = useMemo(() => {
    const exp = expedienteQ.trim().toLowerCase();
    const nam = nameQ.trim().toLowerCase();
    return students.filter((s) => {
      const matchesExp = !exp || (s.student_number || '').toLowerCase().includes(exp);
      const haystack = [s.name, s.apellido_paterno, s.apellido_materno, s.lastname]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesName = !nam || haystack.includes(nam);
      return matchesExp && matchesName;
    });
  }, [students, expedienteQ, nameQ]);

  const toggleCertificate = async (student) => {
    try {
      const response = await api.patch(`/students/${student.id}/medical-certificate`, {
        medical_certificate: !student.medical_certificate
      });
      setStudents((prev) => prev.map((s) => (s.id === student.id ? response.data.student : s)));
    } catch (err) {
      alert(err.response?.data?.error || 'No fue posible actualizar el certificado');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="section-title">Registros de alumnos</h2>
          <p className="section-subtitle">
            {isSuperAdmin
              ? 'Control global de los expedientes del gimnasio (ambos turnos).'
              : `Expedientes del turno de la ${user.turn}.`}
          </p>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="filters">
          <div className="segmented">
            <button type="button" className={turn === 'todos' ? 'active' : ''} onClick={() => handleTurnChange('todos')}>
              Todos los turnos
            </button>
            {TURNS.map((option) => (
              <button
                key={option}
                type="button"
                className={turn === option ? 'active' : ''}
                onClick={() => handleTurnChange(option)}
              >
                Turno {option}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Listado de estudiantes ({filtered.length})</div>
            <div className="card-muted">
              {isSuperAdmin && turn === 'todos' ? 'Turnos mañana y tarde' : `Turno de la ${normalizeTurn(turn)}`}
              {' · Haz clic en una fila para ver el expediente'}
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {loading ? (
          <div className="empty-state">Cargando alumnos…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            No hay alumnos registrados que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Número expediente</th>
                  <th>Nombre</th>
                  <th>Apellido paterno</th>
                  <th>Apellido materno</th>
                  <th>Sexo</th>
                  <th>Certificado médico</th>
                  <th>Foto del alumno</th>
                  <th className="cell-numeric">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id} onClick={() => setViewing(student)} style={{ cursor: 'pointer' }}>
                    <td><strong>{student.student_number}</strong></td>
                    <td>{student.name}</td>
                    <td>{student.apellido_paterno || '—'}</td>
                    <td>{student.apellido_materno || '—'}</td>
                    <td>{student.gender}</td>
                    <td>
                      <div className="cert-cell">
                        {student.certificate_file ? (
                          <a
                            className="file-badge"
                            href={assetUrl(student.certificate_file)}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir archivo del certificado"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {fileExt(student.certificate_file)} · abrir
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M14 4h6v6m-1-5L10 14M18 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-soft">Sin archivo</span>
                        )}
                        <button
                          type="button"
                          className={`cert-toggle ${student.medical_certificate ? 'on' : 'off'}`}
                          onClick={(e) => { e.stopPropagation(); toggleCertificate(student); }}
                          title="Cambiar estatus del certificado"
                        >
                          <span className="dot" />
                          {student.medical_certificate ? 'Vigente' : 'No vigente'}
                        </button>
                      </div>
                    </td>
                    <td>
                      {student.image_url ? (
                        <img className="avatar" src={assetUrl(student.image_url)} alt={fullName(student)} />
                      ) : (
                        <span className="avatar">{(student.name || '?')[0]}</span>
                      )}
                    </td>
                    <td className="cell-numeric">
                      <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-action"
                          title="Ver expediente del alumno"
                          onClick={(e) => { e.stopPropagation(); setViewing(student); }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Ver
                        </button>
                        <button
                          type="button"
                          className="btn-action"
                          title="Ver historial del checador"
                          onClick={(e) => { e.stopPropagation(); setHistoryStudent(student); }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Historial
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card search-bar-card">
        <div className="search-bar">
          <input
            className="input"
            type="search"
            placeholder="Buscar por número de expediente…"
            value={expedienteQ}
            onChange={(e) => setExpedienteQ(e.target.value)}
          />
          <input
            className="input"
            type="search"
            placeholder="Buscar por nombre o apellidos…"
            value={nameQ}
            onChange={(e) => setNameQ(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setExpedienteQ(''); setNameQ(''); }}
          >
            <Icon name="refresh" size={16} />
            Limpiar búsqueda
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { setEditing(null); setFormOpen(true); }}
          >
            <Icon name="plus" />
            Agregar alumno
          </button>
        </div>
      </div>

      {toast && (
        <div className="toast" role="status">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {toast}
        </div>
      )}

      {formOpen && (
        <StudentFormModal
          student={editing}
          defaultTurn={user.turn}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            showToast(editing ? 'Expediente actualizado con éxito' : 'Alumno creado con éxito');
            fetchStudents(turn);
          }}
        />
      )}

      {viewing && (
        <StudentDetailModal
          student={viewing}
          onClose={() => setViewing(null)}
          onEdit={(s) => { setViewing(null); setEditing(s); setFormOpen(true); }}
          onDelete={(s) => { setViewing(null); setDeleting(s); }}
        />
      )}

      {historyStudent && (
        <HistoryModal student={historyStudent} onClose={() => setHistoryStudent(null)} />
      )}

      {deleting && (
        <ConfirmModal
          title="Eliminar alumno"
          message={`¿Seguro que deseas eliminar el expediente de ${fullName(deleting)} (${deleting.student_number})? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar expediente"
          onConfirm={async () => {
            try {
              await api.delete(`/students/${deleting.id}`);
              setStudents((prev) => prev.filter((s) => s.id !== deleting.id));
              setDeleting(null);
              showToast('Alumno eliminado');
            } catch (err) {
              alert(err.response?.data?.error || 'Error al eliminar el alumno');
            }
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function StudentDetailModal({ student, onClose, onEdit, onDelete }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get('/attendance', { params: { student_number: student.student_number } })
      .then((res) => { if (active) setRecords(res.data); })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'No fue posible cargar el historial'); });
    return () => { active = false; };
  }, [student.student_number]);

  return (
    <Modal title="Expediente del alumno" onClose={onClose}>
      <div className="detail-layout">
        <div className="detail-photo">
          {student.image_url ? (
            <img className="avatar detail-avatar" src={assetUrl(student.image_url)} alt="Fotografía del alumno" />
          ) : (
            <span className="avatar detail-avatar">{(student.name || '?')[0]}</span>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-name">{fullName(student)}</div>
          <ul className="detail-list">
            <li>
              <span>Número de ingreso</span>
              <strong>{student.student_number}</strong>
            </li>
            <li>
              <span>Fecha de registro</span>
              <strong>{formatDate(student.created_at)}</strong>
            </li>
            <li>
              <span>Carrera</span>
              <strong>{student.career || '—'}</strong>
            </li>
            <li>
              <span>Sexo</span>
              <strong>{student.gender}</strong>
            </li>
            <li>
              <span>Turno</span>
              <strong>Turno de la {normalizeTurn(student.turn)}</strong>
            </li>
            <li>
              <span>Certificado médico</span>
              <strong style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {student.certificate_file ? (
                  <a className="file-badge" href={assetUrl(student.certificate_file)} target="_blank" rel="noreferrer">
                    {fileExt(student.certificate_file)} · abrir
                  </a>
                ) : (
                  <span className="text-soft">Sin archivo</span>
                )}
                <span className={`cert-toggle ${student.medical_certificate ? 'on' : 'off'}`}>
                  <span className="dot" />
                  {student.medical_certificate ? 'Vigente' : 'No vigente'}
                </span>
              </strong>
            </li>
          </ul>
        </div>
      </div>

      <div className="detail-section">
        <h4>Fechas y horas de entrada y salida</h4>
        {error ? (
          <div className="alert alert-error">{error}</div>
        ) : !records ? (
          <div className="empty-state" style={{ padding: '18px' }}>Cargando historial…</div>
        ) : records.length === 0 ? (
          <div className="empty-state" style={{ padding: '18px' }}>
            Este alumno aún no tiene registros en el checador.
          </div>
        ) : (
          <div className="history-list history-scroll">
            {records.map((record) => (
              <div className="history-row" key={record.id}>
                <span className={`badge ${record.type === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                  {record.type === 'entrada' ? 'Entrada' : 'Salida'}
                </span>
                <span className="history-date">
                  {new Date(record.timestamp).toLocaleDateString('es-MX', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </span>
                <span className="history-time">
                  {new Date(record.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-actions" style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          <Icon name="x" size={16} />
          Cerrar
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(student)}>
          <Icon name="trash" size={16} />
          Eliminar
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onEdit(student)}>
          <Icon name="edit" size={16} />
          Editar expediente
        </button>
      </div>
    </Modal>
  );
}

function HistoryModal({ student, onClose }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get('/attendance', { params: { student_number: student.student_number } })
      .then((res) => { if (active) setRecords(res.data); })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'No fue posible cargar el historial'); });
    return () => { active = false; };
  }, [student.student_number]);

  const summary = useMemo(() => {
    if (!records) return null;
    return {
      total: records.length,
      entradas: records.filter((r) => r.type === 'entrada').length,
      salidas: records.filter((r) => r.type === 'salida').length
    };
  }, [records]);

  return (
    <Modal title={`Historial del checador · ${student.student_number}`} onClose={onClose} size="lg">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        {student.image_url ? (
          <img className="avatar" style={{ width: 52, height: 52 }} src={assetUrl(student.image_url)} alt="" />
        ) : (
          <span className="avatar" style={{ width: 52, height: 52 }}>{(student.name || '?')[0]}</span>
        )}
        <div>
          <div className="card-title">{fullName(student)}</div>
          <div className="card-muted">
            {student.gender} · Turno de la {normalizeTurn(student.turn)}
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-error">{error}</div>
      ) : !records ? (
        <div className="empty-state">Cargando historial…</div>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">Registros</div>
              <div className="stat-value">{summary.total}</div>
            </div>
            <div className="stat-card" style={{ background: 'linear-gradient(140deg,#eef7ef,#fff)' }}>
              <div className="stat-label">Entradas</div>
              <div className="stat-value">{summary.entradas}</div>
            </div>
            <div className="stat-card" style={{ background: 'linear-gradient(140deg,#fdeeee,#fff)' }}>
              <div className="stat-label">Salidas</div>
              <div className="stat-value">{summary.salidas}</div>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="empty-state">Este alumno aún no tiene registros en el checador.</div>
          ) : (
            <div className="history-list">
              {records.map((record) => (
                <div className="history-row" key={record.id}>
                  <span className={`badge ${record.type === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                    {record.type === 'entrada' ? 'Entrada' : 'Salida'}
                  </span>
                  <span className="history-date">
                    {new Date(record.timestamp).toLocaleDateString('es-MX', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                  <span className="history-time">
                    {new Date(record.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function StudentFormModal({ student, defaultTurn, onClose, onSaved }) {
  const isNew = !student;
  const [form, setForm] = useState({
    student_number: student?.student_number || '',
    name: student?.name || '',
    apellido_paterno: student?.apellido_paterno || '',
    apellido_materno: student?.apellido_materno || '',
    gender: student?.gender || 'Masculino',
    turn: normalizeTurn(student?.turn) || normalizeTurn(defaultTurn) || 'mañana',
    career: student?.career || '',
    medical_certificate: Boolean(student?.medical_certificate)
  });
  const [customCareer, setCustomCareer] = useState(
    () => Boolean(student?.career) && !CAREERS.includes(student.career)
  );
  const [photo, setPhoto] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [preview, setPreview] = useState(student?.image_url ? assetUrl(student.image_url) : '');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handlePhoto = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setPhoto(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.apellido_materno && form.apellido_paterno.trim().toLowerCase() === form.apellido_materno.toLowerCase()) {
      setError('Los apellidos paterno y materno no pueden ser iguales');
      return;
    }

    setSending(true);
    try {
      const fd = new FormData();
      fd.append('student_number', form.student_number);
      fd.append('name', form.name);
      fd.append('apellido_paterno', form.apellido_paterno);
      fd.append('apellido_materno', form.apellido_materno);
      fd.append('gender', form.gender);
      fd.append('turn', form.turn);
      fd.append('career', form.career);
      fd.append('medical_certificate', form.medical_certificate ? '1' : '0');
      if (photo) fd.append('image', photo);
      if (certificate) fd.append('certificate', certificate);

      if (isNew) {
        await api.post('/students', fd);
      } else {
        await api.patch(`/students/${student.id}`, fd);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible guardar el alumno');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      title={isNew ? 'Registrar nuevo alumno' : `Editar expediente · ${student.student_number}`}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label htmlFor="sf-nombre">Nombre</label>
            <input id="sf-nombre" className="input" placeholder="Nombre(s)" value={form.name} onChange={set('name')} required />
          </div>
          <div className="field">
            <label htmlFor="sf-expediente">Número de expediente</label>
            <input id="sf-expediente" className="input" placeholder="UES-0009" value={form.student_number} onChange={set('student_number')} required />
          </div>
          <div className="field">
            <label htmlFor="sf-paterno">Apellido paterno</label>
            <input id="sf-paterno" className="input" placeholder="Apellido paterno" value={form.apellido_paterno} onChange={set('apellido_paterno')} required />
          </div>
          <div className="field">
            <label htmlFor="sf-materno">Apellido materno</label>
            <input id="sf-materno" className="input" placeholder="Apellido materno" value={form.apellido_materno} onChange={set('apellido_materno')} />
          </div>
        </div>

        <div className="field">
          <label>Sexo</label>
          <div className="sexo-options">
            {GENDERS.map((g) => (
              <label key={g} className="sexo-option">
                <input
                  type="radio"
                  name="sexo"
                  value={g}
                  checked={form.gender === g}
                  onChange={() => setForm((prev) => ({ ...prev, gender: g }))}
                />
                <span>{g}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label htmlFor="sf-turno">Turno</label>
            <select id="sf-turno" className="select" value={form.turn} onChange={set('turn')}>
              {TURNS.map((t) => <option key={t} value={t}>{`Turno ${t}`}</option>)}
            </select>
            <p className="hint">Se rellenó automáticamente con tu turno; cámbialo si prefieres otro.</p>
          </div>

          <div className="field">
            <label htmlFor="sf-career">Carrera</label>
            <select
              id="sf-career"
              className="select"
              value={customCareer ? OTHER_CAREER : form.career}
              onChange={(e) => {
                const value = e.target.value;
                if (value === OTHER_CAREER) {
                  setCustomCareer(true);
                  setForm((prev) => ({ ...prev, career: '' }));
                } else {
                  setCustomCareer(false);
                  setForm((prev) => ({ ...prev, career: value }));
                }
              }}
            >
              <option value="">Selecciona la carrera…</option>
              {CAREERS.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={OTHER_CAREER}>Otras (escribe la carrera)</option>
            </select>
            {customCareer && (
              <input
                className="input"
                style={{ marginTop: 8, height: 42 }}
                placeholder="Escribe la carrera del estudiante"
                value={form.career}
                onChange={(e) => setForm((prev) => ({ ...prev, career: e.target.value }))}
              />
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label htmlFor="sf-cert">Subir certificado médico (archivo)</label>
            <input
              id="sf-cert"
              className="input"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              onChange={(e) => setCertificate(e.target.files?.[0] || null)}
            />
            {student?.certificate_file ? (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-soft)' }}>
                Archivo actual:{' '}
                <a href={assetUrl(student.certificate_file)} target="_blank" rel="noreferrer">
                  {fileExt(student.certificate_file)}
                </a>
              </p>
            ) : (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-soft)' }}>
                PDF o documento del certificado médico
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="sf-photo">Foto del estudiante</label>
            <div className="url-row">
              <div className="image-upload" style={{ flex: 1 }}>
                {preview ? (
                  <img className="avatar" style={{ width: 46, height: 46 }} src={preview} alt="Fotografía del alumno" />
                ) : (
                  <span className="avatar" style={{ width: 46, height: 46 }}>{(form.name || '?')[0]}</span>
                )}
                <input
                  id="sf-photo"
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                  title="Subir fotografía del estudiante"
                />
              </div>
            </div>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.medical_certificate}
            onChange={(e) => setForm((prev) => ({ ...prev, medical_certificate: e.target.checked }))}
            style={{ width: 18, height: 18, accentColor: 'var(--guinda)' }}
          />
          <strong style={{ fontSize: 13.5 }}>Certificado médico vigente</strong>
        </label>

        <div className="form-actions" style={{ marginTop: 22 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <Icon name="x" />
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? <span className="spinner spinner-sm" /> : <Icon name="save" />}
            {sending ? 'Guardando…' : isNew ? 'Registrar alumno' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}