import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import OverlayMensaje, { useMensaje } from '../components/OverlayMensaje.jsx';
import Modal from '../components/Modal.jsx';
import ModalTexto from '../components/ModalTexto.jsx';
import ModalPDF from '../components/ModalPDF.jsx';
import ChatBotUES from '../components/ChatBotUES.jsx';
import FormularioRegistro from '../components/FormularioRegistro.jsx';
import {
  checarEntrada,
  checarSalida,
  getSettings,
  consultarMiembro,
  contadorHoyPublico,
  registroPublico,
  urlArchivo
} from '../services/api.js';

const ETIQUETA_TIPO = {
  alumno: 'Alumno',
  maestro: 'Maestro',
  exterior: 'Persona exterior'
};

/**
 * ChecadorKiosco - Pantalla principal EXCLUSIVA para el checador.
 * Entrada/Salida SOLO para miembros YA registrados: se valida el codigo contra
 * la tabla students; si no existe, se rechaza con un aviso. Tras registrar se
 * muestra la tarjeta del miembro (foto, tipo, turno y carrera). Incluye:
 * - Boton "Consultar mi asistencia" (consulta publica del historial propio).
 * - Contadores en vivo del dia (total, entradas, salidas).
 * - Chatbot lateral con respuestas predefinidas (rutinas, horarios, reglamento).
 * - Botones para ver Reglamento y Horarios.
 */
export default function ChecadorKiosco() {
  const [hora, setHora] = useState(new Date());
  const [procesando, setProcesando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [config, setConfig] = useState(null);
  const [documento, setDocumento] = useState(null);
  const [miembro, setMiembro] = useState(null);
  const [contador, setContador] = useState({ total: 0, entradas: 0, salidas: 0 });
  const [modoConsulta, setModoConsulta] = useState(false);
  const [consultaCodigo, setConsultaCodigo] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [autoRegistro, setAutoRegistro] = useState(false);
  const { mensaje, mostrar } = useMensaje();

  // Reloj en tiempo real (se actualiza cada segundo)
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Carga configuracion (reglamento/horarios) y contadores del dia
  useEffect(() => {
    getSettings()
      .then((s) => setConfig(s && typeof s === 'object' ? s : null))
      .catch(() => {
        /* sin BD: se muestran los textos en el modal */
      });
    refrescarContador();
    const t = setInterval(refrescarContador, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refrescarContador = async () => {
    try {
      setContador(await contadorHoyPublico());
    } catch {
      /* sin conexion: se dejan los valores anteriores */
    }
  };

  const fechaLarga = hora.toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const horaTxt = hora.toLocaleTimeString('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Registra la asistencia por clave (entrada o salida) SOLO a miembros dados
  // de alta. El backend rechaza cualquier clave no registrada.
  const registrar = async (tipo, cerrarConsulta = true) => {
    const clave = codigo.trim();
    if (!clave) {
      mostrar('Ingrese la clave o codigo del miembro.', 'error');
      return;
    }
    if (procesando) return;
    setProcesando(true);
    try {
      const res =
        tipo === 'entrada'
          ? await checarEntrada({ method: 'manual', student_code: clave })
          : await checarSalida({ student_code: clave });
      if (res.yaRegistrado) {
        mostrar(res.mensaje || 'Ya se registro un movimiento hace poco.', 'info');
      } else {
        mostrar(res.mensaje || 'Registro correcto.', 'exito');
      }
      // Carga la tarjeta del miembro (foto, turno, carrera, etc.)
      consultarMiembro(clave)
        .then((data) => setMiembro(data))
        .catch(() => {
          /* sin detalle: solo se muestra el mensaje */
        });
      refrescarContador();
      if (cerrarConsulta) setModoConsulta(false);
      setCodigo('');
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setProcesando(false);
    }
  };

  // Consulta publica del historial de un miembro en el checador
  const consultar = async (e) => {
    e.preventDefault();
    const clave = consultaCodigo.trim();
    if (!clave) {
      mostrar('Ingrese la clave del miembro a consultar.', 'error');
      return;
    }
    if (consultando) return;
    setConsultando(true);
    try {
      const data = await consultarMiembro(clave);
      setMiembro(data);
    } catch (err) {
      setMiembro(null);
      mostrar(err.message, 'error');
    } finally {
      setConsultando(false);
    }
  };

  const abrirDoc = async (tipo) => {
    try {
      if (!config) {
        const cfg = await getSettings();
        setConfig(cfg);
      }
      setDocumento(tipo);
    } catch (err) {
      mostrar('No se pudo cargar el documento.', 'error');
    }
  };

  const cerrarDoc = () => setDocumento(null);

  // Auto-registro abierto del checador: alumnos, maestros y personas exteriores
  // se guardan en la tabla students (endpoint publico sin sesion).
  const guardarAutoRegistro = async (payload) => {
    const res = await registroPublico(payload);
    const generada = res.estudiante?.student_code;
    mostrar(
      res.mensaje + (generada ? ` Bienvenido. Su clave es: ${generada}.` : ''),
      'exito'
    );
    setAutoRegistro(false);
    // Muestra la tarjeta del recien registrado para que conozca su clave y datos.
    if (generada) {
      consultarMiembro(generada)
        .then((data) => setMiembro(data))
        .catch(() => {
          /* sin detalle: solo el mensaje */
        });
      setCodigo('');
    }
  };

  return (
    <div className="kiosco">
      {/* Barra superior del kiosco: solo marca + candado discreto a admin */}
      <div className="kiosco-barra">
        <div className="kiosco-marca">
          <img
            src="img/logo_ues.png"
            alt="Logo UES - Gimnasio"
            className="kiosco-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span>GYM UES</span>
          <small>CHECADOR</small>
        </div>
        <Link to="/admin" className="kiosco-admin" title="Portal Admin">
          {'\uD83D\uDD12'}
        </Link>
      </div>

      <div className="kiosco-mosaico">
        {/* ---------- Columna principal del checador ---------- */}
        <div className="kiosco-columna kiosco-col-principal">
          {/* Logo grande centrado */}
          <div className="kiosco-logotipo">
            <img
              src="img/logo_ues.png"
              alt="Logo UES - Gimnasio"
              className="kiosco-logo-grande"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Reloj digital en tiempo real */}
          <div className="kiosco-reloj">
            <div className="kiosco-fecha">{fechaLarga}</div>
            <div className="kiosco-hora">{horaTxt}</div>
            <p className="kiosco-sub">
              {procesando
                ? 'Procesando su asistencia...'
                : 'Ingrese su clave o codigo para registrar su entrada o salida'}
            </p>
          </div>

          {/* Contadores del dia (publico) */}
          <div className="kiosco-contadores">
            <div className="kiosco-contador">
              <b>{contador.total}</b>
              <span>Registros hoy</span>
            </div>
            <div className="kiosco-contador">
              <b>{contador.entradas}</b>
              <span>Entradas</span>
            </div>
            <div className="kiosco-contador">
              <b>{contador.salidas}</b>
              <span>Salidas</span>
            </div>
          </div>

          {/* Clave del miembro (siempre visible) */}
          <div className="kiosco-manual kiosco-clave">
            <div className="kiosco-manual-caja">
              <label className="kiosco-clave-label">Clave o codigo del miembro</label>
              <input
                type="text"
                inputMode="numeric"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej. GYM-000001 o la clave del alumno"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') registrar('entrada');
                }}
                disabled={procesando}
                autoFocus
              />
              <p className="kiosco-clave-aviso">
                Solo los miembros registrados pueden checar su asistencia.
              </p>
            </div>
          </div>

          {/* Botones grandes de entrada / salida */}
          <div className="kiosco-botones">
            <button
              type="button"
              className="kiosco-boton kiosco-entrada"
              onClick={() => registrar('entrada')}
              disabled={procesando || !codigo.trim()}
            >
              <span className="kiosco-boton-ico">{'\uD83D\uDD53'}</span>
              <span className="kiosco-boton-txt">Registrar Entrada</span>
              <span className="kiosco-boton-sub">con clave</span>
            </button>

            <button
              type="button"
              className="kiosco-boton kiosco-salida"
              onClick={() => registrar('salida')}
              disabled={procesando || !codigo.trim()}
            >
              <span className="kiosco-boton-ico">{'\u23F8'}</span>
              <span className="kiosco-boton-txt">Registrar Salida</span>
              <span className="kiosco-boton-sub">con clave</span>
            </button>
          </div>

          {/* Botones de informacion: Reglamento y Horarios */}
          <div className="kiosco-docs">
            <button
              type="button"
              className="kiosco-doc-boton"
              onClick={() => abrirDoc('reglamento')}
            >
              <span className="kiosco-doc-ico">{'\uD83D\uDCD6'}</span>
              Reglamento
            </button>
            <button
              type="button"
              className="kiosco-doc-boton"
              onClick={() => abrirDoc('horarios')}
            >
              <span className="kiosco-doc-ico">{'\uD83D\uDDD3'}</span>
              Horarios
            </button>
            <button
              type="button"
              className="kiosco-doc-boton kiosco-autoregistro"
              onClick={() => setAutoRegistro(true)}
              title="Registrate como alumno, maestro o persona exterior"
            >
              <span className="kiosco-doc-ico">{'\uD83D\uDCDD'}</span>
              Auto-registro
            </button>
          </div>
        </div>

        {/* ---------- Columna lateral: consulta, tarjeta y chatbot ---------- */}
        <div className="kiosco-columna kiosco-col-lateral">
          {/* Consultar mi asistencia */}
          <div className="kiosco-consulta panel-chico">
            <button
              type="button"
              className="kiosco-consulta-toggle"
              onClick={() => setModoConsulta((v) => !v)}
              title="Consultar historial de asistencia por clave"
            >
              {modoConsulta ? '\u25BC' : '\u25B6'} Consultar mi asistencia
            </button>
            {modoConsulta && (
              <form onSubmit={consultar} className="kiosco-consulta-form">
                <input
                  value={consultaCodigo}
                  onChange={(e) => setConsultaCodigo(e.target.value)}
                  placeholder="Clave del miembro"
                  disabled={consultando}
                />
                <button type="submit" disabled={consultando || !consultaCodigo.trim()}>
                  {consultando ? '...' : 'Buscar'}
                </button>
              </form>
            )}
          </div>

          {/* Tarjeta del miembro (al checar o al consultar) */}
          {miembro && (
            <div className="tarjeta-miembro panel-chico">
              <div className="tarjeta-miembro-cab">
                <div className="tarjeta-miembro-foto">
                  {miembro.estudiante.image_url ? (
                    <img src={urlArchivo(miembro.estudiante.image_url)} alt="Foto" />
                  ) : (
                    <span>{miembro.estudiante.full_name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="tarjeta-miembro-info">
                  <h3>{miembro.estudiante.full_name}</h3>
                  <span className="tarjeta-miembro-clave">{miembro.estudiante.student_code}</span>
                  <span className={`etiqueta-tipo ${miembro.estudiante.type === 'alumno' ? 'etiqueta-alumno' : miembro.estudiante.type === 'maestro' ? 'etiqueta-maestro' : 'etiqueta-exterior'}`}>
                    {ETIQUETA_TIPO[miembro.estudiante.type] || miembro.estudiante.type}
                  </span>
                </div>
              </div>
              <div className="tarjeta-miembro-detalle">
                {miembro.estudiante.career && (
                  <p>
                    <span>Carrera / Area</span>
                    <b>{miembro.estudiante.career}</b>
                  </p>
                )}
                {miembro.estudiante.turn && (
                  <p>
                    <span>Turno</span>
                    <b>{miembro.estudiante.turn}</b>
                  </p>
                )}
                <p>
                  <span>Certificado medico</span>
                  <b className={miembro.estudiante.certificadoVigente ? 'texto-exito' : 'texto-error'}>
                    {miembro.estudiante.certificadoVigente ? 'Vigente' : 'No registrado'}
                  </b>
                </p>
              </div>
              {miembro.registros.length > 0 && (
                <div className="tarjeta-miembro-historial">
                  <strong>Ultimas asistencias</strong>
                  <table>
                    <thead>
                      <tr>
                        <th>Entrada</th>
                        <th>Salida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {miembro.registros.map((r) => (
                        <tr key={r.id}>
                          <td>{r.check_in || '—'}</td>
                          <td>{r.check_out || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Chatbot lateral con respuestas predefinidas */}
          <ChatBotUES lateral />
        </div>
      </div>

      {/* Modal de auto-registro (alumno / maestro / exterior) */}
      {autoRegistro && (
        <Modal
          titulo="Auto-registro · Gimnasio UES"
          onClose={() => setAutoRegistro(false)}
          mostrarLogo
        >
          <p className="aviso-info">
            Regístrate como alumno, maestro o persona exterior. Una vez registrado podrás
            checar tu entrada y salida con la clave asignada.
          </p>
          <FormularioRegistro
            onGuardar={guardarAutoRegistro}
            botonTexto="Registrarme"
            tituloGratis="Conserve la clave que se le muestre al final; servirá para checar su asistencia."
          />
        </Modal>
      )}

      {/* Modal de documento (PDF si hay URL, texto si no) */}
      {documento && (
        config && config[`${documento}_pdf`] ? (
          <ModalPDF
            titulo={documento === 'reglamento' ? 'Reglamento del Gimnasio' : 'Horarios del Gimnasio'}
            url={config[`${documento}_pdf`]}
            onClose={cerrarDoc}
          />
        ) : (
          <ModalTexto
            titulo={documento === 'reglamento' ? 'Reglamento del Gimnasio' : 'Horarios del Gimnasio'}
            texto={config && config[documento]}
            onClose={cerrarDoc}
          />
        )
      )}

      {/* Mensaje de confirmacion flotante, centrado, 4 segundos */}
      <OverlayMensaje mensaje={mensaje} />
    </div>
  );
}