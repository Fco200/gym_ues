import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from './common/Modal';
import ConfirmModal from './common/ConfirmModal';
import Icon from './common/Icon';

const TURNS = ['mañana', 'tarde'];

const ROLE_LABEL = {
  super_admin: 'Super Administrador',
  maestro_mañana: 'Instructor · Turno mañana',
  maestro_tarde: 'Instructor · Turno tarde'
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function userType(role) {
  return role === 'super_admin' ? 'super_admin' : 'maestro';
}

function userTurn(user) {
  const t = String(user?.turn || '').toLowerCase();
  return t.startsWith('t') ? 'tarde' : 'mañana';
}

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = currentUser.role === 'super_admin';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard/registros', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  if (!isSuperAdmin) return null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="section-title">Usuarios del sistema</h2>
          <p className="section-subtitle">
            Administra los accesos de administradores e instructores del gimnasio.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Cuentas del sistema ({users.length})</div>
            <div className="card-muted">
              Solo un super administrador puede gestionar estas cuentas.
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {loading ? (
          <div className="empty-state">Cargando usuarios…</div>
        ) : users.length === 0 ? (
          <div className="empty-state">No hay usuarios registrados.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Turno</th>
                  <th>Alta</th>
                  <th className="cell-numeric">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <span className="avatar avatar-sm">{(u.name || '?')[0]}</span>
                          <strong>{u.name}</strong>
                          {isSelf && <span className="badge badge-success">Tú</span>}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>{ROLE_LABEL[u.role] || u.role}</td>
                      <td>{u.role === 'super_admin' ? 'General' : `Turno de la ${userTurn(u)}`}</td>
                      <td>{formatDate(u.created_at)}</td>
                      <td className="cell-numeric">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn-action"
                            title="Editar usuario"
                            onClick={() => { setEditing(u); setFormOpen(true); }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-action"
                            title="Eliminar usuario"
                            onClick={() => setDeleting(u)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card search-bar-card">
        <div className="search-bar">
          <span className="card-muted">
            Los instructores se limitan a su turno. Las contraseñas deben tener al menos 6 caracteres.
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { setEditing(null); setFormOpen(true); }}
          >
            <Icon name="plus" />
            Nuevo usuario
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
        <UserFormModal
          user={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            showToast(editing ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito');
            fetchUsers();
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Eliminar usuario"
          message={`¿Seguro que deseas eliminar la cuenta de ${deleting.name} (${deleting.email})? Perderá el acceso al sistema.`}
          confirmLabel="Eliminar usuario"
          onConfirm={async () => {
            try {
              await api.delete(`/users/${deleting.id}`, {
                headers: { 'X-User-Id': currentUser.id }
              });
              setUsers((prev) => prev.filter((u) => u.id !== deleting.id));
              setDeleting(null);
              showToast('Usuario eliminado');
            } catch (err) {
              alert(err.response?.data?.error || 'Error al eliminar el usuario');
            }
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function UserFormModal({ user, onClose, onSaved }) {
  const isNew = !user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    type: userType(user?.role) || 'maestro',
    turn: userTurn(user) || 'mañana'
  });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isNew && form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!isNew && form.password && form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSending(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.type,
        turn: form.type === 'super_admin' ? 'general' : form.turn
      };
      if (form.password) payload.password = form.password;

      if (isNew) {
        await api.post('/users', payload);
      } else {
        await api.patch(`/users/${user.id}`, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible guardar el usuario');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      title={isNew ? 'Crear usuario' : `Editar usuario · ${user.name}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="field">
          <label htmlFor="uf-name">Nombre completo</label>
          <input id="uf-name" className="input" placeholder="Nombre y apellidos" value={form.name} onChange={set('name')} required />
        </div>

        <div className="field">
          <label htmlFor="uf-email">Correo institucional</label>
          <input id="uf-email" className="input" type="email" placeholder="usuario@gymues.com" value={form.email} onChange={set('email')} required />
        </div>

        <div className="field">
          <label htmlFor="uf-password">
            {isNew ? 'Contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)'}
          </label>
          <input id="uf-password" className="input" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} required={isNew} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label htmlFor="uf-type">Tipo de usuario</label>
            <select id="uf-type" className="select" value={form.type} onChange={set('type')}>
              <option value="maestro">Instructor</option>
              <option value="super_admin">Super Administrador</option>
            </select>
            <p className="hint">
              {form.type === 'super_admin'
                ? 'Verá ambos turnos y podrá gestionar usuarios.'
                : 'Acceso limitado al turno del instructor.'}
            </p>
          </div>

          {form.type === 'maestro' && (
            <div className="field">
              <label htmlFor="uf-turn">Turno del instructor</label>
              <select id="uf-turn" className="select" value={form.turn} onChange={set('turn')}>
                {TURNS.map((t) => <option key={t} value={t}>{`Turno ${t}`}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="form-actions" style={{ marginTop: 22 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <Icon name="x" />
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? <span className="spinner spinner-sm" /> : <Icon name="save" />}
            {sending ? 'Guardando…' : isNew ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}