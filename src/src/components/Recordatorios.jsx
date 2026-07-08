import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { agendaLabel, fmtHora } from '../lib/helpers'

const ABIERTOS = ['pendiente', 'no_contesta', 'reagendar', 'compromiso']
const yaAvisado = (k) => { try { return localStorage.getItem(k) === '1' } catch { return false } }
const marcar    = (k) => { try { localStorage.setItem(k, '1') } catch { /* */ } }

// Vigila los agendamientos del día y avisa 15 minutos antes.
export default function Recordatorios() {
  const navigate = useNavigate()
  const [avisos, setAvisos] = useState([])
  const timer = useRef(null)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    revisar()
    timer.current = setInterval(revisar, 30000) // cada 30 s
    return () => clearInterval(timer.current)
  }, [])

  async function revisar() {
    const hoy = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('actividades')
      .select('id,agenda_tipo,proxima_hora,recordatorio_min,cliente_id,clientes(nombre)')
      .eq('proxima_fecha', hoy)
      .not('proxima_hora', 'is', null)
      .in('resultado', ABIERTOS)
    if (!data) return

    const ahora = new Date()
    data.forEach((a) => {
      const aviso = a.recordatorio_min ?? 15
      if (!aviso) return // 0 = sin aviso
      const [h, m] = String(a.proxima_hora).split(':')
      const t = new Date(); t.setHours(+h, +m, 0, 0)
      const mins = (t - ahora) / 60000
      const clave = `didial_notif_${a.id}_${hoy}`
      if (mins <= aviso && mins >= -2 && !yaAvisado(clave)) {
        marcar(clave)
        const titulo = `Agendamiento en ${Math.max(0, Math.round(mins))} min`
        const cuerpo = `${a.clientes?.nombre || 'Cliente'} · ${agendaLabel(a.agenda_tipo)} ${fmtHora(a.proxima_hora)}`
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification(titulo, { body: cuerpo }) } catch { /* */ }
        }
        setAvisos((prev) => [...prev, { id: a.id, cliente_id: a.cliente_id, titulo, cuerpo }])
      }
    })
  }

  if (!avisos.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80 max-w-[90vw]">
      {avisos.map((a) => (
        <div key={a.id} className="bg-ink text-white rounded-xl shadow-lg border border-white/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="cursor-pointer" onClick={() => navigate(`/clientes/${a.cliente_id}`)}>
              <div className="text-sm font-semibold">{a.titulo}</div>
              <div className="text-xs text-sky/80 mt-0.5">{a.cuerpo}</div>
            </div>
            <button onClick={() => setAvisos((p) => p.filter((x) => x.id !== a.id))}
                    className="text-sky/60 hover:text-white text-sm leading-none">✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}
