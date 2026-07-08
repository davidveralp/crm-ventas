import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { rolLabel } from '../lib/helpers'

// v27 · Mi perfil: cada usuario ve sus datos y cambia su propia contraseña.
export default function Perfil() {
  const { perfil } = useAuth()
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function cambiarClave(e) {
    e.preventDefault()
    setMsg(null)
    if (p1.length < 8) return setMsg({ t: 'err', m: 'La contraseña debe tener al menos 8 caracteres.' })
    if (p1 !== p2) return setMsg({ t: 'err', m: 'Las contraseñas no coinciden.' })
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setGuardando(false)
    if (error) return setMsg({ t: 'err', m: 'No se pudo cambiar: ' + error.message })
    setP1(''); setP2('')
    setMsg({ t: 'ok', m: '✓ Contraseña actualizada. Úsala en tu próximo inicio de sesión.' })
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Mi perfil</h1>
        <p className="text-sm text-slate-500">Tus datos de acceso y seguridad</p>
      </div>

      <div className="card p-4 space-y-1.5 text-sm">
        <div><span className="text-slate-400">Nombre:</span> <b className="text-ink">{perfil?.nombre}</b></div>
        <div><span className="text-slate-400">Correo:</span> {perfil?.email}</div>
        <div><span className="text-slate-400">Rol:</span> {rolLabel(perfil?.rol)}</div>
        <p className="text-[11px] text-slate-400 pt-1">Nombre y rol los administra el área de administración (Usuarios).</p>
      </div>

      <form onSubmit={cambiarClave} className="card p-4 space-y-3">
        <div className="text-sm font-semibold text-ink">Cambiar mi contraseña</div>
        <div>
          <label className="label">Nueva contraseña</label>
          <input className="input" type="password" required minLength={8} value={p1}
                 onChange={(e) => setP1(e.target.value)} placeholder="Mínimo 8 caracteres" />
        </div>
        <div>
          <label className="label">Repetir nueva contraseña</label>
          <input className="input" type="password" required value={p2}
                 onChange={(e) => setP2(e.target.value)} />
        </div>
        {msg && <div className={`text-sm px-3 py-2 rounded-lg ${msg.t === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg.m}</div>}
        <div className="flex justify-end">
          <button className="btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Cambiar contraseña'}</button>
        </div>
      </form>
    </div>
  )
}
