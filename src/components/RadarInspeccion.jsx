import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/* ============================================================================
   RADAR de Salud Vehicular — captura
   ----------------------------------------------------------------------------
   Diseñada para TABLET en el box:
     · Una categoría por pantalla, no un formulario de 45 campos.
     · Botones grandes (min 48px de alto) en vez de desplegables: el técnico
       toca la opción, no abre una lista y busca.
     · La categoría NO se elige — es el encabezado de la sección. Corrige el
       defecto del formulario de ClickUp, que pedía seleccionarla ocho veces.
     · Guardado incremental: cada respuesta se envía al momento. Si se corta la
       conexión, lo respondido ya está guardado.
     · Respaldo local: lo pendiente de enviar queda en el navegador y se
       reintenta. No es offline-first completo, pero evita perder el trabajo de
       una sesión por un bache de WiFi.
   ========================================================================== */

const SEV = {
  critico: { label: 'Crítico',   color: '#e0382b', bg: '#fdecea', borde: '#f5b5b0' },
  pronto:  { label: 'Atender',   color: '#b8860b', bg: '#fdf6e3', borde: '#e8d38a' },
  ok:      { label: 'Bien',      color: '#1f7a45', bg: '#e8f6ee', borde: '#a8d9bd' },
  na:      { label: 'No aplica', color: '#6b7a8a', bg: '#f1f5f9', borde: '#cbd5e1' }
}

const LS_KEY = (id) => `radar_pend_${id}`

export default function RadarInspeccion({ trabajo, onCerrar, onCompletada }) {
  const { perfil } = useAuth()
  const [cat, setCat] = useState([])
  const [crit, setCrit] = useState([])
  const [insp, setInsp] = useState(null)
  const [resp, setResp] = useState({})        // codigo -> {opcion, severidad, observacion}
  const [idx, setIdx] = useState(0)
  const [km, setKm] = useState('')
  const [estado, setEstado] = useState('cargando')
  const [errMsg, setErrMsg] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [pendientes, setPendientes] = useState(0)
  const colaRef = useRef([])

  useEffect(() => { iniciar() }, []) // eslint-disable-line

  async function iniciar() {
    try {
      const [c, cr] = await Promise.all([
        supabase.from('radar_categorias').select('*').eq('activa', true).order('orden'),
        supabase.from('radar_criterios').select('*').eq('activo', true).order('orden')
      ])
      if (c.error) throw c.error
      setCat(c.data || []); setCrit(cr.data || [])

      // ¿Ya hay una inspección en proceso para este trabajo?
      const { data: prev } = await supabase.from('radar_inspecciones')
        .select('*').eq('trabajo_id', trabajo.id).eq('estado', 'en_proceso')
        .order('iniciada_en', { ascending: false }).limit(1).maybeSingle()

      let ins = prev
      if (!ins) {
        const { data, error } = await supabase.from('radar_inspecciones').insert({
          empresa_id: perfil.empresa_id, trabajo_id: trabajo.id,
          vehiculo_id: trabajo.vehiculo_id, cliente_id: trabajo.cliente_id,
          tecnico_id: perfil.id, estado: 'en_proceso'
        }).select('*').maybeSingle()
        if (error) throw error
        ins = data
      }
      setInsp(ins)
      if (ins?.km) setKm(String(ins.km))

      // Respuestas ya guardadas (permite retomar una inspección a medias)
      const { data: rs } = await supabase.from('radar_respuestas')
        .select('*').eq('inspeccion_id', ins.id)
      const m = {}
      ;(rs || []).forEach((r) => {
        m[r.criterio_codigo] = { opcion: r.opcion, severidad: r.severidad, observacion: r.observacion }
      })

      // Recuperar lo que quedó sin enviar en una sesión anterior
      try {
        const raw = localStorage.getItem(LS_KEY(ins.id))
        if (raw) {
          const pend = JSON.parse(raw)
          Object.entries(pend).forEach(([k, v]) => { m[k] = v })
          colaRef.current = Object.entries(pend).map(([codigo, v]) => ({ codigo, ...v }))
          setPendientes(colaRef.current.length)
          drenarCola(ins.id)
        }
      } catch { /* respaldo corrupto: se ignora */ }

      setResp(m)
      setEstado('listo')
    } catch (e) {
      setErrMsg(e.message || String(e))
      setEstado('error')
    }
  }

  function guardarLocal(inspId, mapa) {
    try { localStorage.setItem(LS_KEY(inspId), JSON.stringify(mapa)) } catch { /* cuota llena */ }
  }

  /** Envía lo pendiente. Si falla, lo deja en la cola para el próximo intento. */
  async function drenarCola(inspId) {
    if (!colaRef.current.length) return
    const lote = [...colaRef.current]
    const filas = lote.map((x) => ({
      empresa_id: perfil.empresa_id, inspeccion_id: inspId,
      criterio_codigo: x.codigo, opcion: x.opcion,
      severidad: x.severidad, observacion: x.observacion || null
    }))
    const { error } = await supabase.from('radar_respuestas')
      .upsert(filas, { onConflict: 'inspeccion_id,criterio_codigo' })
    if (!error) {
      colaRef.current = []
      setPendientes(0)
      try { localStorage.removeItem(LS_KEY(inspId)) } catch { /* nada */ }
    } else {
      setPendientes(colaRef.current.length)
    }
  }

  async function responder(criterio, opcion) {
    const nuevo = {
      ...resp,
      [criterio.codigo]: {
        opcion: opcion.t, severidad: opcion.s,
        observacion: resp[criterio.codigo]?.observacion || ''
      }
    }
    setResp(nuevo)
    encolar(criterio.codigo, nuevo[criterio.codigo])
  }

  function anotar(codigo, texto) {
    const nuevo = { ...resp, [codigo]: { ...(resp[codigo] || {}), observacion: texto } }
    setResp(nuevo)
    if (nuevo[codigo]?.opcion) encolar(codigo, nuevo[codigo])
  }

  function encolar(codigo, valor) {
    colaRef.current = [...colaRef.current.filter((x) => x.codigo !== codigo), { codigo, ...valor }]
    setPendientes(colaRef.current.length)
    const mapaPend = {}
    colaRef.current.forEach((x) => { mapaPend[x.codigo] = x })
    if (insp) { guardarLocal(insp.id, mapaPend); drenarCola(insp.id) }
  }

  const critsDe = (codigo) => crit.filter((c) => c.categoria === codigo)

  const P = useMemo(() => {
    const total = crit.length
    const hechos = crit.filter((c) => resp[c.codigo]?.opcion).length
    return {
      total, hechos, pct: total ? Math.round(hechos / total * 100) : 0,
      criticos: crit.filter((c) => resp[c.codigo]?.severidad === 'critico').length,
      pronto: crit.filter((c) => resp[c.codigo]?.severidad === 'pronto').length
    }
  }, [crit, resp])

  async function completar() {
    if (P.hechos < P.total) {
      const faltan = P.total - P.hechos
      if (!confirm(`Faltan ${faltan} criterio(s) por responder. ¿Completar de todos modos?`)) return
    }
    setGuardando(true)
    try {
      if (colaRef.current.length) await drenarCola(insp.id)
      if (colaRef.current.length) {
        alert('Hay respuestas sin guardar y no hay conexión. Espera a recuperarla antes de completar.')
        setGuardando(false); return
      }
      await supabase.from('radar_inspecciones').update({
        estado: 'completada', completada_en: new Date().toISOString(),
        km: km ? parseInt(km, 10) : null
      }).eq('id', insp.id)

      // Los rojos y amarillos pasan a diagnosticos_taller, que alimenta el
      // presupuesto y las oportunidades. Es la conexión con el flujo existente.
      const { data: n, error } = await supabase.rpc('radar_volcar_hallazgos', { p_inspeccion: insp.id })
      if (error) console.error('No se pudieron volcar los hallazgos:', error.message)
      onCompletada?.({ inspeccionId: insp.id, hallazgos: n ?? 0, criticos: P.criticos, pronto: P.pronto })
    } catch (e) {
      alert('No se pudo completar: ' + (e.message || e))
    }
    setGuardando(false)
  }

  if (estado === 'cargando') return <div className="p-6 text-slate-400">Cargando RADAR…</div>
  if (estado === 'error') return (
    <div className="p-6">
      <p className="text-sm text-slate-600 mb-2">No se pudo iniciar el RADAR.</p>
      <p className="text-xs text-slate-400">{errMsg}</p>
      <p className="text-xs text-slate-400 mt-2">Si menciona que la tabla no existe, falta la migración 59.</p>
      <button onClick={onCerrar} className="btn-soft text-sm mt-3">Cerrar</button>
    </div>
  )

  const actual = cat[idx]
  const items = actual ? critsDe(actual.codigo) : []
  const hechosCat = items.filter((c) => resp[c.codigo]?.opcion).length

  return (
    <div className="flex flex-col h-full">
      {/* Cabecera fija con progreso */}
      <div className="border-b border-slate-200 p-3 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="font-semibold text-ink">RADAR de Salud Vehicular</div>
            <div className="text-xs text-slate-400">
              {trabajo.vehiculos?.patente || ''} {trabajo.vehiculos?.marca || ''} {trabajo.vehiculos?.modelo || ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {P.criticos > 0 && (
              <span className="px-2 py-1 rounded text-xs font-semibold"
                    style={{ background: SEV.critico.bg, color: SEV.critico.color }}>
                {P.criticos} crítico{P.criticos > 1 ? 's' : ''}
              </span>
            )}
            {P.pronto > 0 && (
              <span className="px-2 py-1 rounded text-xs font-semibold"
                    style={{ background: SEV.pronto.bg, color: SEV.pronto.color }}>
                {P.pronto} atender
              </span>
            )}
            <button type="button" onClick={onCerrar} className="btn-soft text-sm">Salir</button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all"
                 style={{ width: P.pct + '%', background: P.pct === 100 ? SEV.ok.color : '#2f6fb0' }} />
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap">{P.hechos}/{P.total}</span>
          {pendientes > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap"
                  style={{ background: SEV.pronto.bg, color: SEV.pronto.color }}>
              {pendientes} sin sincronizar
            </span>
          )}
        </div>
      </div>

      {/* Navegación por categoría — pestañas grandes, tocables */}
      <div className="flex gap-1.5 overflow-x-auto p-2 border-b border-slate-100 bg-slate-50">
        {cat.map((c, i) => {
          const its = critsDe(c.codigo)
          const done = its.filter((x) => resp[x.codigo]?.opcion).length
          const rojo = its.some((x) => resp[x.codigo]?.severidad === 'critico')
          const completa = done === its.length && its.length > 0
          return (
            <button key={c.codigo} type="button" onClick={() => setIdx(i)}
              className="px-3 py-2 rounded-lg text-xs whitespace-nowrap font-medium border transition-colors"
              style={i === idx
                ? { background: '#111922', color: '#fff', borderColor: '#111922' }
                : { background: '#fff', color: rojo ? SEV.critico.color : completa ? SEV.ok.color : '#6b7a8a',
                    borderColor: rojo ? SEV.critico.borde : completa ? SEV.ok.borde : '#e2e8f0' }}>
              {c.orden}. {c.nombre}
              <span className="ml-1.5 opacity-70">{done}/{its.length}</span>
            </button>
          )
        })}
      </div>

      {/* Criterios de la categoría actual */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {items.map((c) => {
          const r = resp[c.codigo]
          const ops = Array.isArray(c.opciones) ? c.opciones : []
          return (
            <div key={c.codigo} className="rounded-lg border p-3"
                 style={{ borderColor: r?.severidad ? SEV[r.severidad]?.borde : '#e2e8f0' }}>
              <div className="text-sm font-medium text-ink mb-2">
                <span className="text-slate-400 mr-1.5">{c.codigo}</span>{c.texto}
              </div>
              <div className="flex flex-wrap gap-2">
                {ops.map((o, i) => {
                  const activo = r?.opcion === o.t
                  const s = SEV[o.s] || SEV.na
                  return (
                    <button key={i} type="button" onClick={() => responder(c, o)}
                      className="px-3 rounded-lg text-sm text-left border-2 transition-colors"
                      style={{
                        minHeight: '48px',            // objetivo táctil cómodo
                        background: activo ? s.color : s.bg,
                        color: activo ? '#fff' : s.color,
                        borderColor: activo ? s.color : s.borde,
                        fontWeight: activo ? 600 : 400
                      }}>
                      {o.t}
                    </button>
                  )
                })}
              </div>
              {/* La observación solo aparece si hay algo que observar */}
              {r?.severidad && r.severidad !== 'ok' && r.severidad !== 'na' && (
                <input
                  className="input mt-2 text-sm" style={{ minHeight: '44px' }}
                  placeholder="Observación (opcional): medida, ubicación, detalle…"
                  value={r.observacion || ''}
                  onChange={(e) => anotar(c.codigo, e.target.value)} />
              )}
            </div>
          )
        })}
        {!items.length && <p className="text-sm text-slate-400">Esta categoría no tiene criterios activos.</p>}
      </div>

      {/* Pie fijo: avance entre categorías y cierre */}
      <div className="border-t border-slate-200 p-3 bg-white flex items-center gap-2 flex-wrap">
        <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}
          className="btn-soft text-sm disabled:opacity-40" style={{ minHeight: '44px' }}>← Anterior</button>
        <span className="text-xs text-slate-400">{hechosCat}/{items.length} en esta sección</span>
        {idx < cat.length - 1 ? (
          <button type="button" onClick={() => setIdx((i) => i + 1)}
            className="ml-auto px-4 rounded-lg bg-deep text-white text-sm font-medium"
            style={{ minHeight: '44px' }}>Siguiente →</button>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <input className="input w-32 text-sm" style={{ minHeight: '44px' }}
                   placeholder="Km" inputMode="numeric" value={km}
                   onChange={(e) => setKm(e.target.value.replace(/[^0-9]/g, ''))} />
            <button type="button" onClick={completar} disabled={guardando}
              className="px-4 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              style={{ minHeight: '44px', background: SEV.ok.color }}>
              {guardando ? 'Guardando…' : 'Completar RADAR'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
