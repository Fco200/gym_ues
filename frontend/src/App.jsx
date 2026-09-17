import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import Checador from './components/Checador';
import Dashboard from './components/Dashboard';
import Registros from './components/Registros';
import Reportes from './components/Reportes';
import Horarios from './components/Horarios';
import Reglamento from './components/Reglamento';
import Usuarios from './components/Usuarios';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/dashboard/registros" replace /> : <Login />}
      />

      <Route path="/checador" element={<Checador />} />

      <Route path="/dashboard" element={<Dashboard />}>
        <Route index element={<Navigate to="registros" replace />} />
        <Route path="horarios" element={<Horarios />} />
        <Route path="reglamento" element={<Reglamento />} />
        <Route path="registros" element={<Registros />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="usuarios" element={<Usuarios />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}