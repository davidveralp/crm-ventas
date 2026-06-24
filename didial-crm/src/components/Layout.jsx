import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/',          label: 'Dashboard',   icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { to: '/clientes',  label: 'Clientes',    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1' },
  { to: '/pipeline',  label: 'Pipeline',    icon: 'M4 6h16M4 12h10M4 18h6' },
  { to: '/agenda',    label: 'Agenda',      icon: 'M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { to: '/campanas',  label: 'Campañas',    icon: 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 11-5.8-1.6' },
  { to: '/datos',     label: 'Importar / Exportar', icon: 'M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3' }
]

const NAV_ADMIN = [
  { to: '/usuarios',  label: 'Usuarios',    icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4' }
]

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <path d={d} />
    </svg>
  )
}

export default function Layout({ children }) {
  const { perfil, esAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const item = ({ to, label, icon }) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-sky/20 text-white' : 'text-sky/80 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icon d={icon} />
      <span>{label}</span>
    </NavLink>
  )

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-ink text-white">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-lg font-bold tracking-tight">DIDIAL</div>
          <div className="text-xs text-sky/70">Gestión comercial</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(item)}
          {esAdmin && (
            <>
              <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-sky/40">
                Administración
              </div>
              {NAV_ADMIN.map(item)}
            </>
          )}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 mb-2">
            <div className="text-sm font-medium truncate">{perfil?.nombre}</div>
            <div className="text-xs text-sky/60 capitalize">{perfil?.rol}</div>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/login') }}
            className="w-full text-left rounded-lg px-3 py-2 text-sm text-sky/80 hover:bg-white/5 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra móvil */}
        <header className="md:hidden flex items-center justify-between bg-ink text-white px-4 py-3">
          <span className="font-bold">DIDIAL</span>
          <button onClick={async () => { await logout(); navigate('/login') }}
                  className="text-sm text-sky/80">Salir</button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
        {/* Navegación inferior móvil */}
        <nav className="md:hidden grid grid-cols-5 bg-white border-t border-slate-200">
          {NAV.slice(0, 5).map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                  isActive ? 'text-deep' : 'text-slate-400'
                }`
              }>
              <Icon d={icon} />
              <span>{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
