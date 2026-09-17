import { useEffect, useState } from 'react';
import api from '../api/client';
import UesLogo from './common/UesLogo';
import Icon from './common/Icon';

const MENU_LINKS = [
  { href: '/docs/Reglamento.pdf', label: 'Reglamento', description: 'PDF oficial del reglamento del gimnasio' },
  { href: '/docs/Horario.pdf', label: 'Horario de turno', description: 'PDF del horario con el responsable (maestro de turno)' }
];

export default function Checador() {
  const [now, setNow] = useState(new Date());
  const [studentNumber, setStudentNumber] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
                <strong style={{ color: 'var(--guinda-dark)' }}>Documentos UES</strong>
              </div>
              <button type="button" className="modal-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
                <Icon name="x" size={18} />
              </button>
            </div>

            {MENU_LINKS.map((link) => (
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

            <p className="drawer-caption">
              Responsable de turno: el maestro encargado publica el horario actualizado de cada semana.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}