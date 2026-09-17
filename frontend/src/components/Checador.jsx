import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import UesLogo from './common/UesLogo';
import Icon from './common/Icon';
import { DIAS, HORARIOS, PDF_PATHS } from '../data/horario';
import {
  captureFingerprint,
  getReaderStatus,
  identifyStudent
} from '../services/digitalPersonaService';

const DOC_MENU = [
  { href: '/docs/Reglamento.pdf', label: 'Documento oficial', description: 'Reglamento del gimnasio (PDF)' },
  { href: '/docs/Horario.pdf', label: 'Horario oficial', description: 'Distribución del turno con responsable (PDF)' }
];

export default function Checador() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [studentNumber, setStudentNumber] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null); // 'reglamento' | 'horarios'
  const [activeTurn, setActiveTurn] = useState('mañana');

  // Estado del flujo biométrico
  const [bioOpen, setBioOpen] = useState(false);
  const [bioType, setBioType] = useState('entrada');
  const [bioMode, setBioMode] = useState('mock');
  const [bioStudents, setBioStudents] = useState([]);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioStatus, setBioStatus] = useState('pick');
  const [bioMessage, setBioMessage] = useState('');
  const [bioSelected, setBioSelected] = useState('');
  const [bioResult, setBioResult] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (value) => String(value).padStart(2, '0');
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const dateLabel = now.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handleCheck = async (type) => {
    setMessage(null);
    setError(null);
    if (!studentNumber.trim()) {
      setError('Ingresa el número de expediente del alumno');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/attendance/check', {
        student_number: studentNumber,
        type
      });
      setMessage({
        body: `${response.data.message} · ${response.data.student.name} (turno de la ${response.data.student.turn})`,
        ok: true
      });
      setStudentNumber('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar la asistencia');
    } finally {
      setLoading(false);
    }
  };

  // ---- Flujo biométrico ------------------------------------------------

  const openBiometric = async () => {
    setError(null);
    setBioBusy(true);
    setBioOpen(true);
    setBioStatus('pick');
    setBioMessage('');
    setBioResult(null);
    setBioType('entrada');
    try {
      const [statusRes, listRes] = await Promise.all([
        getReaderStatus(),
        api.get('/students/biometrics')
      ]);
      setBioMode(statusRes.mode);
      setBioStudents(listRes.data || []);
      if (statusRes.mode === 'real') {
        setBioStatus('reading');
        setBioMessage('Coloque su dedo en el lector…');
        runBiometricCapture(null, statusRes.mode, listRes.data || []);
      } else if (!listRes.data || listRes.data.length === 0) {
        setBioStatus('empty');
        setBioMessage('Aún no hay alumnos con huella registrada. Registra a un alumno primero.');
      }
    } catch {
      setBioMode('mock');
      setBioStudents([]);
      setBioStatus('empty');
      setBioMessage('No fue posible consultar las huellas registradas.');
    } finally {
      setBioBusy(false);
    }
  };

  const runBiometricCapture = async (seed, mode = bioMode, students = bioStudents) => {
    try {
      const capture = await captureFingerprint({
        seed: seed || undefined,
        onStatus: (msg) => {
          setBioMessage(msg);
          if (msg && msg.toLowerCase().includes('coloque')) setBioStatus('reading');
        }
      });

      if (capture.simulated) {
        setBioStatus('reading');
        setBioMessage('Simulando lectura de huella…');
      }

      const found = await identifyStudent(capture.template, students);
      if (!found) {
        setBioStatus('error');
        setBioMessage(mode === 'mock'
          ? 'La huella simulada no coincide con ningún alumno registrado.'
          : 'Huella no reconocida. Verifica que el alumno esté registrado con huella.');
        return;
      }

      setBioStatus('checking');
      setBioMessage(`Identificado: ${found.student_number} · ${found.name} ${found.lastname || ''}`.trim());

      const response = await api.post('/attendance/check', {
        student_number: found.student_number,
        type: bioType
      });

      setBioResult({
        body: `${response.data.message} · ${response.data.student.name}`,
        studentNumber: response.data.student.student_number
      });
      setBioStatus('success');
      setMessage({ body: `${response.data.message} · ${response.data.student.name}`, ok: true });
    } catch (err) {
      setBioStatus('error');
      setBioMessage(err.response?.data?.error || 'Error al procesar la huella y registrar la asistencia');
    }
  };

  const handleSimulatedCheck = () => {
    if (!bioSelected) {
      setBioMessage('Selecciona el alumno cuya huella deseas simular.');
      setBioStatus('error');
      return;
    }
    runBiometricCapture(bioSelected);
  };

  const closeBiometric = () => {
    setBioOpen(false);
    setBioStatus('pick');
    setBioSelected('');
    setBioResult(null);
  };

  return (
    <div className="checador-v2">
      <div className="checador-modal">
        <div className="checador-modal-head">
          <UesLogo size={46} />
          <div style={{ flex: 1 }}>
            <h1>Checador de alumnos</h1>
            <small>Universidad Estatal de Sonora · Gimnasio UES</small>
          </div>
          <button type="button" className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="checador-body">
          <p className="sub-label">Registro de entrada y salida</p>

          <div className="field">
            <label htmlFor="cd-number">Número de expediente del alumno</label>
            <input
              id="cd-number"
              className="input"
              type="text"
              placeholder="Ej. UES-0001"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              autoFocus
            />
          </div>

          <div className="checador-actions-split">
            <button
              type="button"
              className="btn-check-in"
              onClick={() => handleCheck('entrada')}
              disabled={loading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              Registrar Entrada
            </button>
            <button
              type="button"
              className="btn-check-out"
              onClick={() => handleCheck('salida')}
              disabled={loading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M19 12H5m0 0l6-6m-6 6l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Registrar Salida
            </button>
          </div>

          <button
            type="button"
            className="btn-biometric"
            onClick={openBiometric}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 11a2 2 0 012 2c0 1.3-.5 2.9-1.4 4.3a2.2 2.2 0 01-3.6-.6M12 11a2 2 0 00-2 2c0 1.3.5 2.9 1.4 4.3M12 11V7a2 2 0 00-2-2m2 0a2 2 0 012 2m-2 0a2 2 0 012 2m-6 7a7 7 0 01-1-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Checar con Huella
          </button>

          {message && (
            <div className="alert alert-success" style={{ marginTop: 18 }} role="status">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {message.body}
            </div>
          )}
          {error && (
            <div className="alert alert-error" style={{ marginTop: 18 }} role="alert">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 8v5m0 3v.01M12 3a9 9 0 100 18 9 9 0 000-18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="checador-clock">
          <span className="time">{hours}:{minutes}:{seconds}</span>
          <span className="date">· {dateLabel}</span>
        </div>
      </div>

      {menuOpen && (
        <div className="drawer-overlay" onClick={() => setMenuOpen(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UesLogo size={34} />
                <strong style={{ color: 'var(--guinda-dark)' }}>Menú del Checador</strong>
              </div>
              <button type="button" className="modal-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
                <Icon name="x" size={18} />
              </button>
            </div>

            <button
              type="button"
              className="drawer-link"
              onClick={() => { setMenuOpen(false); navigate('/registro-alumno'); }}
            >
              <Icon name="user" size={20} />
              <span>
                Registrar Nuevo Alumno
                <br />
                <small style={{ color: 'var(--text-soft)' }}>Alta de expediente con huella opcional</small>
              </span>
            </button>

            <button
              type="button"
              className="drawer-link"
              onClick={() => { setMenuOpen(false); setInfoModal('reglamento'); }}
            >
              <Icon name="info" size={20} />
              <span>
                Reglamento del Gimnasio
                <br />
                <small style={{ color: 'var(--text-soft)' }}>Normas oficiales de las instalaciones</small>
              </span>
            </button>

            <button
              type="button"
              className="drawer-link"
              onClick={() => { setMenuOpen(false); setInfoModal('horarios'); }}
            >
              <Icon name="calendar" size={20} />
              <span>
                Horarios y Turnos
                <br />
                <small style={{ color: 'var(--text-soft)' }}>Turno matutino y vespertino</small>
              </span>
            </button>

            <button
              type="button"
              className="drawer-link"
              onClick={() => { setMenuOpen(false); navigate('/'); }}
            >
              <Icon name="lock" size={20} />
              <span>
                Portal Administrativo / Login
                <br />
                <small style={{ color: 'var(--text-soft)' }}>Acceso de maestros y superadministrador</small>
              </span>
            </button>

            <p className="drawer-caption" style={{ marginTop: 8, color: 'var(--guinda)', fontWeight: 700 }}>
              Documentos oficiales
            </p>

            {DOC_MENU.map((link) => (
              <a key={link.href} className="drawer-link" href={link.href} target="_blank" rel="noreferrer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6M9 14h6m0-3v3m-6 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  {link.label}
                  <br />
                  <small style={{ color: 'var(--text-soft)' }}>{link.description}</small>
                </span>
              </a>
            ))}
          </aside>
        </div>
      )}

      {/* Modal biométrico */}
      {bioOpen && (
        <div className="modal-overlay" onClick={bioBusy ? undefined : closeBiometric}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Checar con huella</h3>
              <button type="button" className="modal-close" onClick={closeBiometric} aria-label="Cerrar">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="modal-body">
              {bioMode === 'mock' ? (
                <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                  Modo simulación activo: elige un alumno registrado para simular su huella.
                </div>
              ) : (
                <div className="alert alert-info" style={{ marginBottom: 16 }}>
                  Coloque su dedo en el lector DigitalPersona para identificarse.
                </div>
              )}

              <div className="segmented" style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className={bioType === 'entrada' ? 'active' : ''}
                  onClick={() => setBioType('entrada')}
                  disabled={bioBusy}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  className={bioType === 'salida' ? 'active' : ''}
                  onClick={() => setBioType('salida')}
                  disabled={bioBusy}
                >
                  Salida
                </button>
              </div>

              {bioStatus === 'pick' && bioMode === 'mock' && bioStudents.length > 0 && (
                <>
                  <p className="hint" style={{ marginBottom: 8 }}>
                    Selecciona el alumno a simular:
                  </p>
                  <select
                    className="select"
                    style={{ width: '100%' }}
                    value={bioSelected}
                    onChange={(e) => {
                      setBioSelected(e.target.value);
                      setBioMessage('');
                      setBioStatus('pick');
                    }}
                  >
                    <option value="">— Elegir alumno —</option>
                    {bioStudents.map((s) => (
                      <option key={s.id} value={s.student_number}>
                        {s.student_number} · {s.name} {s.lastname || ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    style={{ marginTop: 16 }}
                    onClick={handleSimulatedCheck}
                    disabled={bioBusy}
                  >
                    {bioBusy ? <span className="spinner spinner-sm" /> : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M12 11a2 2 0 012 2c0 1.3-.5 2.9-1.4 4.3a2.2 2.2 0 01-3.6-.6M12 11V7a2 2 0 00-2-2m2 0a2 2 0 012 2m-6 7a7 7 0 01-1-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                    Simular huella y checar
                  </button>
                </>
              )}

              {bioStatus === 'empty' && (
                <div className="empty-state" style={{ padding: '12px 0' }}>
                  {bioMessage}
                  {bioStudents.length === 0 && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 14 }}
                      onClick={() => { closeBiometric(); navigate('/registro-alumno'); }}
                    >
                      <Icon name="user" size={15} />
                      Registrar alumno con huella
                    </button>
                  )}
                </div>
              )}

              {(bioStatus === 'reading' || bioStatus === 'checking') && (
                <div className="finger-scan">
                  <div className="finger-scan-ring">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M12 11a2 2 0 012 2c0 1.3-.5 2.9-1.4 4.3a2.2 2.2 0 01-3.6-.6M12 11a2 2 0 00-2 2c0 1.3.5 2.9 1.4 4.3M12 11V7a2 2 0 00-2-2m2 0a2 2 0 012 2m-6 7a7 7 0 01-1-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p>{bioMessage}</p>
                </div>
              )}

              {bioStatus === 'success' && bioResult && (
                <div className="alert alert-success">
                  <Icon name="check" size={18} />
                  {bioResult.body} · Expediente {bioResult.studentNumber}
                </div>
              )}

              {bioStatus === 'error' && (
                <div className="alert alert-error">
                  <Icon name="warning" size={18} />
                  {bioMessage}
                </div>
              )}

              {bioStatus === 'success' && (
                <div className="form-actions" style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <button type="button" className="btn btn-primary" onClick={closeBiometric}>
                    <Icon name="check" />
                    Listo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reglamento */}
      {infoModal === 'reglamento' && (
        <div className="modal-overlay" onClick={() => setInfoModal(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Reglamento del Gimnasio UES</h3>
              <button type="button" className="modal-close" onClick={() => setInfoModal(null)} aria-label="Cerrar">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <iframe
                src={PDF_PATHS.reglamento}
                title="Visor del reglamento del gimnasio"
                style={{ width: '100%', height: '60vh', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff' }}
              />
              <p className="hint" style={{ marginTop: 12 }}>
                Si el documento no se visualiza, descárgalo:{' '}
                <a href={PDF_PATHS.reglamento} target="_blank" rel="noreferrer">Abrir PDF en nueva pestaña</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Horarios */}
      {infoModal === 'horarios' && (
        <div className="modal-overlay" onClick={() => setInfoModal(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Horarios y Turnos</h3>
              <button type="button" className="modal-close" onClick={() => setInfoModal(null)} aria-label="Cerrar">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="segmented" style={{ marginBottom: 14 }}>
                {Object.keys(HORARIOS).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={activeTurn === option ? 'active' : ''}
                    onClick={() => setActiveTurn(option)}
                  >
                    Turno de la {option}
                  </button>
                ))}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Instructor</th>
                      <th>Área / Actividad</th>
                      {DIAS.map((dia) => (
                        <th key={dia}>{dia}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(HORARIOS[activeTurn] || []).map((fila, index) => (
                      <tr key={index}>
                        <td><strong>{fila.instructor}</strong></td>
                        <td>{fila.area}</td>
                        {DIAS.map((dia) => (
                          <td key={dia}>{fila[dia.toLowerCase()]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint" style={{ marginTop: 12 }}>
                El PDF oficial está disponible en:{' '}
                <a href={PDF_PATHS.horario} target="_blank" rel="noreferrer">Ver PDF del horario</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}