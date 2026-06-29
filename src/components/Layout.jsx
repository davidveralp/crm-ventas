import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useConfig } from '../context/ConfigContext'
import Recordatorios from './Recordatorios'

const ICONS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  clientes:  'M16 7a4 4 0 11-8 0 4 4 0 018 0zM3 21v-1a6 6 0 0112 0v1',
  pipeline:  'M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z',
  gestiones: 'M9 4h6v2h2a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h2V4zM8.5 13.5l2 2 4-4',
  calendario:'M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  campanas:  'M3 11l14-7v16L3 13zM3 11v2a3 3 0 003 3l1 4',
  presupuestos: 'M9 7h6m-6 4h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
  datos:     'M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3',
  informes:  'M4 19V5m0 14h16M8 17V9m4 8V6m4 11v-5',
  usuarios:  'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z',
  email:     'M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1zM3.5 7.5l8.5 6 8.5-6',
  nuevaot:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M12 11v6m-3-3h6'
}

const GRUPOS = [
  { titulo: null, items: [
    { to: '/', label: 'Dashboard', icon: 'dashboard' }
  ]},
  { titulo: 'Comercial', items: [
    { to: '/clientes',   label: 'Clientes',   icon: 'clientes',   feature: 'crm' },
    { to: '/pipeline',   label: 'Pipeline',   icon: 'pipeline',   feature: 'crm' },
    { to: '/gestiones',  label: 'Gestiones',  icon: 'gestiones',  feature: 'crm' },
    { to: '/campanas',   label: 'Campañas',   icon: 'campanas',   feature: 'campanas' },
    { to: '/calendario', label: 'Calendario', icon: 'calendario', feature: 'agenda', alerta: true },
    { to: '/nueva-ot',   label: 'Nueva OT',   icon: 'nuevaot',    feature: 'ot' }
  ]},
  { titulo: 'Datos', items: [
    { to: '/presupuestos', label: 'Presupuestos', icon: 'presupuestos', feature: 'crm' },
    { to: '/datos', label: 'Importar / Exportar', icon: 'datos', feature: 'crm' }
  ]}
]
const GRUPO_ADMIN = { titulo: 'Administración', items: [
  { to: '/email', label: 'Email marketing', icon: 'email', feature: 'marketing' },
  { to: '/informes', label: 'Informes', icon: 'informes', feature: 'informes' },
  { to: '/usuarios', label: 'Usuarios', icon: 'usuarios' }
]}

const MOVIL = [
  { to: '/', label: 'Inicio', icon: 'dashboard' },
  { to: '/clientes', label: 'Clientes', icon: 'clientes', feature: 'crm' },
  { to: '/gestiones', label: 'Gestiones', icon: 'gestiones', feature: 'crm' },
  { to: '/calendario', label: 'Agenda', icon: 'calendario', feature: 'agenda' },
  { to: '/campanas', label: 'Campañas', icon: 'campanas', feature: 'campanas' }
]

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d={d} />
    </svg>
  )
}

export default function Layout({ children }) {
  const { perfil, esAdmin, logout } = useAuth()
  const { tieneFeature, nombre } = useConfig()
  const navigate = useNavigate()
  const [alertas, setAlertas] = useState(0)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const hoy = new Date().toISOString().slice(0, 10)
      const { count } = await supabase.from('actividades')
        .select('id', { count: 'exact', head: true })
        .lte('proxima_fecha', hoy)
        .in('resultado', ['pendiente', 'no_contesta', 'reagendar', 'compromiso'])
      if (vivo) setAlertas(count || 0)
    })().catch(() => {})
    return () => { vivo = false }
  }, [])

  const item = ({ to, label, icon, alerta }) => (
    <NavLink key={to} to={to} end={to === '/'}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl pl-2.5 pr-3 py-2 text-sm font-medium transition-all ${
          isActive
            ? 'bg-gradient-to-r from-white/12 to-white/[0.02] text-white ring-1 ring-white/10'
            : 'text-sky/70 hover:text-white hover:bg-white/[0.06]'
        }`
      }>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-didial-red" />}
          <span className={`grid place-items-center w-7 h-7 rounded-lg transition-colors ${
            isActive ? 'bg-didial-red text-white' : 'bg-white/5 text-sky/70 group-hover:text-white'
          }`}>
            <Icon d={ICONS[icon]} />
          </span>
          <span>{label}</span>
          {alerta && alertas > 0 && (
            <span className="ml-auto inline-grid place-items-center min-w-[18px] h-[18px] px-1
                             rounded-full bg-didial-red text-white text-[10px] font-bold">
              {alertas}
            </span>
          )}
        </>
      )}
    </NavLink>
  )

  const grupo = (g) => {
    const items = g.items.filter((it) => !it.feature || tieneFeature(it.feature))
    if (!items.length) return null
    return (
      <div key={g.titulo || 'main'} className="space-y-1">
        {g.titulo && (
          <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky/35">
            {g.titulo}
          </div>
        )}
        {items.map(item)}
      </div>
    )
  }

  return (
    <div className="h-full flex">
      <Recordatorios />
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col carbon-sidebar text-white">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-didial-red text-white font-bold">{(nombre || 'D').slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="text-base font-bold tracking-tight leading-none">{nombre || 'CRM'}</div>
            <div className="text-[11px] text-sky/60 mt-1">Gestión comercial</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          {GRUPOS.map(grupo)}
          {esAdmin && grupo(GRUPO_ADMIN)}
        </nav>
        <div className="px-3 py-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-2">
            <div className="grid place-items-center w-8 h-8 rounded-full bg-white/10 text-sm font-semibold">
              {(perfil?.nombre || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{perfil?.nombre}</div>
              <div className="text-xs text-sky/55 capitalize">{perfil?.rol}</div>
            </div>
          </div>
          <button onClick={async () => { await logout(); navigate('/login') }}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm text-sky/75 hover:bg-white/5 hover:text-white transition-colors">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between carbon-sidebar text-white px-4 py-3">
          <span className="font-bold tracking-tight">{nombre || 'CRM'}</span>
          <button onClick={async () => { await logout(); navigate('/login') }}
                  className="text-sm text-sky/80">Salir</button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
        <nav className="md:hidden grid grid-cols-5 bg-white border-t border-slate-200">
          {MOVIL.filter((m) => !m.feature || tieneFeature(m.feature)).map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] ${isActive ? 'text-deep' : 'text-slate-400'}`
              }>
              <Icon d={ICONS[icon]} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
