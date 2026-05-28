import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', exact: true },
  { to: '/en-proceso', label: 'En Proceso', icon: '⚙️' },
  { to: '/terminados', label: 'Terminados', icon: '📦' },
  { to: '/historial', label: 'Historial', icon: '📋' },
];

const NAV_VENDEDOR = [
  { to: '/nuevo-pedido', label: 'Nuevo Pedido', icon: '➕' },
];

const NAV_ADMIN = [
  { to: '/nuevo-pedido', label: 'Nuevo Pedido', icon: '➕' },
  { to: '/usuarios', label: 'Usuarios', icon: '👥' },
  { to: '/reportes', label: 'Reportes', icon: '📈' },
];

const ROL_LABEL = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  PRODUCCION: 'Producción',
};

export default function Sidebar({ open, onClose }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const extraNav =
    usuario?.rol === 'ADMINISTRADOR' ? NAV_ADMIN :
    usuario?.rol === 'VENDEDOR' ? NAV_VENDEDOR : [];

  const allNav = [...NAV, ...extraNav];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-gray-900 border-r border-gray-800
        flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center"><img src="https://i.imgur.com/M4GONM5.png" alt="InCollege" className="w-full h-full object-contain" /></div>
        <div>
          <p className="text-white font-bold text-sm leading-none">InCollege</p>
          <p className="text-gray-500 text-xs">Sistema de Agregados</p>
        </div>
        <button
          className="ml-auto lg:hidden text-gray-400 hover:text-white"
          onClick={onClose}
        >✕</button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {allNav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.exact}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand/15 text-brand'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-brand">
            {usuario?.nombre?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{usuario?.nombre}</p>
            <p className="text-xs text-gray-400">{ROL_LABEL[usuario?.rol]}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
