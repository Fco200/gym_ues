import { useEffect, useState } from 'react';
import HeaderAdmin from '../components/HeaderAdmin.jsx';
import FormLogin from '../components/FormLogin.jsx';
import GestionAlumnos from '../components/GestionAlumnos.jsx';
import ConfiguracionAvisos from '../components/ConfiguracionAvisos.jsx';
import GestionUsuarios from '../components/GestionUsuarios.jsx';
import Asistencia from './Asistencia.jsx';
import OverlayMensaje, { useMensaje } from '../components/OverlayMensaje.jsx';
import {
  login,
  logout,
  guardarSesion,
  cerrarSesionLocal,
  estadoAuth,
  restablecerPasswordPublico,
  crearAdminPrueba
} from '../services/api.js';
import {
  puedeConfiguracion,
  puedeGestionarUsuarios,
  etiquetaRol
} from '../services/roles.js';

const PESTANAS = [
  { id: 'alumnos', etiqueta: 'Gestion de Alumnos' },
  { id: 'asistencia', etiqueta: 'Historial de Asistencias' },
  { id: 'usuarios', etiqueta: 'Usuarios del Sistema' },
  { id: 'config', etiqueta: 'Configuracion y Avisos' }
];

export default function AdminPortal() {
  const [autenticado, setAutenticado] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState('alumnos');
  const [estadoBd, setEstadoBd] = useState(null);
  const [cuentasAdmin, setCuentasAdmin] = useState([]);
  const [trabajando, setTrabajando] = useState(false);
  const { mensaje, mostrar } = useMensaje();

  const rolActual = usuario?.role;
  const esAdmin = puedeConfiguracion(rolActual);
  const esSuperAdmin = puedeGestionarUsuarios(rolActual);
  const pestanasVisibles = PESTANAS.filter(
    (p) =>
      (p.id !== 'config' || esAdmin) && (p.id !== 'usuarios' || esSuperAdmin)
  );

  useEffect(() => {
    // Siempre se muestra el login (no se restaura la sesion automaticamente).
    setCargando(false);
    estadoAuth()
      .then((res) => {
        setEstadoBd(Boolean(res.db));
        setCuentasAdmin(Array.isArray(res.cuentas) ? res.cuentas : []);
      })
      .catch(() => {
        setEstadoBd(false);
        setCuentasAdmin([]);
      });
  }, []);

  const iniciar = async (username, password) => {
    const ok = window.confirm('¿Desea iniciar sesión en el panel de administración?');
    if (!ok) return;
    try {
      const res = await login(username, password);
      guardarSesion(res.token, res.usuario);
      setUsuario(res.usuario || null);
      setAutenticado(true);
      setPestana('alumnos');
      mostrar('Sesión iniciada correctamente.', 'exito');
    } catch (err) {
      mostrar(err.message, 'error');
    }
  };

  const restablecer = async (recForm) => {
    const ok = window.confirm('¿Restablecer la contraseña de este usuario?');
    if (!ok) return;
    setTrabajando(true);
    try {
      const res = await restablecerPasswordPublico(recForm);
      mostrar(res.mensaje, 'exito');
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setTrabajando(false);
    }
  };

  const crearAdmin = async (secForm) => {
    const ok = window.confirm('¿Crear esta cuenta de administrador?');
    if (!ok) return;
    setTrabajando(true);
    try {
      const res = await crearAdminPrueba(secForm);
      mostrar(res.mensaje, 'exito');
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setTrabajando(false);
    }
  };

  const terminarSesion = async () => {
    const ok = window.confirm('¿Desea cerrar la sesión y salir del panel?');
    if (!ok) return;
    try {
      await logout();
    } catch {
      /* sin conexion */
    }
    cerrarSesionLocal();
    setUsuario(null);
    setAutenticado(false);
    setPestana('alumnos');
  };

  if (cargando) {
    return <p className="texto-centrado">Cargando portal...</p>;
  }

  // ---------- FormLogin (tarjeta unificada + modales) ----------
  if (!autenticado) {
    return (
      <>
        <FormLogin
          estadoBd={estadoBd}
          cuentasAdmin={cuentasAdmin}
          trabajando={trabajando}
          onLogin={iniciar}
          onRestablecer={restablecer}
          onCrearAdmin={crearAdmin}
        />
        <OverlayMensaje mensaje={mensaje} />
      </>
    );
  }

  // ---------- FormAdmin (dashboard con tabs) ----------
  return (
    <div className="admin-dashboard">
      <HeaderAdmin usuario={usuario} onSalir={terminarSesion} />

      {!esSuperAdmin && rolActual && rolActual !== 'super_admin' && (
        <div className="aviso-info aviso-restriccion">
          Modo restringido ({etiquetaRol(rolActual)}): solo ve lo permitido por su
          rol. La configuracion institucional es de super_admin / admin.
        </div>
      )}

      <div className="admin-tabs panel">
        {pestanasVisibles.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`admin-tab ${pestana === p.id ? 'activa' : ''}`}
            onClick={() => setPestana(p.id)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'alumnos' && <GestionAlumnos />}
      {pestana === 'asistencia' && <Asistencia embedded />}
      {pestana === 'usuarios' && esSuperAdmin && <GestionUsuarios />}
      {pestana === 'config' && esAdmin && <ConfiguracionAvisos />}

      <OverlayMensaje mensaje={mensaje} />
    </div>
  );
}