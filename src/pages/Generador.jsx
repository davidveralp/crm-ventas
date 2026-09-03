import { useEffect, useRef, useState } from 'react'

/* ============================================================================
   Generador de piezas publicitarias · fase 1
   ----------------------------------------------------------------------------
   El generador es una aplicación estática independiente (HTML + JS sin
   dependencias) que vive en `public/generador/`. Se embebe en un iframe en
   lugar de reescribirlo en React, por tres razones:

     · Funciona hoy. Reescribirlo introduciría errores sin agregar nada.
     · Su catálogo (61 modelos, 193 versiones) y su motor de composición sobre
       canvas son un activo probado.
     · Actualizarlo es reemplazar la carpeta, sin tocar el CRM.

   En la fase 2 se conectará a la cartera para generar una pieza por cliente
   con su propio vehículo. Por ahora funciona igual que antes, pero adentro.
   ========================================================================== */

export default function Generador() {
  const ref = useRef(null)
  const [cargando, setCargando] = useState(true)
  const [alto, setAlto] = useState(1400)

  // El generador es alto (lienzo 1080×1350 más el panel lateral). Se le da
  // toda la altura disponible en pantallas grandes y una fija en móvil, donde
  // el iframe no puede medir su propio contenido de forma confiable.
  useEffect(() => {
    const ajustar = () => {
      const esMovil = window.matchMedia('(max-width: 767px)').matches
      setAlto(esMovil ? 1500 : Math.max(900, window.innerHeight - 180))
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between flex-wrap gap-2 no-print">
        <div>
          <h1 className="text-xl font-bold text-ink">Generador de piezas</h1>
          <p className="text-sm text-slate-500">
            Piezas publicitarias 1080×1350 para campañas de mantención
          </p>
        </div>
        <a href="/generador/index.html" target="_blank" rel="noopener"
           className="btn-soft text-sm shrink-0">Abrir en pestaña aparte ↗</a>
      </div>

      <p className="text-[11px] px-2 py-1.5 rounded" style={{ background: '#f1f5f9', color: '#64748b' }}>
        Catálogo con 61 modelos de Toyota, Nissan y Mazda. La pieza se descarga desde
        el propio generador; en la siguiente etapa se podrá generar directamente
        para un cliente de la cartera y enviársela.
      </p>

      <div className="card overflow-hidden" style={{ padding: 0 }}>
        {cargando && (
          <div className="p-8 text-center text-sm text-slate-400">Cargando el generador…</div>
        )}
        <iframe
          ref={ref}
          src="/generador/index.html"
          title="Generador de piezas publicitarias"
          onLoad={() => setCargando(false)}
          style={{
            width: '100%', height: alto + 'px', border: 0,
            display: cargando ? 'none' : 'block'
          }}
        />
      </div>
    </div>
  )
}
