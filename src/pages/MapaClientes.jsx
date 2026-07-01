import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase, fetchAllRows } from '../lib/supabase'

/* Centroides de las 15 comunas de la Región de Coquimbo (IV) */
const COMUNAS = {
  'LA SERENA': [-29.9027, -71.2519], 'COQUIMBO': [-29.9533, -71.3436],
  'ANDACOLLO': [-30.2333, -71.0833], 'LA HIGUERA': [-29.5167, -71.2667],
  'PAIHUANO': [-30.0289, -70.5239], 'VICUNA': [-30.0319, -70.7081],
  'OVALLE': [-30.6017, -71.1997], 'COMBARBALA': [-31.1786, -71.0008],
  'MONTE PATRIA': [-30.6986, -70.9533], 'PUNITAQUI': [-30.8386, -71.2603],
  'RIO HURTADO': [-30.2833, -70.7000], 'ILLAPEL': [-31.6333, -71.1667],
  'CANELA': [-31.3961, -71.4569], 'LOS VILOS': [-31.9136, -71.5106],
  'SALAMANCA': [-31.7786, -70.9633]
}
const LABEL = {
  'LA SERENA': 'La Serena', 'COQUIMBO': 'Coquimbo', 'ANDACOLLO': 'Andacollo', 'LA HIGUERA': 'La Higuera',
  'PAIHUANO': 'Paihuano', 'VICUNA': 'Vicuña', 'OVALLE': 'Ovalle', 'COMBARBALA': 'Combarbalá',
  'MONTE PATRIA': 'Monte Patria', 'PUNITAQUI': 'Punitaqui', 'RIO HURTADO': 'Río Hurtado',
  'ILLAPEL': 'Illapel', 'CANELA': 'Canela', 'LOS VILOS': 'Los Vilos', 'SALAMANCA': 'Salamanca'
}
const norm = (s) => (s || '').toString().toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

// Algunos textos de ciudad → comuna
const ALIAS = { 'LA SERENA ': 'LA SERENA', 'SERENA': 'LA SERENA', 'GUANAQUEROS': 'COQUIMBO', 'TONGOY': 'COQUIMBO', 'EL PEÑON': 'COQUIMBO' }
const aComuna = (texto) => { const n = norm(texto); const a = ALIAS[n] || n; return COMUNAS[a] ? a : null }

const colorPorRatio = (r) => r >= 0.66 ? '#e0382b' : r >= 0.33 ? '#e0a020' : '#2f6fb0'

export default function MapaClientes() {
  const cont = useRef(null)
  const mapRef = useRef(null)
  const capa = useRef(null)
  const [conteo, setConteo] = useState([])
  const [sinUbicar, setSinUbicar] = useState(0)
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    (async () => {
      const rows = await fetchAllRows(supabase.from('clientes').select('comuna, ciudad'))
      const m = {}; let sin = 0
      rows.forEach((c) => {
        const key = aComuna(c.comuna) || aComuna(c.ciudad)
        if (key) m[key] = (m[key] || 0) + 1; else sin++
      })
      const arr = Object.entries(m).map(([k, n]) => ({ key: k, nombre: LABEL[k], n })).sort((a, b) => b.n - a.n)
      setConteo(arr); setSinUbicar(sin); setTotal(rows.length); setCargando(false)
    })()
  }, [])

  // Inicializa el mapa una vez
  useEffect(() => {
    if (mapRef.current || !cont.current) return
    const map = L.map(cont.current, { scrollWheelZoom: false }).setView([-30.6, -71.0], 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 18
    }).addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 150)
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Dibuja/actualiza los círculos cuando hay conteo
  useEffect(() => {
    const map = mapRef.current
    if (!map || !conteo.length) return
    if (capa.current) { map.removeLayer(capa.current) }
    const grupo = L.layerGroup()
    const max = Math.max(...conteo.map((c) => c.n))
    conteo.forEach((c) => {
      const ratio = c.n / max
      const radio = 10 + 26 * Math.sqrt(ratio)
      L.circleMarker(COMUNAS[c.key], {
        radius: radio, color: colorPorRatio(ratio), weight: 1,
        fillColor: colorPorRatio(ratio), fillOpacity: 0.45
      }).bindTooltip(`<b>${c.nombre}</b><br>${c.n} cliente${c.n === 1 ? '' : 's'}`, { direction: 'top' })
        .addTo(grupo)
    })
    grupo.addTo(map); capa.current = grupo
  }, [conteo])

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-2 overflow-hidden">
          <div ref={cont} style={{ height: 520, borderRadius: 10 }} />
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-ink mb-1">Clientes por comuna</h3>
          <p className="text-[11px] text-slate-400 mb-3">
            {cargando ? 'Cargando…' : `${total} clientes · ${total - sinUbicar} ubicados · ${sinUbicar} sin comuna`}
          </p>
          <div className="space-y-1.5 max-h-[440px] overflow-auto pr-1">
            {conteo.map((c) => {
              const max = conteo[0]?.n || 1
              return (
                <div key={c.key} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 text-slate-600">{c.nombre}</span>
                  <div className="flex-1 h-2.5 rounded bg-mist overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${Math.round((c.n / max) * 100)}%`, background: colorPorRatio(c.n / max) }} />
                  </div>
                  <span className="w-7 text-right font-semibold text-ink">{c.n}</span>
                </div>
              )
            })}
            {!cargando && !conteo.length && <p className="text-sm text-slate-400">Sin comunas registradas aún.</p>}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Densidad por comuna (campo Comuna/Ciudad del cliente). Para un mapa a nivel de dirección exacta hace falta geocodificar las direcciones; ver nota del equipo de desarrollo.
      </p>
    </div>
  )
}
