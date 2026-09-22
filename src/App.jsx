import { Routes, Route } from 'react-router-dom';
import ChecadorKiosco from './pages/ChecadorKiosco.jsx';
import RegistroAlumno from './pages/RegistroAlumno.jsx';
import AdminPortal from './pages/AdminPortal.jsx';
import Asistencia from './pages/Asistencia.jsx';

/**
 * Gym UES - Enrutador principal.
 * La raiz "/" muestra el ChecadorKiosco (pantalla limpia sin menu hamburguesa;
 * el unico acceso a administracion es el candado discreto del kiosco).
 * Las demas paginas incluyen su propia BarraUES.
 */
export default function App() {
  return (
    <div className="app">
      <main className="contenido">
        <Routes>
          <Route path="/" element={<ChecadorKiosco />} />
          <Route path="/registro" element={<RegistroAlumno />} />
          <Route path="/admin" element={<AdminPortal />} />
          <Route path="/asistencia" element={<Asistencia />} />
        </Routes>
      </main>
    </div>
  );
}