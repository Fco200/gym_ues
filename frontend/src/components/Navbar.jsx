import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import UesLogo from './common/UesLogo';
import Modal from './common/Modal';
import ConfirmModal from './common/ConfirmModal';
import Icon from './common/Icon';

const TABS = [
  { to: '/dashboard/horarios', label: 'Horarios' },
  { to: '/dashboard/reglamento', label: 'Reglamento' },
  { to: '/dashboard/registros', label: 'Registros' },
  { to: '/dashboard/reportes', label: 'Reportes' },
  { to: '/dashboard/usuarios', label: 'Usuarios', superAdminOnly: true }
];

const ROLE_LABEL = {
  super_admin: 'Super Administrador',
  maestro_mañana: 'Instructor · Turno mañana',
  maestro_tarde: 'Instructor · Turno tarde'
};

export default function Navbar() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [turnOpen, setTurnOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const isMaestro = (user.role || '').startsWith('maestro');

  const handleLogout = () => {
    setConfirmLogout(false);
    setMenuOpen(false);
    setLeaving(true);
    window.setTimeout(() => {
      logout();
      navigate('/', { replace: true });
    }, 1600);
  };

  const initials = (user.name || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/dashboard/registros" className="navbar-brand">
          <UesLogo className="brand-logo" size={34} />
          <span>
            <span className="brand-title">Gimnasio UES</span>
            <br />
            <span className="brand-sub">Universidad Estatal de Sonora</span>
          </span>
        </NavLink>

        <ul className="nav-tabs">
          {TABS.filter((tab) => !tab.superAdminOnly || user.role === 'super_admin').map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="profile-wrap" ref={menuRef}>
          <button
            type="button"
            className="profile-trigger"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="avatar avatar-sm">{initials}</span>
            <span className="profile-meta">
              <span className="profile-name">{user.name}</span>
              <br />
              <span className="profile-role">
                {ROLE_LABEL[user.role] || user.role}
                {isMaestro && user.turn ? ` · ${user.turn.toUpperCase()}` : ''}
              </span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {menuOpen && (
            <div className="dropdown">
              <div className="dropdown-header">
                <div className="dname">{user.name}</div>
                <div className="dmeta">
                  {ROLE_LABEL[user.role] || user.role} · {user.email}
                </div>
              </div>

              <button type="button" className="dropdown-item" onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7v1h14v-1a7 7 0 00-7-7z"
                    fill="currentColor"
                  />
                </svg>
                Configurar credenciales
              </button>

              <button type="button" className="dropdown-item" onClick={() => { setMenuOpen(false); setPasswordOpen(true); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 11V8a4 4 0 10-8 0v3m0 0h8a2 2 0 012 2v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Cambiar contraseña
              </button>

              {isMaestro && (
                <button type="button" className="dropdown-item" onClick={() => { setMenuOpen(false); setTurnOpen(true); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 2l9 5v5c0 5.5-3.8 9.7-9 11-5.2-1.3-9-5.5-9-11V7l9-5z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Cambiar de turno
                </button>
              )}

              <button
                type="button"
                className="dropdown-item danger"
                onClick={() => { setMenuOpen(false); setConfirmLogout(true); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmLogout && (
        <ConfirmModal
          title="Cerrar sesión"
          message="¿Estás seguro de que deseas cerrar la sesión? Deberás volver a iniciar sesión para acceder al sistema."
          confirmLabel="Sí, cerrar sesión"
          onConfirm={handleLogout}
          onClose={() => setConfirmLogout(false)}
        />
      )}

      {settingsOpen && (
        <ProfileSettingsModal
          user={user}
          onClose={() => setSettingsOpen(false)}
          onSaved={updateUser}
        />
      )}

      {passwordOpen && (
        <ChangePasswordModal user={user} onClose={() => setPasswordOpen(false)} />
      )}

      {turnOpen && (
        <ChangeTurnModal
          user={user}
          onClose={() => setTurnOpen(false)}
          onSaved={updateUser}
        />
      )}

      {leaving && (
        <div className="logout-overlay">
          <div className="spinner" />
          <p>Saliendo del sistema…</p>
        </div>
      )}
    </header>
  );
}

function ProfileSettingsModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    const payload = { name, email };
    if (password) payload.password = password;
    try {
      const response = await api.patch(`/auth/${user.id}/profile`, payload);
      onSaved(response.data.user);
      setMessage(response.data.message);
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Configurar credenciales" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {message && <div className="alert alert-success" style={{ marginBottom: 16 }}>{message}</div>}
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="field">
          <label htmlFor="pf-name">Nombre completo</label>
          <input
            id="pf-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="pf-email">Correo institucional</label>
          <input
            id="pf-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="pf-password">Nueva contraseña (dejar vacío para no cambiar)</label>
          <input
            id="pf-password"
            className="input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="form-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <Icon name="x" />
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : <Icon name="save" />}
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChangePasswordModal({ user, onClose }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (String(password).length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        id: user.id,
        currentPassword: current,
        newPassword: password
      });
      setSuccess(true);
      window.setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Cambiar contraseña" onClose={onClose}>
      {success ? (
        <div style={{ textAlign: 'center', padding: '18px 0 10px' }}>
          <svg className="success-check" viewBox="0 0 52 52" aria-hidden>
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27l7 7 15-15" />
          </svg>
          <div className="card-title" style={{ color: 'var(--success)', marginTop: 4 }}>
            ¡Contraseña actualizada!
          </div>
          <p className="section-subtitle">A partir de ahora usa tu nueva contraseña para ingresar.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="field">
            <label htmlFor="cp-current">Contraseña actual</label>
            <input id="cp-current" className="input" type="password" placeholder="••••••••" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="cp-new">Nueva contraseña</label>
            <input id="cp-new" className="input" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="cp-confirm">Confirmar nueva contraseña</label>
            <input id="cp-confirm" className="input" type="password" placeholder="Repite la contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>

          <div className="form-actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              <Icon name="x" />
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : <Icon name="key" />}
              {loading ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ChangeTurnModal({ user, onClose, onSaved }) {
  const [turn, setTurn] = useState(user.turn || 'mañana');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const response = await api.patch(`/auth/${user.id}/profile`, { turn });
      onSaved(response.data.user);
      setMessage(`${response.data.message} Tu turno activo ahora es: ${turn.toUpperCase()}.`);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible cambiar el turno');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Cambiar de turno" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {message && <div className="alert alert-success" style={{ marginBottom: 16 }}>{message}</div>}
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <p className="section-subtitle">Selecciona el turno en el que impartirás tus sesiones.</p>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {['mañana', 'tarde'].map((option) => (
            <button
              key={option}
              type="button"
              className={`btn ${turn === option ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => setTurn(option)}
            >
              Turno {option}
            </button>
          ))}
        </div>

        <div className="form-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <Icon name="x" />
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : <Icon name="swap" />}
            {loading ? 'Guardando…' : 'Guardar turno'}
          </button>
        </div>
      </form>
    </Modal>
  );
}