import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from './common/Modal';
import ConfirmModal from './common/ConfirmModal';
import Icon from './common/Icon';
import { StudentFormModal } from './Registros';

const TURNS = ['mañana', 'tarde'];

const ROLE_LABEL = {
  super_admin: 'Super Administrador',
  maestro_mañana: 'Instructor · Turno mañana',
  maestro_tarde: 'Instructor · Turno tarde'
};

const MEMBER_TYPE_LABEL = {
  estudiante: 'Estudiante',
  mto: 'MTO',
  externo: 'Persona externa'
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

function extKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return `EXT-${s}`;
}

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = currentUser.role === 'super_admin';

  const [tab, setTab] = useState('cuentas');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [accesos, setAccesos] = useState([]);
  const [loadingAccesos, setLoadingAccesos] = useState(true);
  const [accesosError, setAccesosError] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard/registros', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

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

  const fetchAccesos = async () => {
    setLoadingAccesos(true);
    setAccesosError('');
    try {
      const response = await api.get('/students', { params: { member_type: 'access' } });
      setAccesos(response.data || []);
    } catch (err) {
      setAccesosError(err.response?.data?.error || 'No fue posible cargar los accesos al checador');
    } finally {
      setLoadingAccesos(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    if (tab === 'accesos') fetchAccesos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');

  // Picker y formularios del checador
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState(null); // 'estudiante' | 'mto' | 'externo'
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessEditing, setAccessEditing] = useState(null);
  const [accessForm, setAccessForm] = useState({ name: '', apellido_paterno: '', apellido_materno: '', student_number: '', medical_certificate: false });
  const [accessSending, setAccessSending] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [accessPhoto, setAccessPhoto] = useState(null);
  const [accessCertFile, setAccessCertFile] = useState(null);
  const [deletingAccess, setDeletingAccess] = useState(null);
  const [studentModalOpen, setStudentModalOpen] = useState(falseuting(false));

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const openAccessForm = (memberType) => {
    setPickerOpen(false);
    setPickerFor(memberType);
    setAccessEditing(null);
    setAccessForm({
      name: '',
      apellido_paterno: '',
      apellido_materno: '',
      student_number: memberType === 'mto' ? '' : extKey(),
      medical_certificate: false
    });
    setAccessError('');
    setAccessPhoto(null);
    setAccessCertFile(null);
    setAccessOpen(true);
  };

  const openAccessEdit = (member) => {
    setPickerOpen(false);
    setPickerFor(member.member_type);
    setAccessEditing(member);
    setAccessForm({
      name: member.name || '',
      apellido_paterno: member.apellido_paterno || '',
      apellido_materno: member.apellido_materno || '',
      student_number: member.student_number || '',
      medical_certificate: Boolean(member.medical_certificate)
    });
    setAccessError('');
    setAccessPhoto(null);
    setAccessCertFile(null);
    setAccessOpen(true);
  };

  const handleAccessSubmit = async (e) => {
    e.preventDefault();
    setAccessSending(true);
    setAccessError('');
    try {
      const fd = new FormData();
      fd.append('member_type', pickerFor);
      fd.append('patient_status', '2');
      fd.append('student_number', accessForm.student_number.trim());
      fd.append('name', accessForm.name.trim());
      fd.append('apellido_paterno', accessForm.apellido_paterno.trim());
      fd.append('apellido_materno', accessForm.apellido_materno.trim());
      fd.append('medical_certificate', accessForm.medical_certificate ? '1' : '0');
      if (accessPhoto) fd.append('image', accessPhoto);
      if (accessCertFile) fd.append('certificate', accessCertFileapse);

      if (accessEditing) {
        await api.patch(`/students/${accessEditing.id}`, fd);
      } else {
        await api.post('/students', fd);
      }
      setAccessOpen(false);
      fetchAccesos();
      showToast(accessEditing ? 'Acceso actualizado' : `${MEMBER_TYPE_LABEL[pickerFor] || pickerFor} registrado para el checador`);
    } catch (err) {
      setAccessError(err.response?.data?.error || 'No fue posible guardar el acceso');
    } finally {
      setAccessSending(false);
    }
  };

  const confirmDeleteAccess = async () => {
    if (!deletingAccess) return;
    try {
      await api.delete(`/students/${deletingAccess.id}`);
      setDeletingAccess(null);
      fetchAccesos();
      showToast('Acceso eliminado');
    } catch (err) {
      setAccesosError(err.response?.data?.error || 'No fue posible eliminar el acceso');
      setDeletingAccess(null);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="section-title">Usuarios y accesos al checador</h2>
          <p className="section-subtitle">
            Administra las cuentas del sistema y las personas con acceso al checador (MTO y externas).
          </p>
        </div>
      </div>

      <div className="segmented">
        <button type="button" className={tab === 'cuentas' ? 'active' : ''} onClick={() => setTab('cuentas')}>
          Cuentas del sistema ({users.length})
        </button>
        <button type="button" className={tab === 'accesos' ? 'active' : ''} onClick={() => { setTab('accesos'); if (accesos.length === 0) fetchAccesos(); }}>
          Accesos al checador ({accesos.length})
        </button>
      </div>

      {toast && (
        <div className="toast" role="status">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {toast}
        </div>
      )}

      {tab === 'cuentas' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Cuentas del sistema ({users.length})</div>
              <div className="card-muted">
                Solo un super administrador puede gestionar estas cuentas.
              </div>
            </div>
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
      )}

      {tab === 'accesos' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Accesos al checador ({accesos.length})</div>
              <div className="card-muted">
                Personal MTO y personas externas con clave para el checador.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setPickerOpen(true)}
            >
              <Icon name="plus" />
              Agregar acceso
            </button>
          </div>

          {accesosError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{accesosError}</div>}

          {loadingAccesos ? (
            <div className="empty-state">Cargando accesos…</div>
          ) : accesos.length === 0 ? (
            <div className="empty-state">No hay accesos al checador registrados.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Tipo</th>
                    <th>Clave checador</th>
                    <th>Certificado médico</th>
                    <th>Registro</th>
                    <th className="cell-numeric">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {accesos.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="url-row">
                          {a.image_url ? (
                            <img src={a.image_url} alt="" className="avatar avatar-sm" />
                          ) : (
                            <span className="avatar avatar-sm">{(a.name || '?')[0]?.toUpperCase()}</span>
                          )}
                          <strong>{a.name} {a.apellido_paterno || ''}</strong>
                        </div>
                      </td>
                      <td>{MEMBER_TYPE_LABEL[a.member_type] || a.member_type}</td>
                      <td>
                        <span className="badge badge-gold">{a.student_number}</span>
                      </td>
                      <td>
                        {a.medical_certificate ? (
                          <span className="badge badge-success">Vigente</span>
                        ) : (
                          <span className="badge badge-danger">Sin</span>
                        )}
                      </td>
                      <td>{formatDate(a.created_at)}</td>
                      <td className="cell-numeric">
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title="Editar acceso" onClick={() => openAccessEdit(a)}>
                            <Icon name="edit" size={16} />
                          </button>
                          <button type="button" className="icon-btn danger" title="Eliminar acceso" onClick={() => setDeletingAccess(a)}>
                            <Icon name="trash" size={16} />
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
      )}

      {/* Cuentas del sistema: lista + formulario (se mantiene intacto) */}
      {tab === 'cuentas' && (
        <div className="card">
          {loading ? (
            <div className="empty-state">Cargando usuarios…</div>
          ) : error ? (
            <div className="alert alert-error">{error}</div>
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
                          <div className="row-actions">
                            <button type="button" className="icon-btn" title="Editar usuario" onClick={() => { setEditing(u); setFormOpen(true); }}>
                              <Icon name="edit" size={16} />
                            </button>
                            <button type="button" className="icon-btn danger" title="Eliminar usuario" onClick={() => setDeleting(u)}>
                              <Icon name="trash" size={16} />
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
      )}

      {/* Picker de tipo de persona */}
      {pickerOpen && (
        <Modal title="Agregar acceso al checador" onClose={() => setPickerOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { type: 'estudiante', icon: 'user', title: 'Estudiante', desc: 'Alumno con expediente, turno y carrera.' },
              { type: 'mto', icon: 'shield', title: 'MTO', desc: 'Personal de mantenimiento y operación.' },
              { type: 'externo', icon: 'key', title: 'Persona externa', desc: 'Genera una clave EXT- automática.' }
            ].map((opt) => (
              <button
                key={opt.type}
                type="button"
                style={{
                  display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start',
                  padding: '18px 16px', border: '1px solid var(--border)', borderRadius: '14px',
                  background: 'var(--card)', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit'
                }}
                onClick={() => {
                  if (opt.type === 'estudiante') {
                    setPickerOpen(false);
                    setStudentModalOpen(true);
                  } else {
                    openAccessForm(opt.type);
                  }
                }}
              >
                <span className="option-icon"><Icon name={opt.icon} size={18} /></span>
                <strong>{opt.title}</strong>
                <span className="option-desc">{opt.desc}</span>
                <span className="option-cta">Continuar +</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Formulario de acceso (MTO / externo) */}
      {accessOpen && (
        <Modal
          title={accessEditing
            ? `Editar acceso · ${MEMBER_TYPE_LABEL[pickerFor] || pickerFor}`
            : `Registrar ${MEMBER_TYPE_LABEL[pickerFor] || pickerFor}`}
          onClose={() => setAccessOpen(false)}
        >
          <form onSubmit={handleAccessSubmit}>
            {accessError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{accessError}</div>}

            <div className="field">
              <label htmlFor="af-name">Nombre</label>
              <input id="af-name" className="input" value={accessForm.name} onChange={(e) => setAccessForm({ ...accessForm, name: e.target.value })} placeholder="Nombre completo" required />
            </div>

            <div className="field">
              <label htmlFor="af-paterno">Apellido paterno</label>
              <input id="af-paterno" className="input" value={accessForm.apellido_paterno} onChange={(e) => setAccessForm({ ...accessForm, apellido_paterno: e.target.value })} required />
            </div>

            <div className="field">
              <label htmlFor="af-materno">Apellido materno</label>
              <input id="af-materno" className="input" value={accessForm.apellido_materno} onChange={(e) => setAccessForm({ ...accessForm, apellido_materno: e.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="af-number">
                {pickerFor === 'mto' ? 'Número de empleado (clave checador)' : 'Clave checador'}
              </label>
              <input id="af-number" className="input" value={accessForm.student_number} onChange={(e) => setAccessForm({ ...accessForm, student_number: e.target.value })} disabled={pickerFor === 'externo' && !accessEditing} required />
              {pickerFor === 'externo' && (
                <span className="hint">Se generó una clave EXT- automática para el checador.</span>
              )}
            </div>

            <div className="field">
              <label>Certificado médico</label>
              <input type="file" className="input" accept="image/*,.pdf" onChange={(e) => setAccessCertFile(e.target.files?.[0] || null)} />
            </div>

            <div className="field">
              <label>Fotografía</label>
              <input type="file" className="input" accept="image/*" onChange={(e) => setAccessPhoto(e.target.files?.[0] || null)} />
            </div>

            <div className="form-actions" style={{ marginTop: 22 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setAccessOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={accessSending}>
                {accessSending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Formulario de estudiante reutilizado desde Registros */}
      {studentModalOpen && (
        <StudentFormModal
          student={null}
          defaultTurn={currentUser.role === 'super_admin' ? userTurn(currentUser) : 'mañana'}
          onClose={() => setStudentModalOpen(false)}
          onSaved={() => { setStudentModalOpen(false); fetchAccesos(); showToast('Estudiante registrado para el checador'); }}
        />
      )}

      {/* Formulario de cuenta (se mantiene intacto) */}
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
          tone="danger"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await api.delete(`/users/${deleting.id}`, {
                headers: { 'X-User-Id': currentUser.id }
              });
              setDeleting(null);
              showToast('Usuario eliminado');
              fetchUsers();
            } catch (err) {
              setError(err.response?.data?.error || 'Error al eliminar el usuario');
              setDeleting(null);
            }
          }}
        />
      )}

      {deletingAccess && (
        <ConfirmModal
          title="Quitar acceso al checador"
          message={`¿Seguro que deseas eliminar el acceso de ${deletingAccess.name} (${deletingAccess.student_number})?`}
          confirmLabel="Eliminar acceso"
          tone="danger"
          onClose={() => setDeletingAccess(null)}
          onConfirm={confirmDeleteAccess}
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
          <input id="uf-email" className="input" type="email" placeholder="usuario@ues.mx" value={form.email} onChange={set('email')} required />
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
