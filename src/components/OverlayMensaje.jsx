import { useEffect, useRef, useState, useCallback } from 'react';

// Overlay full-screen con mensaje centrado que se autohide a los 4000 ms.
const DURACION = 4000;

export default function OverlayMensaje({ mensaje }) {
  // mensaje: { texto, tipo: 'exito'|'error'|'info' }
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!mensaje) return undefined;

    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), DURACION);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mensaje]);

  // Re-render al cambiar timestamps para re-arrancar la animacion
  useEffect(() => {
    if (mensaje) setVisible(true);
  }, [mensaje?.id, mensaje?.texto]);

  if (!mensaje || !visible) return null;

  const titulo =
    mensaje.tipo === 'exito'
      ? '\u2714 Correcto'
      : mensaje.tipo === 'error'
        ? '\u2716 Error'
        : '\u2139 Información';

  return (
    <div className={`overlay-mensaje ${mensaje.tipo || 'info'}`}>
      <div className={`overlay-mensaje-caja ${mensaje.tipo || 'info'}`}>
        <h3>{titulo}</h3>
        <p>{mensaje.texto}</p>
      </div>
    </div>
  );
}

// Hook auxiliar: devuelve el estado de mensaje y una funcion para mostrarlo
export function useMensaje() {
  const [mensaje, setMensaje] = useState(null);

  const mostrar = useCallback((texto, tipo = 'info') => {
    setMensaje({ texto, tipo, id: Date.now() + Math.random() });
  }, []);

  return { mensaje, mostrar };
}