import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sonarAlerta } from '../lib/notificar'

export default function Campanita() {
  const { perfil } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const [abierto, setAbierto] = useState(false)
  const conocidas = useRef(new Set())
  const primera = useRef(true)

  async function cargar() {
    if (!perfil?.id) return
    const { data } = await supabase.from('notificaciones')
      .select('*')
      .or(`usuario_id.eq.${perfil.id},rol_destino.eq.${perfil.rol}`)
      .order('creada_en', { ascending: false }).limit(25)
    const lista = data || []
    // Sonido solo si llegan nuevas (no en la primera carga)
    const nuevas = lista.filter((n) => !conocidas.current.has(n.id))
    if (!primera.current && nuevas.some((n) => !leida(n))) sonarAlerta()
    lista.forEach((n) => conocidas.current.add(n.id))
    primera.current = false
    setItems(lista)
  }

  useEffect(() => { cargar(); const id = setInterval(cargar, 30000); return () => clearInterval(id) }, [perfil?.id])

  const leida = (n) => Array.isArray(n.leida_por) && n.leida_por.includes(perfil?.id)
  const noLeidas = items.filter((n) => !leida(n)).length

  async function marcarLeidas() {
    const pend = items.filter((n) => !leida(n))
    await Promise.all(pend.map((n) =>
      supabase.from('notificaciones')
        .update({ leida_por: [...(n.leida_por || []), perfil.id] }).eq('id', n.id)))
    cargar()
  }

  function abrir(n) {
    setAbierto(false)
    if (n.url) nav(n.url)
  }

  const hace = (f) => {
    const m = Math.round((Date.now() - new Date(f).getTime()) / 60000)
    if (m < 1) return 'ahora'
    if (m < 60) return `hace ${m} min`
    const h = Math.round(m / 60)
    return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`
  }

  return (
    <div className="relative">
      <button onClick={() => { setAbierto(!abierto); if (!abierto && noLeidas) marcarLeidas() }}
              className="relative grid place-items-center w-9 h-9 rounded-lg hover:bg-white/10 text-sky">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-0.5 rounded-full bg-didial-red text-white text-[10px] font-bold grid place-items-center">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-auto rounded-xl bg-white shadow-xl border border-slate-200 z-40">
            <div className="px-4 py-2.5 text-sm font-semibold text-ink border-b">Notificaciones</div>
            {items.length ? items.map((n) => (
              <button key={n.id} onClick={() => abrir(n)}
                className={`w-full text-left px-4 py-2.5 border-b last:border-0 hover:bg-paper ${leida(n) ? 'opacity-60' : ''}`}>
                <div className="text-sm font-medium text-ink">{n.titulo}</div>
                {n.cuerpo && <div className="text-xs text-slate-500 line-clamp-2">{n.cuerpo}</div>}
                <div className="text-[10px] text-slate-400 mt-0.5">{hace(n.creada_en)}</div>
              </button>
            )) : <div className="px-4 py-6 text-sm text-slate-400 text-center">Sin notificaciones</div>}
          </div>
        </>
      )}
    </div>
  )
}
