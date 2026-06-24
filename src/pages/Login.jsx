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
    <div className="h-full grid place-items-center bg-ink p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-white tracking-tight">DIDIAL</div>
          <div className="text-sm text-sky/70 mt-1">Gestión comercial</div>
        </div>
        <form onSubmit={onSubmit} className="card p-6 space-y-4">
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={cargando}>
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <p className="text-center text-xs text-sky/40 mt-6">
          Servicio Automotriz Didial · La Serena
        </p>
      </div>
    </div>
  )
}
