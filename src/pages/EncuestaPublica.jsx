import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/* ============================================================================
   Encuesta de satisfacción · página pública
   ----------------------------------------------------------------------------
   La abre el cliente desde el correo. NO requiere sesión: el token del enlace
   es la credencial. Por eso vive fuera del Layout y no toca la base directo,
   sino a través de la Edge Function.

   Diseño deliberadamente corto: cuatro preguntas y un comentario. Cada pregunta
   extra cuesta respuestas, y una encuesta larga la contesta solo quien está muy
   enojado o muy contento — justo el sesgo que se busca evitar.
   ========================================================================== */

const FN = (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/enviar-encuestas'

const ESCALAS = [
  { k: 'p_calidad',  t: '¿Cómo quedó el trabajo realizado?' },
  { k: 'p_plazo',    t: '¿Se cumplió el plazo de entrega?' },
  { k: 'p_atencion', t: '¿Cómo fue la atención que recibió?' }
]

export default function EncuestaPublica() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [estado, setEstado] = useState('cargando')
  const [info, setInfo] = useState(null)
  const [r, setR] = useState({ nps: null, p_calidad: null, p_plazo: null, p_atencion: null, comentario: '' })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!token) { setEstado('sin_token'); return }
    fetch(`${FN}?token=${token}`)
      .then((x) => x.json())
      .then((d) => {
        if (d.error) { setEstado('error'); return }
        setInfo(d)
        setEstado(d.ya_respondida ? 'ya' : 'listo')
      })
      .catch(() => setEstado('error'))
  }, [token])

  async function enviar() {
    if (r.nps === null) return
    setEnviando(true)
    try {
      const resp = await fetch(FN, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...r })
      })
      const d = await resp.json()
      setEstado(d.ok ? 'gracias' : 'error')
    } catch { setEstado('error') }
    setEnviando(false)
  }

  const Marco = ({ children }) => (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f4f5f7' }}>
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-sm">
        <div className="px-6 py-4" style={{ background: '#111922' }}>
          <div className="text-white font-bold text-lg tracking-wide">DIDIAL</div>
          <div className="text-[11px]" style={{ color: '#8b95a3' }}>Servicio Automotriz</div>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )

  if (estado === 'cargando') return <Marco><p className="text-slate-400 text-sm">Cargando…</p></Marco>
  if (estado === 'sin_token' || estado === 'error') return (
    <Marco>
      <p className="text-ink font-semibold mb-1">No pudimos abrir la encuesta</p>
      <p className="text-sm text-slate-500">
        El enlace puede haber expirado. Si quiere contarnos algo, escríbanos a
        serviciotecnico@didial.cl
      </p>
    </Marco>
  )
  if (estado === 'ya') return (
    <Marco>
      <p className="text-ink font-semibold mb-1">Ya recibimos su respuesta</p>
      <p className="text-sm text-slate-500">Gracias por tomarse el tiempo.</p>
    </Marco>
  )
  if (estado === 'gracias') return (
    <Marco>
      <div className="text-center py-4">
        <div className="text-4xl mb-3">✓</div>
        <p className="text-ink font-semibold text-lg">Gracias por responder</p>
        <p className="text-sm text-slate-500 mt-2">
          {r.nps !== null && r.nps <= 6
            ? 'Lamentamos que la experiencia no haya estado a la altura. Alguien de administración va a revisar su caso.'
            : 'Su opinión nos ayuda a mejorar el servicio.'}
        </p>
      </div>
    </Marco>
  )

  const patente = info?.vehiculo?.patente || 'su vehículo'
  const nombre = info?.cliente?.nombre || ''

  return (
    <Marco>
      <p className="text-sm text-slate-500 mb-1">{nombre ? `Hola ${nombre},` : 'Hola,'}</p>
      <h1 className="text-lg font-bold text-ink mb-1">¿Cómo estuvo la atención?</h1>
      <p className="text-xs text-slate-400 mb-5">
        {patente}{info?.vehiculo?.marca ? ` · ${info.vehiculo.marca} ${info.vehiculo.modelo || ''}` : ''}
      </p>

      {/* NPS primero: es la única pregunta obligatoria */}
      <div className="mb-5">
        <p className="text-sm font-medium text-ink mb-2">
          ¿Qué tan probable es que nos recomiende a un conocido?
        </p>
        <div className="grid grid-cols-11 gap-1">
          {[0,1,2,3,4,5,6,7,8,9,10].map((n) => {
            const on = r.nps === n
            const color = n <= 6 ? '#e0382b' : n <= 8 ? '#e0a020' : '#1f9d57'
            return (
              <button key={n} type="button" onClick={() => setR({ ...r, nps: n })}
                className="rounded-lg text-xs font-semibold border-2 transition-colors"
                style={{ minHeight: '40px',
                         background: on ? color : '#fff',
                         color: on ? '#fff' : '#64748b',
                         borderColor: on ? color : '#e2e8f0' }}>
                {n}
              </button>
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>Nada probable</span><span>Muy probable</span>
        </div>
      </div>

      {ESCALAS.map((e) => (
        <div key={e.k} className="mb-4">
          <p className="text-sm font-medium text-ink mb-2">{e.t}</p>
          <div className="flex gap-1.5">
            {[1,2,3,4,5].map((n) => {
              const on = r[e.k] === n
              return (
                <button key={n} type="button" onClick={() => setR({ ...r, [e.k]: n })}
                  className="flex-1 rounded-lg text-sm border-2 transition-colors"
                  style={{ minHeight: '44px',
                           background: on ? '#111922' : '#fff',
                           color: on ? '#fff' : '#64748b',
                           borderColor: on ? '#111922' : '#e2e8f0' }}>
                  {n}
                </button>
              )
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Mal</span><span>Excelente</span>
          </div>
        </div>
      ))}

      <div className="mb-5">
        <p className="text-sm font-medium text-ink mb-2">¿Algo que quiera contarnos? (opcional)</p>
        <textarea className="w-full rounded-lg border-2 border-slate-200 p-2 text-sm" rows={3}
                  style={{ fontSize: '16px' }} value={r.comentario}
                  onChange={(e) => setR({ ...r, comentario: e.target.value })} />
      </div>

      <button type="button" onClick={enviar} disabled={r.nps === null || enviando}
        className="w-full rounded-lg text-white font-semibold disabled:opacity-40"
        style={{ minHeight: '48px', background: '#e0382b' }}>
        {enviando ? 'Enviando…' : 'Enviar respuesta'}
      </button>
      {r.nps === null && (
        <p className="text-[11px] text-slate-400 text-center mt-2">
          Marque la primera pregunta para enviar.
        </p>
      )}
    </Marco>
  )
}
