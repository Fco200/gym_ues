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
  mto: 'MTO (mantenimiento y operación)',
  externo: 'Persona externa'
};

const PICKER_OPTIONS = [
  {
    type: 'estudiante',
    icon: 'user',
    title: 'Estudiante',
    desc: 'Alumno de la UES con expediente, turno y carrera.',
    cta: 'Registrar alumno'
  },
  {
    type: 'mto',
    icon: 'shield',
    title: 'MTO',
    desc: 'Personal de mantenimiento y operación; su número de empleado es la clave.',
    cta: 'Registrar MTO'
  },
  {
    type: 'externo',
    icon: 'key',
    title: 'Persona externa',
    desc: 'Persona externa con clave EXT- autogenerada para el checador.',
    cta: 'Registrar externo'
  }
];

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

// Genera una clave única para personas externas (coincide con el backend)
function generateExternalKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 5; i += 1) {
    key += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `EXT-${key}`;
}

// Separa el nombre completo en nombre / apellido paterno / apellido materno
function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 莆田) return {};
  if (parts.length <= 2) {
    return { name: parts[0], apellido_paterno: parts[1] || '', apellido_materno: '' };
  }
  return {
    name: parts.slice(0, -2).join(' '),
    apellido_paterno: parts[parts.length - 2],
    apellido_materno: parts[parts.length - 1]
  };
}

export default function Usuarios() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === 'super_admin';

  const [tab, setTab] = useState('cuentas');

  // ---- Cuentas del sistema ----
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');
  const [showToast, setShowToast] = useState(false);

  const showToastMessage = (message) => {
    setToast(message);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 3200);
  };

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
  }, [tab]);

  // ---- Accesos al checador (MTO + externos) ----
  const [accesos, setAccesos] = useState([]);
  const [loadingAccesos, setLoadingAccesos] = useState(false);
  const [errorAccesos, setErrorAccesos] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [accesoFormOpen, setAccesoFormOpen] = useState(false);
  const [accesoFormType, setAccesoFormType] = useState('mto');
  const [accesoEditing, setAccesoEditing] = useState(null);
  const [accesoDeleting, setAccesoDeleting] = useState(null);
  const [accesoSending, setAccesoSending] = useState(false);
  const [accesoError, setAccesoError] = useState('');
  const [accesoForm, setAccesoForm] = useState({
    name: '',
    apellido_paterno: '',
    apellido_materno: '',
    student_number: '',
    medical_certificate: false
  });
  const [accesoPhotoFile, setAccesoPhotoFile] = useState(null);
  const [accesoCerFile, setAccesoCerFile] = useState(nullapsed(null));

  const fetchAccesos = async () => {
    setLoadingAccesos(true);
    setErrorAccesos('');
    try {
      const response = await api.get('/students', { params: { member_type: 'access' } });
      setAccesos(response.data);
    } catch (err) {
      setErrorAccesos(err.response?.data?.error || 'No fue posible cargar los accesos al checador');
    } finally {
      setLoadingAccesos(false);
    }
  };

  useEffect(() => {
    if (tab === 'accesos') {
      fetchAccesos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openAccesoForm = (memberType) => {
    setPickerOpen(false);
    setAccesoFormType(memberType);
    setAccesoEditing(null);
    setAccesoForm({
      name: '',
      apellido_paterno: '',
      apellido_materno: '',
      student_number: memberType === 'mto' ? '' : generateExternalKey(),
      medical_certificate: false
    });
    setAccesoPhotoFile(null);
    setAccesoCerFile(nullapsed(null));
    setAccesoError('');
    setAccesoFormOpen(true);
  };

  const openAccesoEdit = (member) => {
    setPickerOpen(false);
    setAccesoEditing(member);
    setAccesoForm({
      name: member.name || '',
      apellido_paterno: member.apellido_paterno || '',
      apellido_materno: member.apellido_materno || '',
      student_number: member.student_number || '',
      medical_certificate: Boolean(member.medical_certificate)
    });
    setAccesoPhotoFile(null);
    setAccesoCerFile(nullapsed(null));
    setAccesoError('');
    setAccesoFormOpen(true);
  };

  const handleAccesoSubmit = async (e) => {
    e.preventDefault();
    setAccesoSending(true);
    setAccesoError('');
    try {
      const fd = new FormData();
      fd.append('member_type', accesoFormType);
      fd.append('student_number', accesoForm.student_number.trim());
      fd.append('name', accesoForm.name.trim());
      fd.append('apellido_paterno', accesoForm.apellido_paterno.trim());
      fd.append('apellido_materno', accesoForm.apellido_materno.trim());
      fd.append('turn', 'general');
      fd.append('medical_certificate', accesoForm.medical_certificate ? '1' : '0');
      if (accesoPhotoFile) fd.append('image', accesoPhotoFile);
      if (accesoCerFile) fd.append('certificate', accesoCerFile);

      if (accesoEditing) {
        await api.patch(`/students/${accesoEditing.id}`, fd);
      } else {
        await api.post('/students', fd);
      }

      setAccesoFormOpen(false);
      setAccesoEditing(null);
      await fetchAccesos();
      showToastMessage(accesoEditing ? 'Acceso actualizado con éxito' : 'Acceso al checador creado con éxito');
    } catch (err) {
      setAccesoError(err.response?.data?.error || 'No fue posible guardar el acceso');
    } finally {
      setAccesoSending(false);
    }
  };

  const handleDeleteAcceso = async () => {
    if (!accesoDeleting) return;
    try {
      await api.delete(`/students/${accesoDeleting.id}`);
      setAccesoDeleting(null);
      await fetchAccesos();
      showToastMessage('Acceso al checador eliminado');
    } catch (err) {
      setAccesoError(err.response?.data?.error || 'No fue posible eliminar el acceso');
      setAccesoDeleting(null);
    }
  };

  const renderAccesosTab = () => (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Accesos al checador ({accesos.length})</h2>
          <p className="card-muted">
            Personal MTO y personas externas con clave para el checador biométrico.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setPickerOpen(true)}>
          <Icon name="plus" size={16} />
          Agregar acceso
        </button>
      </div>

      {errorAccesos && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errorAccesos}</div>}

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
                      <div className="avatar avatar-sm">
                        {a.image_url ? <img src={a.image_url} alt="" /> : (a.name || '?')[0]?.toUpperCase()}
                      </div>
                      <strong>{a.name} {a.apellido_paterno || ''}{a.apellido_materno ? ` ${a.apellido_materno}` : ''}</strong>
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
                      <button type="button" className="icon-btn" title="Editar acceso" onClick={() => setPickerOpen(false) || openAccesoEdit(a)}>
                        <Icon name="edit" size={16} />
                      </button>
                      <button type="button" className="icon-btn danger" title="Eliminar acceso" onClick={() => setAccesoDeleting(a)}>
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
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="section-title">Usuarios del sistema</h2>
          <p className="section-subtitle">
            Administra las cuentas del sistema y los accesos al checador del gimnasio.
          </p>
        </div>
      </div>

      <div className="segmented" role="tablist" aria-label="Secciones de usuarios">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'cuentas'}
          className={tab === 'cuentas' ? 'active' : ''}
          onClick={() => setTab('cuentas')}
        >
          Cuentas del sistema
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'accesos'}
          className={tab === 'accesos' ? 'active' : ''}
          onClick={() => setTab('accesos')}
        >
          Accesos al checador
        </button>
      </div>

      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}

      {tab === 'cuentas' ? (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Cuentas del sistema ({users.length})</h2>
              <p className="card-muted">
                Administra las cuentas de instructores y super administradores.
              </p>
            </div>
          </div>

          <div className="toolbar">
            <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Icon name="plus" size={16} />
              Nuevo usuario
            </button>
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
                    const isSelf = u.id === user.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="url-row">
                            <div className="avatar avatar-sm">
                              {u.image_url ? <img src={u.image_url} alt="" /> : (u.name || '?')[0]?.toUpperCase()}
                            </div>
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
                            <button
                              type="button"
                              className="icon-btn"
                              title="Editar usuario"
                              onClick={() => { setEditing(u); setFormOpen(true); }}
                            >
                              <Icon name="edit" size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              title="Eliminar usuario"
                              disabled={isSelf}
                              onClick={() => setDeleting(u)}
                            >
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
      ) : (
        renderAccesosTab()
      )}

      {/* Selector de tipo de integrante */}
      {pickerOpen && (
        <Modal title="Registrar acceso al checador" onClose={() => setPickerOpen(false)}>
          <div className="option-grid">
            {PICKER_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.type}
                className="option-card"
                onClick={() => {
                  if (opt.type === 'estudiante') {
                    setPickerOpen(false);
                    setEditing(null);
                    setFormOpen(true);
                  } else {
                    openAccesoForm(opt.type);
                  }
                }}
              >
                <span className="option-icon"><Icon name={opt.icon} size={20} /></span>
                <strong>{opt.title}</strong>
                <span className="option-desc">{opt.desc}</span>
                <span className="option-cta">{opt.cta} <Icon name="arrowRight" size={14} /></span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Formulario de acceso (MTO / externo) */}
      {accesoFormOpen && (
        <Modal
          title={accesoEditing
            ? 'Editar acceso al checador'
            : accesoFormType === 'mto' ? 'Registrar MTO' : 'Registrar persona externa'}
          onClose={() => { setAccesoFormOpen(false); setAccesoEditing(null); }}
        >
          <form onSubmit={handleAccesoSubmit}>
            {accesoError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{accesoError}</div>}

            <div className="field">
              <label htmlFor="af-name">Nombre(s) *</label>
              <input id="af-name" className="input" value={accesoForm.name} onChange={(e) => setAccesoForm({ ...accesoForm, name: e.target.value })} placeholder="Nombre completo" required />
            </div>

            <div className="field">
              <label htmlFor="af-paterno">Apellido paterno</label>
              <input id="af-paterno" className="input" value={accesoForm.apellido_paterno} onChange={(e) => setAccesoForm({ ...accesoForm, apellido_paterno: e.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="af-materno">Apellido materno</label>
              <input id="af-materno" className="input" value={accesoForm.apellido_materno} onChange={(e) => setAccesoForm({ ...accesoForm, apellido_materno: e.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="af-number">Clave para el checador *</label>
              <input id="af-number" className="input" value={accesoForm.student_number} onChange={(e) => setAccesoForm({ ...accesoForm, student_number: e.target.value })} required disabled={accesoFormType === 'externo' && !accesoEditing} />
              {accesoFormType === 'externo' && (
                <p className="hint">Se generó una clave EXT- automática para el checador.</p>
              )}
            </div>

            <div className="field">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={accesoForm.medical_certificate}
                  onChange={(e) => setAccesoForm({ ...accesoForm, medical_certificate: e.target.checked })}
                />
                <span>Cuenta con certificado médico vigente</span>
              </label>
            </div>

            {accesoForm.medical_certificate && (
              <div className="field">
                <label htmlFor="af-cert">Certificado médico (archivo)</label>
                <input id="af-cert" className="input" type="file" accept="image/*,.pdf" onChange={(e) => setAccesoCerFile(e.target.files?.[0] || null)} />
              </div>
            )}

            <div className="field">
              <label htmlFor="af-photo">Fotografía</label>
              <input id="af-photo" className="input" type="file" accept="image/*" onChange={(e) => setAccesoPhotoFile(e.target.files?.[0] || null)} />
            </div>

            <div className="form-actions" style={{ marginTop: 22 }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setAccesoFormOpen(false); setAccesoEditing(null); }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={accesoSending}>
                {accesoSending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Formulario de estudiante (reutiliza el modal de Registros) */}
      {formOpen && tab === 'cuentas' && !editing && (
        <StudentFormModal
          student={null}
          defaultTurn={userTurn({ turn: 'mañana' })}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            showToastMessage('Estudiante registrado con éxito');
            fetchAccesos();
          }}
        />
      )}

      {formOpen && editing && (
        <UserFormModal
          user={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            showToastMessage(editing ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito');
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
              await api.delete(`/users/${deleting.id}`);
              setDeleting(null);
              showToastMessage('Usuario eliminado');
              fetchUsers();
            } catch (err) {
              setError(err.response?.data?.error || 'No fue posible eliminar el usuario');
              setDeleting(null);
            }
          }}
          onClose={() => setDeleting(null)}
        />
      )}

      {accesoDeleting && (
        <ConfirmModal
          title="Quitar acceso al checador"
          message={`¿Seguro que deseas eliminar el acceso de ${accesoDeleting.name} (${accesoDeleting.student_number})?`}
          confirmLabel="Eliminar acceso"
          onConfirm={handleDeleteAcceso}
          onClose={() => setAccesoDeleting(null)}
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
