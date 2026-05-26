import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EnProceso from './pages/EnProceso';
import Terminados from './pages/Terminados';
import Historial from './pages/Historial';
import NuevoPedido from './pages/NuevoPedido';
import DetallePedido from './pages/DetallePedido';
import Usuarios from './pages/Usuarios';
import Reportes from './pages/Reportes';

function PrivateRoute({ children, roles }) {
  const { usuario, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { usuario } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="en-proceso" element={<EnProceso />} />
        <Route path="terminados" element={<Terminados />} />
        <Route path="historial" element={<Historial />} />
        <Route path="nuevo-pedido" element={<PrivateRoute roles={['VENDEDOR', 'ADMINISTRADOR']}><NuevoPedido /></PrivateRoute>} />
        <Route path="pedidos/:id" element={<DetallePedido />} />
        <Route path="usuarios" element={<PrivateRoute roles={['ADMINISTRADOR']}><Usuarios /></PrivateRoute>} />
        <Route path="reportes" element={<PrivateRoute roles={['ADMINISTRADOR']}><Reportes /></PrivateRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
