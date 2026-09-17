import { useEffect, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { captureFingerprint, getReaderStatus } from '../services/digitalPersonaService';
import UesLogo from './common/UesLogo';
import Icon from './common/Icon';

const GENDERS = ['Masculino', 'Femenino', 'Otro'];
const TURNS = ['mañana', 'tarde'];

const FORM_INITIAL = {
  student_number: '',
  name: '',
  lastname: '',
  gender: 'Masculino',
  turn: 'mañana',
  fingerprint_template: ''
};

const FINGER_STATUS = {
  idle: { label: 'Sin huella capturada', tone: 'muted' },
  scanning: { label: 'Esperando lector…', tone: 'info' },
  placing: { label: 'Coloque su dedo en el lector…', tone: 'info' },
  captured: { label: '¡Huella capturada con éxito ✔!', tone: 'success' },
  error: { label: 'Error capturando la huella', tone: 'danger' }
};

export default function RegistroAlumno() {
  const navigate = useNavigate();
  const [form, setForm] = useReducer((prev, next) => ({ ...prev, ...next }), FORM_INITIAL);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [readerStatus, setReaderStatus] = useState(null);

  const [fingerStatus, setFingerStatus] = useState('idle');
  const [fingerMessage, setFingerMessage] = useState('');
  const [fingerBusy, setFingerBusy] = useState(false);

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [welcome, setWelcome] = useState(null);

  useEffect(() => {
    let active = true;
    getReaderStatus().then((status) => {
      if (active) setReaderStatus(status);
    });
    return () => {
      active = false;
    };
  }, []);

  const setField = (key) => (e) => setForm({ [key]: e.target.value });

  const handlePhoto = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setPhoto(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const captureFinger = async () => {
    setError('');
    setFingerStatus('scanning');
    setFingerBusy(true);
    setFingerMessage('Esperando lector…');

    const seed = form.student_number.trim() || form.name.trim() || 'registro-temporal';

    try {
      const result = await captureFingerprint({
        seed,
        onStatus: (msg) => {
          setFingerMessage(msg);
          if (msg && (msg.toLowerCase().includes('coloque') || msg.toLowerCase().includes('simulando'))) {
            setFingerStatus('placing');
          }
        }
      });

      if (result.simulated) {
        setFingerMessage('Simulando lectura de huella…');
        setFingerStatus('placing');
        await new Promise((resolve) => setTimeout(resolve, 900));
      }

      setForm({ fingerprint_template: result.template });
      setFingerStatus('captured');
      setFingerMessage(result.simulated ? '¡Huella capturada con éxito ✔! (Modo simulación)' : '¡Huella capturada con éxito ✔!');
    } catch {
      setFingerStatus('error');
      setFingerMessage('No fue posible capturar la huella. Puedes continuar sin ella.');
    } finally {
      setFingerBusy(false);
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.student_number.trim()) errors.student_number = 'El número de expediente es obligatorio.';
    if (!form.name.trim()) errors.name = 'Los nombre(s) son obligatorios.';
    if (!form.lastname.trim()) errors.lastname = 'Los apellidos son obligatorios.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setSending(true);
    try {
      const fd = new FormData();
      fd.append('student_number', form.student_number);
      fd.append('name', form.name);
      fd.append('lastname', form.lastname);
      fd.append('gender', form.gender);
      fd.append('turn', form.turn);
      fd.append('member_type', 'estudiante');
      fd.append('medical_certificate', '0');
      if (form.fingerprint_template) {
        fd.append('fingerprint_template', form.fingerprint_template);
      }
      if (photo) fd.append('image', photo);

      const response = await api.post('/students', fd);
      setWelcome({
        message: response.data.message || '¡Registro completado!',
        turn: form.turn,
        studentNumber: response.data.student_number || form.student_number,
        name: form.name.trim()
      });
    } catch (err) {
      if (err.response?.status === 409) {
        setError('Ese número de expediente ya está registrado. Verifícalo con el personal del gimnasio.');
      } else {
        setError(err.response?.data?.error || 'No fue posible completar el registro.');
      }
    } finally {
      setSending(false);
    }
  };

  const currentFinger = FINGER_STATUS[fingerStatus];

  return (
    <div className="registro-page">
      <div className="registro-card">
        <div className="checador-modal-head">
          <UesLogo size={46} />
          <div style={{ flex: 1 }}>
            <h1>Auto-Registro de Alumnos</h1>
            <small>Gimnasio UES · Universidad Estatal de Sonora</small>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/checador')}
            title="Volver al checador"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {readerStatus && (
          <div className={`reader-badge ${readerStatus.mode}`}>
            {readerStatus.mode === 'real' ? (
              <>
                <Icon name="check" size={14} />
                Lector biométrico conectado
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M13 2l-2 7h6l-7 13 2-7H5l8-13z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                Modo simulación activo · el lector se usará automáticamente al conectarse por USB
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label htmlFor="ra-expediente">Número de expediente</label>
              <input
                id="ra-expediente"
                className={`input ${fieldErrors.student_number ? 'has-error' : ''}`}
                placeholder="Ej. UES-0009"
                value={form.student_number}
                onChange={setField('student_number')}
                required
              />
              {fieldErrors.student_number && <p className="hint hint-error">{fieldErrors.student_number}</p>}
            </div>
            <div className="field">
              <label htmlFor="ra-turno">Turno</label>
              <select id="ra-turno" className="select" value={form.turn} onChange={setField('turn')}>
                {TURNS.map((t) => (
                  <option key={t} value={t}>
                    Turno de la {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div className="field">
              <label htmlFor="ra-nombre">Nombre(s)</label>
              <input
                id="ra-nombre"
                className={`input ${fieldErrors.name ? 'has-error' : ''}`}
                placeholder="Ej. Juan Carlos"
                value={form.name}
                onChange={setField('name')}
                required
              />
              {fieldErrors.name && <p className="hint hint-error">{fieldErrors.name}</p>}
            </div>
            <div className="field">
              <label htmlFor="ra-apellidos">Apellidos</label>
              <input
                id="ra-apellidos"
                className={`input ${fieldErrors.lastname ? 'has-error' : ''}`}
                placeholder="Ej. Pérez García"
                value={form.lastname}
                onChange={setField('lastname')}
                required
              />
              {fieldErrors.lastname && <p className="hint hint-error">{fieldErrors.lastname}</p>}
            </div>
            <div className="field">
              <label htmlFor="ra-genero">Género</label>
              <select id="ra-genero" className="select" value={form.gender} onChange={setField('gender')}>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="ra-foto">Fotografía (opcional)</label>
            <div className="url-row">
              <div className="image-upload" style={{ flex: 1 }}>
                {preview ? (
                  <img className="avatar" style={{ width: 46, height: 46 }} src={preview} alt="Fotografía del alumno" />
                ) : (
                  <span className="avatar" style={{ width: 46, height: 46 }}>
                    {(form.name || '?')[0]}
                  </span>
                )}
                <input
                  id="ra-foto"
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                  title="Subir fotografía"
                />
              </div>
            </div>
            <p className="hint">Acepta imágenes JPG / PNG (máx. 5 MB).</p>
          </div>

          <div className="finger-box">
            <div className="finger-head">
              <div>
                <div className="card-title">Captura de huella (opcional)</div>
                <p className="hint">
                  Usa el lector DigitalPersona. Si no está conectado, se activa el modo simulación.
                </p>
              </div>
              <span className={`finger-status ${currentFinger.tone}`}>
                <span className="dot" />
                {currentFinger.label}
              </span>
            </div>

            <div className="finger-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={captureFinger}
                disabled={fingerBusy}
              >
                {fingerBusy ? (
                  <span className="spinner spinner-sm" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 11a2 2 0 012 2c0 1.3-.5 2.9-1.4 4.3a2.2 2.2 0 01-3.6-.6M12 11a2 2 0 00-2 2c0 1.3.5 2.9 1.4 4.3M12 11V7a2 2 0 00-2-2m2 0a2 2 0 012 2m-2 0a2 2 0 012 2m-6 7a7 7 0 01-1-4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                Escanear / Capturar Huella
              </button>

              {fingerStatus === 'captured' && form.fingerprint_template && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setForm({ fingerprint_template: '' });
                    setFingerStatus('idle');
                  }}
                >
                  <Icon name="trash" size={15} />
                  Quitar huella
                </button>
              )}
            </div>

            {fingerMessage && (
              <div className={`finger-msg ${fingerStatus}`}>
                {fingerBusy && fingerStatus !== 'captured' && <span className="spinner spinner-sm" />}
                {fingerMessage}
              </div>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 16 }}>
              <Icon name="warning" size={18} />
              {error}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: 22 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/checador')}>
              <Icon name="arrowLeft" />
              Cancelar / Volver al Checador
            </button>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? <span className="spinner spinner-sm" /> : <Icon name="check" />}
              {sending ? 'Registrando…' : 'Completar Registro'}
            </button>
          </div>
        </form>
      </div>

      {welcome && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-body" style={{ textAlign: 'center', padding: 34 }}>
              <div className="welcome-check">
                <svg viewBox="0 0 84 84" className="success-check" aria-hidden>
                  <circle cx="42" cy="42" r="40" />
                  <path d="M26 43l11 11 21-24" />
                </svg>
              </div>
              <h2 style={{ color: 'var(--guinda-dark)', fontSize: 22, margin: '14px 0 6px' }}>¡Bienvenido!</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                {welcome.name}, tu registro quedó completo con el expediente{' '}
                <strong style={{ color: 'var(--guinda)' }}>{welcome.studentNumber}</strong>.
                Asistirás en el <strong style={{ color: 'var(--guinda)' }}>turno de la {welcome.turn}</strong>.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 22, minWidth: 220 }}
                onClick={() => navigate('/checador')}
              >
                <Icon name="clock" />
                Ir al Checador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}