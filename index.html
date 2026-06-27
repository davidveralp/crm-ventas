import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [cargando, setCargando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(''); setCargando(true)
    const { error } = await login(email.trim(), password)
    setCargando(false)
    if (error) { setError('Correo o contraseña incorrectos.'); return }
    navigate('/')
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-didial-dark">
      {/* PANEL DE MARCA (automotriz) */}
      <div className="relative lg:w-3/5 overflow-hidden flex items-center justify-center
                      px-8 py-14 lg:py-0 min-h-[300px]">
        {/* Fondo: carbón sutil con juego de sombras */}
        <div className="absolute inset-0 carbon" />
        <div className="absolute inset-0"
             style={{ boxShadow: 'inset 0 0 160px 40px rgba(0,0,0,0.6)' }} />

        {/* Líneas de velocidad diagonales */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.08]" preserveAspectRatio="none">
          <defs>
            <pattern id="speed" width="60" height="60" patternUnits="userSpaceOnUse"
                     patternTransform="rotate(-20)">
              <line x1="0" y1="0" x2="0" y2="60" stroke="#fff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#speed)" />
        </svg>

        {/* Swoosh amarillo (eco del logo) */}
        <svg className="absolute -right-10 top-1/2 -translate-y-1/2 w-[120%] h-auto opacity-90"
             viewBox="0 0 800 300" fill="none">
          <path d="M-50 220 C 250 120, 520 90, 860 30" stroke="#F9C847" strokeWidth="14"
                strokeLinecap="round" fill="none" opacity="0.85"/>
          <path d="M-50 250 C 280 170, 560 150, 880 100" stroke="#E73C32" strokeWidth="6"
                strokeLinecap="round" fill="none" opacity="0.6"/>
        </svg>

        {/* Contenido del panel */}
        <div className="relative z-10 max-w-md text-center lg:text-left">
          <div className="inline-block bg-white rounded-2xl px-7 py-6 shadow-2xl">
            <img src="/didial-logo.png" alt="DIDIAL Servicio Automotriz"
                 className="h-16 lg:h-20 w-auto" />
          </div>
          <h1 className="mt-8 text-3xl lg:text-4xl font-bold text-white leading-tight">
            Gestión <span className="text-didial-amber">Comercial</span>
          </h1>
          <p className="mt-3 text-slate-300 text-base lg:text-lg">
            CRM de ventas y postventa del taller.
          </p>
          <div className="mt-6 flex items-center gap-2 justify-center lg:justify-start">
            <span className="h-1 w-10 rounded-full bg-didial-red" />
            <span className="h-1 w-6 rounded-full bg-didial-amber" />
            <span className="h-1 w-3 rounded-full bg-white/40" />
          </div>
        </div>
      </div>

      {/* PANEL DE LOGIN */}
      <div className="lg:w-2/5 bg-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/didial-logo.png" alt="DIDIAL" className="h-12 w-auto" />
          </div>

          <h2 className="text-2xl font-bold text-ink">Iniciar sesión</h2>
          <p className="text-sm text-slate-500 mt-1 mb-8">Ingresa con tu cuenta del equipo</p>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="label">Correo</label>
              <input className="input" type="email" value={email} autoComplete="username"
                     onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.cl" required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" value={password} autoComplete="current-password"
                     onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <button
              className="w-full rounded-lg bg-didial-red text-white font-semibold py-3
                         transition-colors hover:bg-[#c92f26] disabled:opacity-50"
              disabled={cargando}>
              {cargando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-10">
            Servicio Automotriz Didial · La Serena
          </p>
        </div>
      </div>
    </div>
  )
}
