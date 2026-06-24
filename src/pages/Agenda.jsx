import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TIPOS_ACTIVIDAD, fmtFecha } from '../lib/helpers'

export default function Agenda() {
  const navigate = useNavigate()
  const [citas, setCitas] = useState([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const hoy = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('actividades')
      .select('*, clientes(nombre,telefono)')
      .gte('fecha', hoy)
      .order('fecha').order('hora')
    setCitas(data || [])
  }

  const grupos = useMemo(() => {
    const g = {}
    citas.forEach((c) => { (g[c.fecha] ||= []).push(c) })
    return g
  }, [citas])

  function exportarICS() {
    const pad = (n) => String(n).padStart(2, '0')
    let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DIDIAL CRM//ES\n'
    citas.forEach((c) => {
      const f = c.fecha.replace(/-/g, '')
      const h = (c.hora || '09:00').slice(0, 5).replace(':', '') + '00'
      ics += 'BEGIN:VEVENT\n'
      ics += `UID:${c.id}@didial\n`
      ics += `DTSTART:${f}T${h}\n`
      ics += `SUMMARY:${TIPOS_ACTIVIDAD[c.tipo]} · ${c.clientes?.nombre || ''}\n`
      ics += `DESCRIPTION:${(c.descripcion || '').replace(/\n/g, ' ')}\n`
      ics += 'END:VEVENT\n'
    })
    ics += 'END:VCALENDAR'
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'agenda-didial.ics'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Agenda</h1>
          <p className="text-sm text-slate-500">Próximas actividades y agendamientos</p>
        </div>
        {citas.length > 0 && (
          <button className="btn-soft" onClick={exportarICS}>Exportar a Outlook (.ics)</button>
        )}
      </div>

      {Object.keys(grupos).length === 0 ? (
        <div className="card p-10 text-center text-slate-400 text-sm">
          No hay actividades agendadas a futuro. Regístralas desde la ficha de cada cliente.
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grupos).map(([fecha, items]) => (
            <div key={fecha}>
              <div className="text-sm font-semibold text-deep mb-2 capitalize">{fmtFecha(fecha)}</div>
              <div className="card divide-y divide-slate-100">
                {items.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-paper cursor-pointer"
                       onClick={() => navigate(`/clientes/${c.cliente_id}`)}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-slate-400 w-12">
                        {c.hora ? c.hora.slice(0, 5) : '—'}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-ink">{c.clientes?.nombre}</div>
                        <div className="text-xs text-slate-400">{TIPOS_ACTIVIDAD[c.tipo]}{c.clientes?.telefono ? ` · ${c.clientes.telefono}` : ''}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
