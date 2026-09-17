import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import UesLogo from './common/UesLogo';
import Modal from './common/Modal';
import Icon from './common/Icon';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-badge">
          <UesLogo size={72} />
          <h1>Gimnasio UES</h1>
          <p>Portal de administración e instructores</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Usuario o correo institucional</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="ej. admin@gymues.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : <Icon name="login" />}
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>

          <button
            type="button"
            className="login-link"
            style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
            onClick={() => setForgotOpen(true)}
          >
            <Icon name="help" size={16} />
            ¿Olvidaste tu contraseña?
          </button>
        </form>

        <div className="login-alt">
          <Link to="/checador" className="checador-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Acceder al Checador de alumnos
          </Link>
        </div>
      </div>

      {forgotOpen && (
        <ForgotPasswordModal onClose={() => setForgotOpen(false)} />
      )}
    </div>
  );
}

function ForgotPasswordModal({ onClose }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [greeting, setGreeting] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setGreeting(response.data.message);
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible verificar el correo');
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', { email, password });
      setMessage(response.data.message);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Recuperar contraseña"
      onClose={onClose}
      showClose={step !== 'done'}
      footer={
        step === 'done' ? (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            <Icon name="check" />
            Entendido
          </button>
        ) : null
      }
    >
      {step === 'email' && (
        <form onSubmit={requestReset}>
          <p className="section-subtitle">
            Ingresa el correo institucional con el que te registraste. Verificaremos la cuenta para que puedas
            restablecer tu acceso.
          </p>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="forgot-email">Correo institucional</label>
            <input
              id="forgot-email"
              className="input"
              type="email"
              placeholder="ej. admin@gymues.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : <Icon name="mail" />}
            {loading ? 'Verificando…' : 'Verificar correo'}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={submitReset}>
          <div className="alert alert-success" style={{ marginBottom: 16 }}>{greeting}</div>
          <div className="field">
            <label htmlFor="new-pass">Nueva contraseña</label>
            <input
              id="new-pass"
              className="input"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-pass">Confirmar contraseña</label>
            <input
              id="confirm-pass"
              className="input"
              type="password"
              placeholder="Repite la nueva contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : <Icon name="key" />}
            {loading ? 'Guardando…' : 'Restablecer contraseña'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="alert alert-success">{message}</div>
      )}
    </Modal>
  );
}