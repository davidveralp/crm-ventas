import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, BarChart, Legend
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fmtMiles } from '../lib/helpers'
import * as XLSX from 'xlsx'

/* ---- Paleta del panel (identidad DIDIAL) ---- */
const C = { graphite: '#111922', red: '#e0382b', green: '#1f9d57', amber: '#e0a020', blue: '#2f6fb0', muted: '#6b7a8a' }
const CLP = (n) => '$' + fmtMiles(Math.round(n || 0))
const CLPc = (n) => { const v = Math.round(n || 0); if (!v) return '—'; if (v >= 1e6) return '$' + (v / 1e6).toFixed(1).replace('.', ',') + 'M'; if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'k'; return '$' + v }

/* ---- Config por defecto (si la empresa no tiene 'dashboard' en config) ---- */
const DEFAULTS = {
  sheet_id: '1UTgOhJ5fffCfx3RdArmFD-2z3WOCnUNMyfhKu9w59KQ', gid: '0',
  meta_toyota: 15000000, meta_multimarca: 25000000, meta_ticket: 150000,
  max_garantias: 5, refresh_min: 15, comision_pct: 0.05,
  tecnicos_comision: ['Felipe', 'Ignacio', 'Shelmy']
}

/* ---- Mapeos incrustados (área de servicio y homologación de marca) ---- */
const AREA_MAP = {
  'MAN X PAUTA': 'Taller', 'MAN BASICA': 'Taller', 'EMBRAGUE': 'Taller', 'AMORTIGUADOR': 'Taller', 'CORREAS': 'Taller',
  'DISTRIBUCION': 'Taller', 'DISTRIBUCIÓN': 'Taller', 'REFRIGERACION': 'Taller', 'A/C RECARGA': 'Taller', 'A/C REPARACION': 'Taller',
  'INYECCION': 'Taller', 'DPF': 'Taller', 'MOTOR REPARACION': 'Taller', 'MOTOR REEMPLAZO': 'Taller', 'ADMISION EGR': 'Taller',
  'ADMISION - EGR': 'Taller', 'ALTERNADOR': 'Taller', 'ARRANQUE': 'Taller', 'FRENOS': 'Taller', 'TREN DELANTERO': 'Taller',
  'DIAGNOSTICO': 'Taller', 'OTROS TALLER': 'Taller', 'REVISION MECANICA GENERAL': 'Taller', 'DIAGNOSTICO / REVISION': 'Taller',
  'MAN PAUTA': 'Taller', 'AJUSTE DE MOTOR': 'Taller', 'ESCANER-DIAGNOSTICO': 'Taller',
  'REV EXPRESS': 'Servicio Rápido', 'REV PREVENTIVA': 'Servicio Rápido', 'CAMBIO DE ACEITE': 'Servicio Rápido',
  'VULCANIZACION': 'Servicio Rápido', 'BALANCEO': 'Servicio Rápido', 'ESCANER': 'Servicio Rápido', 'ALINEACION': 'Servicio Rápido',
  'OTROS SERVICIO RÁPIDO': 'Servicio Rápido', 'OTROS SERVICIO RAPIDO': 'Servicio Rápido', 'REV EXPRESS- REV PREVENTIVA': 'Servicio Rápido',
  'ACCESORIOS': 'Servicio Rápido',
  'DESABOLLADURA Y PINTURA': 'DyP', 'SINIESTRO ROBO': 'DyP', 'SIENIESTRO / ROBO': 'DyP', 'LIMPIEZA VEHICULO': 'DyP',
  'LIMPIEZA DE MOTOR': 'DyP', 'LAVADO DE TAPIZ': 'DyP', 'LAVADO': 'DyP', 'PULIDO Y ENCERADO': 'DyP', 'OTROS DYP': 'DyP'
}
const MARCA_MAP = {
  'YOTOYA': 'TOYOTA', 'NISAN': 'NISSAN', 'NISSN': 'NISSAN', 'HYUNAD': 'HYUNDAI', 'HYUNDI': 'HYUNDAI', 'CHEVRLET': 'CHEVROLET',
  'CHEVROLET SPARK': 'CHEVROLET', 'BAAIC': 'BAIC', 'NBAIC': 'BAIC', 'BRILLIANCE': 'BRILLANCE', 'CHAGAN': 'CHANGAN', 'CRYLER': 'CHRYSLER',
  'GREAT WLL': 'GREAT WALL', 'MITUBISHI': 'MITSUBISHI', 'MXUS': 'MAXUS', 'MZDA': 'MAZDA', 'RENULT': 'RENAULT', 'SSAMGYONG': 'SSANGYONG',
  'SSANG YONG': 'SSANGYONG', 'SSANYONG': 'SSANGYONG', 'SUBRU': 'SUBARU', 'SUUKI': 'SUZUKI', 'VOLKSVAGEN': 'VOLKSWAGEN',
  'VOLKSWGEN': 'VOLKSWAGEN', 'VOLSWAGEN': 'VOLKSWAGEN', 'VW': 'VOLKSWAGEN', 'SAMNSUNG': 'SAMSUNG', 'DFORD': 'FORD', 'GONDA': 'HONDA',
  'KI': 'KIA', 'CITROËN': 'CITROEN'
}

/* ---- Helpers de datos (portados del panel HTML) ---- */
const txt = (v) => (v === null || v === undefined) ? '' : String(v).trim()
const num = (v) => { if (v === null || v === undefined || v === '') return 0; const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n }
const normServ = (s) => txt(s).toUpperCase().replace(/\s+/g, ' ').trim()
const normMarca = (m) => { const u = txt(m).toUpperCase().replace(/\s+/g, ' ').trim(); return MARCA_MAP[u] || u }
const esToyota = (r) => normMarca(r['Marca']) === 'TOYOTA'
/* Área: prioriza la columna "Área Servicio" de la hoja (clasificación oficial vía Map_Areas);
   si no viene, se cae al mapeo incrustado por tipo de servicio. */
const areaDe = (r) => {
  const propia = txt(r['Área Servicio'])
  if (propia && propia !== '0') return propia
  const s = normServ(r['Tipo Servicio 1']); if (!s || s === '0') return 'Sin servicio'
  return AREA_MAP[s] || 'Por clasificar'
}
const matchTec = (name, list) => { const n = txt(name).toLowerCase(); return list.some((x) => n.includes(x.toLowerCase())) }
const countSec = (v) => { const s = txt(v); if (!s || s === '0') return 0; if (/^\d+$/.test(s)) return parseInt(s, 10); return s.split(/[,;/&]|\sy\s/).map((x) => x.trim()).filter(Boolean).length }
const avg = (rows, field) => { const v = rows.map((r) => r[field]).filter((x) => x !== null && x !== '' && !isNaN(parseFloat(x))).map(parseFloat); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }
function parseGvizDate(v) {
  if (typeof v === 'string') { const m = v.match(/Date\((\d+),(\d+),(\d+)/); if (m) return new Date(+m[1], +m[2], +m[3]); const d = new Date(v); return isNaN(d) ? null : d }
  if (v instanceof Date) return v
  return null
}
const ymKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/* ---- Detección de columnas por encabezado (tolerante a cambios de nombre/posición en la hoja) ---- */
const normHdr = (s) => txt(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
function pickCol(keys, tokens, net, excluye) {
  const cand = keys.filter((k) => {
    const n = normHdr(k)
    if (excluye && n.startsWith(excluye)) return false
    return tokens.every((t) => n.includes(t))
  })
  if (!cand.length) return null
  const netos = cand.filter((k) => /^NETO/.test(normHdr(k)))
  const brutos = cand.filter((k) => !/^NETO/.test(normHdr(k)))
  return net ? (netos[0] || brutos[0]) : (brutos[0] || netos[0])
}
/* Centro de ingreso: homologado a Toyota / Multimarca / DyP; valores no reconocidos se muestran tal cual */
function normCentro(v) {
  const n = normHdr(v)
  if (!n || n === '0') return 'Sin centro'
  if (n.includes('TOYOTA')) return 'Toyota'
  if (n.includes('DYP') || n.includes('D Y P') || n.includes('DESABOLL') || n.includes('PINTURA')) return 'DyP'
  if (n.includes('MULTI')) return 'Multimarca'
  return txt(v)
}
const CENTRO_COLOR = { 'Toyota': C.red, 'Multimarca': C.graphite, 'DyP': C.blue, 'Sin centro': '#cbd5e1' }
const SUBAREAS = [
  { k: 'mo', label: 'Mano de obra', tokens: ['MANO', 'OBRA'], color: C.green },
  { k: 'rep', label: 'Repuestos', tokens: ['REPUESTO'], color: C.blue },
  { k: 'lub', label: 'Lubricantes e insumos', tokens: ['LUBRICANTE'], alt: ['INSUMO'], color: C.amber },
  { k: 'ext', label: 'Servicios externos', tokens: ['SERVICIO', 'EXTERNO'], excluye: 'DESC', color: C.muted }
]
/* El descuento RESTA del total de la OT: Total = MO + Repuestos + Lubricantes + Serv.Externo − Descuento */
const DESC_META = { k: 'desc', label: 'Descuentos', tokens: ['DESCUENTO'], color: C.red }
const RESIDUO_COLOR = '#d8dee6'
const ymLabel = (ym) => { const [y, m] = ym.split('-'); return MES[+m - 1] + ' ' + y }
const parseISO = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const toISO = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
const dmKey = (d) => toISO(d)
/* Meses equivalentes cubiertos por un rango (fracción para meses parciales) — para prorratear metas mensuales */
function mesesEquivalentes(ini, fin) {
  let total = 0
  let cur = new Date(ini.getFullYear(), ini.getMonth(), 1)
  while (cur <= fin) {
    const dim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
    const mismoMes = (d) => d.getFullYear() === cur.getFullYear() && d.getMonth() === cur.getMonth()
    const a = mismoMes(ini) ? ini.getDate() : 1
    const b = mismoMes(fin) ? fin.getDate() : dim
    total += (b - a + 1) / dim
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return total
}
function npsCalc(rows) {
  let prom = 0, det = 0, enc = 0
  rows.forEach((r) => { const v = txt(r['N.P.S']).toLowerCase(); if (v === 'promotor') { prom++; enc++ } else if (v === 'detractor') { det++; enc++ } else if (v === 'pasivo') { enc++ } })
  return { prom, det, pas: enc - prom - det, enc, nps: enc ? ((prom - det) / enc * 100) : 0 }
}
function topAgg(rows, dim, field, n, norm) {
  const m = {}
  rows.forEach((r) => { let k = norm ? norm(r[dim]) : txt(r[dim]); if (!k) return; m[k] = (m[k] || 0) + num(r[field]) })
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value }))
}

/* ---- Carga gviz (JSONP por script tag, igual que el panel HTML) ---- */
function loadData(sheetId, gid) {
  return new Promise((resolve, reject) => {
    const cb = 'gviz_cb_' + Math.floor(Math.random() * 1e9)
    let done = false, s
    const cleanup = () => { try { delete window[cb] } catch { } if (s && s.parentNode) s.parentNode.removeChild(s) }
    const timer = setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error('Tiempo de espera agotado. Verifica que la hoja sea pública.')) }, 40000)
    window[cb] = (resp) => {
      if (done) return; done = true; clearTimeout(timer)
      try {
        if (!resp || !resp.table) throw new Error('Respuesta inválida de Google Sheets.')
        const cols = resp.table.cols.map((c) => c.label || '')
        const rows = resp.table.rows.map((r) => { const o = {}; cols.forEach((l, i) => { if (!l) return; const cell = r.c[i]; o[l] = cell ? cell.v : null }); return o })
        cleanup(); resolve(rows)
      } catch (e) { cleanup(); reject(e) }
    }
    s = document.createElement('script')
    s.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}&headers=1&tqx=out:json;responseHandler:${cb}`
    s.onerror = () => { if (done) return; done = true; clearTimeout(timer); cleanup(); reject(new Error('No se pudo cargar la hoja (¿es pública?).')) }
    document.body.appendChild(s)
  })
}

/* ---- Gauge semicircular ---- */
function Gauge({ label, val, meta, pace, isCurrent }) {
  const ratio = meta ? val / meta : 0
  const pct = Math.min(Math.max(ratio, 0), 1)
  const color = ratio >= 0.8 ? C.green : ratio >= 0.5 ? C.amber : C.red
  const cx = 110, cy = 110, r = 88
  const pol = (a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)]
  const [sx, sy] = pol(Math.PI), [ex, ey] = pol(0)
  const [vx, vy] = pol(Math.PI * (1 - pct))
  const [mx, my] = pol(Math.PI * (1 - 0.8))
  const objetivo = meta * (pace || 0); const dif = val - objetivo
  return (
    <div className="card p-4 flex flex-col items-center">
      <div className="text-sm font-semibold text-ink self-start mb-1">{label}</div>
      <svg viewBox="0 0 220 132" className="w-full max-w-[260px]">
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`} fill="none" stroke="#e6ebf0" strokeWidth="16" strokeLinecap="round" />
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${vx} ${vy}`} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" />
        <line x1={mx} y1={my} x2={cx + (r + 10) * Math.cos(Math.PI * 0.2)} y2={cy - (r + 10) * Math.sin(Math.PI * 0.2)} stroke="#94a3b8" strokeWidth="2" />
        <text x={cx} y={cy - 24} textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: C.graphite }}>{Math.round(ratio * 100)}%</text>
        <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 12, fill: C.muted }}>{CLP(val)}</text>
      </svg>
      <div className="text-xs text-slate-500 mt-1">Meta {CLP(meta)} · marca 80%</div>
      <div className="text-xs mt-1 text-center">
        {isCurrent
          ? <>Deberías llevar <b>{CLP(objetivo)}</b> · {dif >= 0 ? <span style={{ color: C.green }}>+{CLP(dif)} adelantado</span> : <span style={{ color: C.red }}>{CLP(dif)} atrasado</span>}</>
          : <span className="text-slate-400">Período cerrado · meta {CLP(meta)}</span>}
      </div>
    </div>
  )
}

const KPI = ({ titulo, valor, color, sub }) => (
  <div className="card p-4 border-t-4" style={{ borderTopColor: color || '#cbd5e1' }}>
    <div className="text-xs text-slate-500">{titulo}</div>
    <div className="text-2xl font-bold text-ink mt-1">{valor}</div>
    {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
  </div>
)
const semaforo = (estado) => estado === 'g' ? C.green : estado === 'a' ? C.amber : estado === 'r' ? C.red : null

export default function PanelOperativo() {
  const { perfil } = useAuth()
  const [cfg, setCfg] = useState(DEFAULTS)
  const [raw, setRaw] = useState([])
  const [estado, setEstado] = useState('cargando') // cargando | listo | error
  const [errMsg, setErrMsg] = useState('')
  const [ym, setYm] = useState(null)
  const [modo, setModo] = useState('mes') // 'mes' | 'rango'
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [area, setArea] = useState('Todas')
  const [net, setNet] = useState(false)
  const [brand, setBrand] = useState(null) // 'Toyota' | 'Multimarca' | null
  const [gran, setGran] = useState('dia')
  const [rankM, setRankM] = useState('v') // orden Top marcas: 'v' ventas | 'ot' frecuencia
  const [matM, setMatM] = useState('tk') // métrica de la matriz: 'tk' ticket promedio | 'ot' OTs
  const [ciVista, setCiVista] = useState('centro') // serie de centros: 'centro' | 'subarea'
  const [updated, setUpdated] = useState('')
  const cfgRef = useRef(cfg)

  // Config de la empresa
  useEffect(() => {
    if (!perfil?.empresa_id) return
    supabase.from('empresa_config').select('valor').eq('empresa_id', perfil.empresa_id).eq('clave', 'dashboard').maybeSingle()
      .then(({ data }) => { const c = { ...DEFAULTS, ...(data?.valor || {}) }; setCfg(c); cfgRef.current = c; refrescar(c) })
  }, [perfil?.empresa_id])

  async function refrescar(c = cfgRef.current) {
    setEstado((e) => (e === 'listo' ? 'listo' : 'cargando'))
    try {
      const rows = await loadData(c.sheet_id, c.gid)
      setRaw(rows); setEstado('listo')
      setUpdated(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) { setErrMsg(e.message); setEstado('error') }
  }

  // Auto-refresco
  useEffect(() => {
    const min = cfg.refresh_min || 15
    const id = setInterval(() => refrescar(), min * 60 * 1000)
    return () => clearInterval(id)
  }, [cfg.refresh_min])

  // Opciones de mes + selección inicial
  const meses = useMemo(() => {
    const set = new Set()
    raw.forEach((r) => { const d = parseGvizDate(r['F. Ingreso']); if (d) set.add(ymKey(d)) })
    return [...set].sort().reverse()
  }, [raw])
  useEffect(() => { if (meses.length && (!ym || !meses.includes(ym))) setYm(meses[0]) }, [meses]) // eslint-disable-line

  // Al pasar a modo rango, precargar con el mes seleccionado
  useEffect(() => {
    if (modo !== 'rango' || desde || !ym) return
    const [y, m] = ym.split('-').map(Number)
    setDesde(toISO(new Date(y, m - 1, 1)))
    setHasta(toISO(new Date(y, m, 0)))
  }, [modo]) // eslint-disable-line

  // Presets rápidos: últimos N meses (hasta hoy) o año en curso
  function preset(tipo) {
    const hoy = new Date()
    let ini
    if (tipo === 'ytd') ini = new Date(hoy.getFullYear(), 0, 1)
    else ini = new Date(hoy.getFullYear(), hoy.getMonth() - (tipo - 1), 1)
    setModo('rango'); setDesde(toISO(ini)); setHasta(toISO(hoy))
  }

  const ventasField = net ? 'Neto Total Reparación' : 'Total Reparación'

  /* Columnas detectadas en la hoja para el análisis de centros de ingreso */
  const cols = useMemo(() => {
    const keys = raw.length ? Object.keys(raw[0]) : []
    const centro = pickCol(keys, ['CENTRO', 'INGRESO'], false) || pickCol(keys, ['CENTRO'], false)
    const sub = SUBAREAS.map((s) => {
      let c = pickCol(keys, s.tokens, net, s.excluye)
      if (!c && s.alt) c = pickCol(keys, s.alt, net, s.excluye)
      return { ...s, col: c }
    })
    const desc = { ...DESC_META, col: pickCol(keys, DESC_META.tokens, net) }
    return { keys, centro, sub, desc, faltantes: sub.filter((s) => !s.col).map((s) => s.label) }
  }, [raw, net])

  // Cálculo de todo el panel
  const D = useMemo(() => {
    if (!ym) return null
    const f = ventasField

    // ---- Período: un mes o un rango de fechas ----
    let rangoIni, rangoFin
    if (modo === 'rango' && desde && hasta) {
      rangoIni = parseISO(desde); rangoFin = parseISO(hasta)
      if (rangoFin < rangoIni) { const t = rangoIni; rangoIni = rangoFin; rangoFin = t }
    } else {
      const [y, m] = ym.split('-').map(Number)
      rangoIni = new Date(y, m - 1, 1); rangoFin = new Date(y, m, 0)
    }
    const finDia = new Date(rangoFin.getFullYear(), rangoFin.getMonth(), rangoFin.getDate(), 23, 59, 59)
    const periodoRows = raw.filter((r) => { const d = parseGvizDate(r['F. Ingreso']); return d && d >= rangoIni && d <= finDia })
    const areaRows = area === 'Todas' ? periodoRows : periodoRows.filter((r) => areaDe(r) === area)
    const rows = brand ? areaRows.filter((r) => esToyota(r) === (brand === 'Toyota')) : areaRows

    // Gauges: total del período por marca (sin filtro de área/donut)
    const ventasToyota = periodoRows.filter(esToyota).reduce((s, r) => s + num(r[f]), 0)
    const ventasMM = periodoRows.filter((r) => !esToyota(r)).reduce((s, r) => s + num(r[f]), 0)
    const ventasTotal = ventasToyota + ventasMM

    // Metas prorrateadas por meses equivalentes del rango
    const mesesEq = mesesEquivalentes(rangoIni, rangoFin)
    const metaT = cfg.meta_toyota * mesesEq
    const metaM = cfg.meta_multimarca * mesesEq

    // Avance esperado según días del rango transcurridos
    const now = new Date()
    const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const isCurrent = hoy >= rangoIni && hoy <= rangoFin
    const totalDias = Math.round((rangoFin - rangoIni) / 86400000) + 1
    const diasTrans = Math.round((hoy - rangoIni) / 86400000) + 1
    const pace = isCurrent ? diasTrans / totalDias : (hoy < rangoIni ? 0 : 1)

    // KPIs sobre rows (área + marca)
    const conVenta = rows.filter((r) => num(r[f]) > 0)
    const ticket = conVenta.length ? conVenta.reduce((s, r) => s + num(r[f]), 0) / conVenta.length : 0
    const garantias = rows.filter((r) => txt(r['Tipo de Ingreso']).toLowerCase() === 'garantia').length
    const vehiculos = rows.filter((r) => txt(r['N° Orden Trabajo']) !== '').length
    const nps = npsCalc(rows)
    const gen = rows.filter((r) => txt(r['N° Presupuesto']) !== '').length
    const apr = rows.filter((r) => { const np = txt(r['N° Presupuesto']) !== ''; const td = txt(r['Tipo Documento']); return np && td !== '' && td.toLowerCase() !== 'sin documento' }).length
    const aprPct = gen ? Math.round(apr / gen * 100) : 0
    const cumpl = (metaT + metaM) ? ventasTotal / (metaT + metaM) * 100 : 0
    const perm = avg(rows, 'Permanencia'), permP = avg(rows, 'Días Recomendados Reparación')
    const enTaller = raw.filter((r) => txt(r['Estado Vehículo']).toLowerCase() === 'en taller').length

    // Movimiento
    let mov = []
    if (gran === 'dia') {
      const multiMes = rangoIni.getMonth() !== rangoFin.getMonth() || rangoIni.getFullYear() !== rangoFin.getFullYear()
      const m = {}; rows.forEach((r) => { const d = parseGvizDate(r['F. Ingreso']); if (!d) return; const k = dmKey(d); if (!m[k]) m[k] = { veh: 0, v: 0 }; m[k].veh++; m[k].v += num(r[f]) })
      mov = Object.entries(m).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, v]) => {
        const [, mm, dd] = k.split('-')
        return { name: multiMes ? +dd + ' ' + MES[+mm - 1] : +dd, vehiculos: v.veh, ventas: v.v }
      })
    } else {
      // En modo rango se grafica solo el período; en modo mes, toda la historia (tendencia)
      const base = modo === 'rango'
        ? rows
        : (brand ? raw.filter((r) => esToyota(r) === (brand === 'Toyota')) : raw)
      const m = {}; base.forEach((r) => { const d = parseGvizDate(r['F. Ingreso']); if (!d) return; const k = gran === 'mes' ? ymKey(d) : String(d.getFullYear()); if (!m[k]) m[k] = { veh: 0, v: 0 }; m[k].veh++; m[k].v += num(r[f]) })
      mov = Object.entries(m).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, v]) => ({ name: gran === 'mes' ? ymLabel(k) : k, vehiculos: v.veh, ventas: v.v }))
    }

    // Donut por área de negocio (sobre areaRows, para poder filtrar por marca)
    const vt = areaRows.filter(esToyota).reduce((s, r) => s + num(r[f]), 0)
    const vm = areaRows.filter((r) => !esToyota(r)).reduce((s, r) => s + num(r[f]), 0)

    const porMarca = topAgg(rows, 'Marca', f, 8, (m) => normMarca(m))
    const porServicio = topAgg(rows, 'Tipo Servicio 1', f, 8)

    // ---- Centros de ingreso (clasificación contable de la hoja) ----
    // Usa SOLO el filtro de período: el centro es una clasificación alternativa a marca/área,
    // cruzarlas produciría doble filtrado sobre la misma realidad.
    let centros = null
    if (cols.centro) {
      const cmap = {}
      const serieMap = {}
      const multiMes = ymKey(rangoIni) !== ymKey(rangoFin)
      periodoRows.forEach((r) => {
        const c = normCentro(r[cols.centro])
        const tot = num(r[ventasField])
        if (!cmap[c]) { cmap[c] = { total: 0, ot: 0, resid: 0, desc: 0 }; SUBAREAS.forEach((s) => { cmap[c][s.k] = 0 }) }
        cmap[c].total += tot; cmap[c].ot++
        let suma = 0
        cols.sub.forEach((s) => { if (!s.col) return; const v = num(r[s.col]); cmap[c][s.k] += v; suma += v })
        const dsc = cols.desc.col ? num(r[cols.desc.col]) : 0
        cmap[c].desc += dsc
        cmap[c].resid += (tot - (suma - dsc))
        // serie temporal
        const d = parseGvizDate(r['F. Ingreso']); if (!d) return
        const k = multiMes ? ymKey(d) : dmKey(d)
        if (!serieMap[k]) { serieMap[k] = { _c: {}, _s: {} } }
        serieMap[k]._c[c] = (serieMap[k]._c[c] || 0) + tot
        cols.sub.forEach((s) => { if (!s.col) return; serieMap[k]._s[s.k] = (serieMap[k]._s[s.k] || 0) + num(r[s.col]) })
        serieMap[k]._s.desc = (serieMap[k]._s.desc || 0) - dsc
        serieMap[k]._s.resid = (serieMap[k]._s.resid || 0) + (tot - (suma - dsc))
      })
      const lista = Object.entries(cmap).map(([nombre, x]) => ({ nombre, ...x })).sort((a, b) => b.total - a.total)
      const totalGeneral = lista.reduce((s, x) => s + x.total, 0)
      const totalesSub = {}
      SUBAREAS.forEach((s) => { totalesSub[s.k] = lista.reduce((a, x) => a + x[s.k], 0) })
      totalesSub.desc = lista.reduce((a, x) => a + x.desc, 0)
      totalesSub.resid = lista.reduce((a, x) => a + x.resid, 0)
      const serie = Object.entries(serieMap).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, v]) => {
        const [yy, mm, dd] = k.split('-')
        const name = multiMes ? MES[+mm - 1] + ' ' + String(yy).slice(2) : (dd ? +dd + '' : k)
        return { name, ...v._c, ...Object.fromEntries(Object.entries(v._s).map(([kk, vv]) => ['s_' + kk, vv])) }
      })
      centros = { lista, totalGeneral, totalesSub, serie, nombres: lista.map((x) => x.nombre) }
    }

    const mmap = {}
    rows.forEach((r) => {
      const k = normMarca(r['Marca']); if (!k || k === '0') return
      if (!mmap[k]) mmap[k] = { ot: 0, v: 0, cv: 0 }
      mmap[k].ot++; const val = num(r[f]); mmap[k].v += val; if (val > 0) mmap[k].cv++
    })
    const marcasStats = Object.entries(mmap).map(([marca, x]) => ({ marca, ot: x.ot, v: x.v, ticket: x.cv ? x.v / x.cv : 0 }))

    // Cruce tipo de servicio × marca (para la matriz de doble entrada)
    const cruce = {}
    rows.forEach((r) => {
      const s = normServ(r['Tipo Servicio 1']); if (!s || s === '0') return
      const m = normMarca(r['Marca']); if (!m || m === '0') return
      if (!cruce[s]) cruce[s] = { total: 0, marcas: {} }
      if (!cruce[s].marcas[m]) cruce[s].marcas[m] = { ot: 0, v: 0, cv: 0 }
      const val = num(r[f])
      cruce[s].total += val; cruce[s].marcas[m].ot++; cruce[s].marcas[m].v += val
      if (val > 0) cruce[s].marcas[m].cv++
    })

    // Técnicos con comisión
    const tmap = {}
    rows.forEach((r) => {
      const t = txt(r['Técnico Principal']); if (!t || t === '0') return
      if (!matchTec(t, cfg.tecnicos_comision)) return
      const mo = num(r['Neto Mano de Obra']); if (mo <= 0) return
      const share = mo / (1 + countSec(r['Técnicos Secundarios']))
      if (!tmap[t]) tmap[t] = { ot: 0, mo: 0 }; tmap[t].ot++; tmap[t].mo += share
    })
    const tecnicos = Object.entries(tmap).map(([t, v]) => ({ t, ot: v.ot, mo: v.mo, com: v.mo * cfg.comision_pct })).sort((a, b) => b.mo - a.mo)
    const moTotal = tecnicos.reduce((s, x) => s + x.mo, 0)

    // DyP
    // Universo DyP: definido por el ÁREA DEL SERVICIO (clasificación oficial de la hoja).
    // El área es una propiedad del trabajo realizado, no de quién lo ejecuta.
    const dypRows = rows.filter((r) => areaDe(r) === 'DyP')
    const dypVentas = dypRows.reduce((s, r) => s + num(r[f]), 0)
    const dypMo = dypRows.reduce((s, r) => s + num(r['Neto Mano de Obra']), 0)
    const dypCV = dypRows.filter((r) => num(r[f]) > 0)
    const dypTicket = dypCV.length ? dypCV.reduce((s, r) => s + num(r[f]), 0) / dypCV.length : 0
    const dmap = {}
    dypRows.forEach((r) => { const t = txt(r['Técnico Principal']); if (!dmap[t]) dmap[t] = { ot: 0, v: 0, mo: 0 }; dmap[t].ot++; dmap[t].v += num(r[f]); dmap[t].mo += num(r['Neto Mano de Obra']) })
    const dypDet = Object.entries(dmap).map(([t, v]) => ({ t, ...v })).sort((a, b) => b.v - a.v)

    // DyP: desglose por tipo de servicio
    const dsmap = {}
    dypRows.forEach((r) => {
      const s = normServ(r['Tipo Servicio 1']) || 'SIN SERVICIO'
      if (!dsmap[s]) dsmap[s] = { ot: 0, v: 0, mo: 0, cv: 0 }
      dsmap[s].ot++; const val = num(r[f]); dsmap[s].v += val; dsmap[s].mo += num(r['Neto Mano de Obra']); if (val > 0) dsmap[s].cv++
    })
    const dypServicios = Object.entries(dsmap)
      .map(([s, x]) => ({ s, ot: x.ot, v: x.v, mo: x.mo, ticket: x.cv ? x.v / x.cv : 0 }))
      .sort((a, b) => b.v - a.v)

    return {
      ventasToyota, ventasMM, ventasTotal, metaT, metaM, mesesEq, pace, isCurrent, ticket, garantias, vehiculos, nps,
      gen, apr, aprPct, cumpl, perm, permP, enTaller, mov, vt, vm, porMarca, porServicio,
      marcasStats, cruce, centros, _rows: rows, _periodo: periodoRows, _rango: { ini: rangoIni, fin: rangoFin },
      tecnicos, moTotal, dyp: { rows: dypRows, ventas: dypVentas, mo: dypMo, ticket: dypTicket, det: dypDet, servicios: dypServicios }
    }
  }, [raw, ym, modo, desde, hasta, area, net, brand, gran, cfg, cols])

  if (estado === 'cargando' && !raw.length) return <div className="text-slate-400 text-sm py-10 text-center">Conectando con la base de datos…</div>
  if (estado === 'error') return (
    <div className="card p-6 max-w-lg">
      <div className="font-semibold text-red-600 mb-2">No se pudo cargar el panel</div>
      <p className="text-sm text-slate-600">{errMsg}</p>
      <p className="text-sm text-slate-500 mt-2">La pestaña <b>Dashboard_Data</b> debe estar compartida como “Cualquiera con el enlace · Lector”, y el <b>SHEET_ID</b>/<b>GID</b> deben ser correctos (Configuración del panel).</p>
      <button className="btn-primary mt-4" onClick={() => refrescar()}>Reintentar</button>
    </div>
  )
  if (!D) return <div className="text-slate-400 text-sm py-10 text-center">Sin datos en la hoja.</div>

  const kpis = [
    { titulo: '% Cumplimiento metas', valor: D.cumpl.toFixed(0) + '%', estado: D.cumpl >= 80 ? 'g' : D.cumpl >= 50 ? 'a' : 'r', sub: 'Meta total ' + CLP(D.metaT + D.metaM) },
    { titulo: 'Ticket promedio', valor: CLP(D.ticket), estado: D.ticket >= cfg.meta_ticket ? 'g' : 'r', sub: 'Meta mín. ' + CLP(cfg.meta_ticket) },
    { titulo: 'Garantías del período', valor: D.garantias, estado: D.garantias > cfg.max_garantias * Math.max(D.mesesEq, 1) ? 'r' : 'g', sub: 'Máx. ' + Math.round(cfg.max_garantias * Math.max(D.mesesEq, 1)) },
    { titulo: 'Vehículos ingresados', valor: D.vehiculos, estado: null, sub: 'OTs del período' },
    { titulo: 'NPS', valor: (D.nps.nps >= 0 ? '+' : '') + D.nps.nps.toFixed(0), estado: D.nps.nps >= 50 ? 'g' : D.nps.nps >= 0 ? 'a' : 'r', sub: `${D.nps.prom} prom · ${D.nps.det} det` },
    { titulo: 'Presup. aprobados', valor: D.aprPct + '%', estado: null, sub: `${D.apr} de ${D.gen} generados` }
  ]
  /* ---------------- Exportaciones ---------------- */
  const etiquetaPeriodo = modo === 'rango' && desde && hasta ? `${desde} a ${hasta}` : ymLabel(ym || '')
  const slugPeriodo = (modo === 'rango' && desde && hasta ? `${desde}_${hasta}` : (ym || '')).replace(/-/g, '')

  function exportarExcel() {
    const wb = XLSX.utils.book_new()
    const add = (nombre, datos, anchos) => {
      const ws = XLSX.utils.json_to_sheet(datos)
      if (anchos) ws['!cols'] = anchos.map((w) => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31))
    }

    // 1) Resumen — KPIs y contexto del reporte
    add('Resumen', [
      { Indicador: 'Período', Valor: etiquetaPeriodo },
      { Indicador: 'Base de monto', Valor: net ? 'Neto' : 'Bruto' },
      { Indicador: 'Segmento de marca', Valor: brand || 'Todas' },
      { Indicador: 'Área', Valor: area },
      { Indicador: 'Generado', Valor: new Date().toLocaleString('es-CL') },
      { Indicador: '', Valor: '' },
      { Indicador: 'Ventas del período', Valor: D.ventasTotal },
      { Indicador: 'Ventas Toyota', Valor: D.ventasToyota },
      { Indicador: 'Ventas Multimarca', Valor: D.ventasMM },
      { Indicador: 'Meta Toyota (prorrateada)', Valor: D.metaT },
      { Indicador: 'Meta Multimarca (prorrateada)', Valor: D.metaM },
      { Indicador: 'Meses equivalentes del período', Valor: +D.mesesEq.toFixed(2) },
      { Indicador: '% Cumplimiento de metas', Valor: +D.cumpl.toFixed(1) },
      { Indicador: 'Vehículos ingresados (OTs)', Valor: D.vehiculos },
      { Indicador: 'Ticket promedio', Valor: Math.round(D.ticket) },
      { Indicador: 'Garantías', Valor: D.garantias },
      { Indicador: 'NPS', Valor: D.nps.valor },
      { Indicador: 'Presupuestos generados', Valor: D.gen },
      { Indicador: 'Presupuestos aprobados', Valor: D.apr },
      { Indicador: '% Aprobación', Valor: D.aprPct },
      { Indicador: 'Permanencia real (días)', Valor: +D.perm.toFixed(2) },
      { Indicador: 'Vehículos en taller (foto actual)', Valor: D.enTaller },
      { Indicador: 'MO comisionable', Valor: D.moTotal }
    ], [34, 20])

    // 2) Marcas
    add('Marcas', D.marcasStats.sort((a, b) => b.v - a.v).map((x, i) => ({
      '#': i + 1, Marca: x.marca, OTs: x.ot,
      '% OTs': totOT ? +(x.ot / totOT * 100).toFixed(2) : 0,
      Ventas: Math.round(x.v),
      '% Ventas': totV ? +(x.v / totV * 100).toFixed(2) : 0,
      'Ticket promedio': Math.round(x.ticket)
    })), [5, 22, 8, 9, 14, 10, 16])

    // 3) Matriz servicio × marca (una fila por cruce, para tabla dinámica)
    const cruces = []
    Object.entries(D.cruce).forEach(([serv, fila]) => {
      Object.entries(fila.marcas).forEach(([marca, c]) => {
        cruces.push({ Servicio: serv, Marca: marca, OTs: c.ot, Ventas: Math.round(c.v), 'OTs con venta': c.cv, 'Ticket promedio': Math.round(c.cv ? c.v / c.cv : 0) })
      })
    })
    add('Servicio x Marca', cruces.sort((a, b) => b.Ventas - a.Ventas), [30, 20, 8, 14, 14, 16])

    // 4) Tipo de servicio
    add('Tipo de servicio', D.porServicio.map((x) => ({ Servicio: x.name, Ventas: Math.round(x.value) })), [34, 14])

    // 5) DyP
    add('DyP servicios', D.dyp.servicios.map((x) => ({
      Servicio: x.s, OTs: x.ot, Ventas: Math.round(x.v), 'MO neta': Math.round(x.mo), 'Ticket promedio': Math.round(x.ticket)
    })), [34, 8, 14, 14, 16])
    add('DyP tecnicos', D.dyp.det.map((x) => ({ Técnico: x.t, OTs: x.ot, Ventas: Math.round(x.v), 'MO neta': Math.round(x.mo) })), [24, 8, 14, 14])

    // 6) Centros de ingreso
    if (D.centros) {
      add('Centros de ingreso', D.centros.lista.map((c) => {
        const fila = { Centro: c.nombre, OTs: c.ot }
        SUBAREAS.forEach((s) => { fila[s.label] = Math.round(c[s.k]) })
        fila['Descuentos'] = -Math.round(c.desc)
        fila['Sin desglosar'] = Math.round(c.resid)
        fila['Total'] = Math.round(c.total)
        fila['% empresa'] = D.centros.totalGeneral ? +(c.total / D.centros.totalGeneral * 100).toFixed(2) : 0
        fila['Ticket promedio'] = Math.round(c.ot ? c.total / c.ot : 0)
        return fila
      }), [16, 8, 14, 14, 18, 16, 13, 14, 14, 11, 16])
      add('Centros evolucion', D.centros.serie, [12, 14, 14, 14, 14, 14, 14, 14])
    }

    // 7) Técnicos con comisión
    add('Tecnicos comision', D.tecnicos.map((x) => ({ Técnico: x.t, OTs: x.ot, 'MO neta': Math.round(x.mo), 'Comisión estimada': Math.round(x.com) })), [24, 8, 14, 18])

    // 8) Movimiento
    add('Movimiento', D.mov.map((x) => ({ Período: x.name, Vehículos: x.vehiculos, Ventas: Math.round(x.ventas) })), [12, 12, 14])

    // 9) Detalle de OTs — la base que sustenta todos los análisis
    const campos = ['N° Orden Trabajo', 'F. Ingreso', 'Marca', 'Modelo', 'Patente', 'Tipo Servicio 1', 'Área Servicio',
      'Centro de Ingreso', 'Técnico Principal', 'Tipo Documento', 'N° Presupuesto', 'N.P.S', 'Permanencia',
      'Estado Vehículo', 'Total Reparación', 'Neto Total Reparación', 'Neto Mano de Obra', 'Neto Repuestos',
      'Neto Lubricantes', 'Neto Descuento', 'Monto Servicio Externo']
    const disponibles = campos.filter((c) => cols.keys.includes(c))
    add('Detalle OTs', D._periodo.map((r) => {
      const o = {}
      disponibles.forEach((c) => {
        const v = r[c]
        o[c] = /Total|Neto|Monto|Permanencia|N.P.S/.test(c) ? num(v) : txt(v)
      })
      return o
    }), disponibles.map(() => 16))

    XLSX.writeFile(wb, `panel-operativo-didial-${slugPeriodo}.xlsx`)
  }

  function exportarPDF() {
    window.print()
  }

  const donutArea = [{ name: 'Toyota', value: D.vt, c: C.red }, { name: 'Multimarca', value: D.vm, c: C.graphite }]
  const npsData = [{ name: 'Promotores', value: D.nps.prom, c: C.green }, { name: 'Pasivos', value: D.nps.pas, c: C.amber }, { name: 'Detractores', value: D.nps.det, c: C.red }]

  // Top 10 marcas según el orden elegido (ventas o frecuencia)
  const top10 = [...D.marcasStats].sort((a, b) => rankM === 'ot' ? (b.ot - a.ot || b.v - a.v) : (b.v - a.v)).slice(0, 10)
  const totOT = D.marcasStats.reduce((s, x) => s + x.ot, 0)
  const totV = D.marcasStats.reduce((s, x) => s + x.v, 0)
  const maxVMarca = Math.max(...top10.map((x) => x.v), 1)

  // Matriz servicio × marcas top 10: top 10 servicios por ventas dentro del cruce
  const matMarcas = top10.map((x) => x.marca)
  const matServs = Object.entries(D.cruce).sort((a, b) => b[1].total - a[1].total).slice(0, 10).map(([s]) => s)
  const celda = (c) => { if (!c) return 0; return matM === 'ot' ? c.ot : (c.cv ? c.v / c.cv : 0) }
  let matMax = 1
  matServs.forEach((s) => matMarcas.forEach((m) => { matMax = Math.max(matMax, celda(D.cruce[s]?.marcas[m])) }))

  return (
    <div className="space-y-5" id="panel-print">
      {/* Cabecera visible solo al imprimir/exportar a PDF */}
      <div className="hidden print:block mb-2">
        <h1 className="text-xl font-bold text-ink">Panel operativo · Servicio Automotriz Didial</h1>
        <p className="text-xs text-slate-500">
          Período: {etiquetaPeriodo} · Montos: {net ? 'Neto' : 'Bruto'} · Marca: {brand || 'Todas'} · Área: {area} · Generado: {new Date().toLocaleString('es-CL')}
        </p>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 no-print">
        {/* Período: mes único o rango de fechas */}
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button onClick={() => setModo('mes')} className={`px-3 py-1.5 ${modo === 'mes' ? 'bg-deep text-white' : 'text-slate-500'}`}>Mes</button>
          <button onClick={() => setModo('rango')} className={`px-3 py-1.5 ${modo === 'rango' ? 'bg-deep text-white' : 'text-slate-500'}`}>Rango</button>
        </div>
        {modo === 'mes' ? (
          <select className="input w-auto" value={ym || ''} onChange={(e) => setYm(e.target.value)}>
            {meses.map((m) => <option key={m} value={m}>{ymLabel(m)}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" className="input w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <span className="text-slate-400 text-sm">→</span>
            <input type="date" className="input w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs">
              <button onClick={() => preset(3)} className="px-2 py-1.5 text-slate-500 hover:bg-slate-100">3M</button>
              <button onClick={() => preset(6)} className="px-2 py-1.5 text-slate-500 hover:bg-slate-100 border-l border-slate-200">6M</button>
              <button onClick={() => preset(12)} className="px-2 py-1.5 text-slate-500 hover:bg-slate-100 border-l border-slate-200">12M</button>
              <button onClick={() => preset('ytd')} className="px-2 py-1.5 text-slate-500 hover:bg-slate-100 border-l border-slate-200">Año</button>
            </div>
          </div>
        )}
        {/* Segmento de marca */}
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {[[null, 'Todas'], ['Toyota', 'Toyota'], ['Multimarca', 'Multimarca']].map(([v, lbl]) => (
            <button key={lbl} onClick={() => setBrand(v)} className={`px-3 py-1.5 ${brand === v ? (v === 'Toyota' ? 'bg-didial-red text-white' : 'bg-deep text-white') : 'text-slate-500'}`}>{lbl}</button>
          ))}
        </div>
        <select className="input w-auto" value={area} onChange={(e) => setArea(e.target.value)}>
          {['Todas', 'DyP', 'Servicio Rápido', 'Taller', 'Por clasificar', 'Sin servicio'].map((a) => <option key={a}>{a}</option>)}
        </select>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button onClick={() => setNet(false)} className={`px-3 py-1.5 ${!net ? 'bg-deep text-white' : 'text-slate-500'}`}>Bruto</button>
          <button onClick={() => setNet(true)} className={`px-3 py-1.5 ${net ? 'bg-deep text-white' : 'text-slate-500'}`}>Neto</button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">Actualizado {updated}</span>
          <button onClick={() => refrescar()} className="btn-soft text-sm">↻ Actualizar</button>
          <button onClick={exportarPDF} className="btn-soft text-sm" title="Abre el diálogo de impresión: elige 'Guardar como PDF'">📄 PDF</button>
          <button onClick={exportarExcel} className="btn-soft text-sm" title="Descarga un libro con una hoja por análisis">📊 Excel</button>
        </div>
      </div>

      {/* Gauges */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className={brand === 'Multimarca' ? 'opacity-40 transition-opacity' : 'transition-opacity'}>
          <Gauge label={'Meta Toyota' + (D.mesesEq > 1.02 ? ` (${D.mesesEq.toFixed(1)} meses)` : '')} val={D.ventasToyota} meta={D.metaT} pace={D.pace} isCurrent={D.isCurrent} />
        </div>
        <div className={brand === 'Toyota' ? 'opacity-40 transition-opacity' : 'transition-opacity'}>
          <Gauge label={'Meta Multimarca' + (D.mesesEq > 1.02 ? ` (${D.mesesEq.toFixed(1)} meses)` : '')} val={D.ventasMM} meta={D.metaM} pace={D.pace} isCurrent={D.isCurrent} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {kpis.map((k) => <KPI key={k.titulo} titulo={k.titulo} valor={k.valor} color={semaforo(k.estado)} sub={k.sub} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI titulo="Vehículos en taller" valor={D.enTaller} color={C.blue} sub="Estado = En taller (toda la base)" />
        <KPI titulo="Permanencia real" valor={D.perm.toFixed(1) + ' días'} color={null} sub={'Presupuestada ' + D.permP.toFixed(1) + ' días'} />
        <KPI titulo="Ventas del período" valor={CLP(D.ventasTotal)} color={C.green} sub={net ? 'Neto' : 'Bruto'} />
        <KPI titulo="MO comisionable" valor={CLP(D.moTotal)} color={C.green} sub={'Comisión ' + CLP(D.moTotal * cfg.comision_pct)} />
      </div>

      {/* Movimiento */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-ink">Movimiento (vehículos y ventas)</h3>
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm no-print">
            {['dia', 'mes', 'anio'].map((g) => (
              <button key={g} onClick={() => setGran(g)} className={`px-3 py-1 capitalize ${gran === g ? 'bg-deep text-white' : 'text-slate-500'}`}>
                {g === 'dia' ? 'Día' : g === 'mes' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={D.mov}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => '$' + Math.round(v / 1000) + 'k'} />
            <Tooltip formatter={(v, n) => n === 'ventas' ? CLP(v) : v} />
            <Bar yAxisId="l" dataKey="vehiculos" fill={C.graphite} radius={[3, 3, 0, 0]} barSize={18} name="vehículos" />
            <Line yAxisId="r" dataKey="ventas" stroke={C.red} strokeWidth={2} dot={false} name="ventas" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Donut área + Ventas por marca */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-ink mb-1">Ventas por área de negocio</h3>
          <p className="text-[11px] text-slate-400 mb-2">Clic en una porción para filtrar todo el panel por marca.</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={donutArea} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}
                   onClick={(d) => setBrand((b) => b === d.name ? null : d.name)}>
                {donutArea.map((d) => <Cell key={d.name} fill={d.c} cursor="pointer" opacity={brand && brand !== d.name ? 0.35 : 1} />)}
              </Pie>
              <Tooltip formatter={(v) => CLP(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-sm">
            <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: C.red }} />Toyota {CLP(D.vt)}</span>
            <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: C.graphite }} />Multimarca {CLP(D.vm)}</span>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-ink">Top 10 marcas</h3>
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs no-print">
              <button onClick={() => setRankM('v')} className={`px-2 py-1 ${rankM === 'v' ? 'bg-deep text-white' : 'text-slate-500'}`}>Por ventas</button>
              <button onClick={() => setRankM('ot')} className={`px-2 py-1 ${rankM === 'ot' ? 'bg-deep text-white' : 'text-slate-500'}`}>Por frecuencia</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs border-b">
                <th className="text-left py-1 w-6">#</th><th className="text-left">Marca</th>
                <th className="text-right">OTs</th><th className="text-right">% OTs</th>
                <th className="text-right">Ventas</th><th className="text-right">Ticket prom.</th>
              </tr>
            </thead>
            <tbody>
              {top10.length ? top10.map((x, i) => (
                <tr key={x.marca} className="border-b last:border-0">
                  <td className="py-1.5 text-slate-400">{i + 1}</td>
                  <td className="font-medium relative">
                    <div className="absolute inset-y-1 left-0 rounded-sm bg-slate-100 -z-0" style={{ width: (x.v / maxVMarca * 100) + '%' }} />
                    <span className="relative z-10">{x.marca}</span>
                  </td>
                  <td className="text-right">{x.ot}</td>
                  <td className="text-right text-slate-400">{totOT ? Math.round(x.ot / totOT * 100) : 0}%</td>
                  <td className="text-right">{CLP(x.v)}</td>
                  <td className="text-right font-medium" style={{ color: x.ticket >= cfg.meta_ticket ? C.green : C.muted }}>{CLP(x.ticket)}</td>
                </tr>
              )) : <tr><td colSpan={6} className="text-slate-400 py-3">Sin OTs con marca en este período.</td></tr>}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-2">Ticket promedio sobre OTs con venta &gt; 0. Verde = sobre la meta mínima ({CLP(cfg.meta_ticket)}). Top 10 concentra {totV ? Math.round(top10.reduce((s, x) => s + x.v, 0) / totV * 100) : 0}% de las ventas.</p>
        </div>
      </div>

      {/* Matriz doble entrada: tipo de servicio × marcas top 10 */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h3 className="font-semibold text-ink">Servicio × Marca (Top 10)</h3>
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs no-print">
            <button onClick={() => setMatM('tk')} className={`px-2 py-1 ${matM === 'tk' ? 'bg-deep text-white' : 'text-slate-500'}`}>Ticket promedio</button>
            <button onClick={() => setMatM('ot')} className={`px-2 py-1 ${matM === 'ot' ? 'bg-deep text-white' : 'text-slate-500'}`}>OTs</button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">Top 10 servicios (filas, por ventas) × marcas del Top 10 (columnas, según el orden elegido arriba). {matM === 'tk' ? 'Ticket promedio del cruce, sobre OTs con venta > 0.' : 'Cantidad de OTs del cruce.'} Intensidad relativa al mayor valor de la tabla.</p>
        <div className="overflow-x-auto">
          <table className="text-xs min-w-full">
            <thead>
              <tr>
                <th className="text-left py-1 pr-2 text-slate-400 font-normal sticky left-0 bg-white">Servicio</th>
                {matMarcas.map((m) => <th key={m} className="text-center px-1 py-1 text-slate-500 font-medium whitespace-nowrap">{m}</th>)}
                <th className="text-right pl-2 text-slate-400 font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {matServs.length ? matServs.map((s) => {
                const fila = D.cruce[s]
                const vis = matMarcas.map((m) => fila.marcas[m]).filter(Boolean)
                const totOTf = vis.reduce((a, c) => a + c.ot, 0)
                const totVf = vis.reduce((a, c) => a + c.v, 0)
                const totCVf = vis.reduce((a, c) => a + c.cv, 0)
                const totFila = matM === 'ot' ? totOTf : (totCVf ? totVf / totCVf : 0)
                return (
                  <tr key={s} className="border-t border-slate-100">
                    <td className="py-1 pr-2 whitespace-nowrap font-medium text-ink sticky left-0 bg-white">{s}</td>
                    {matMarcas.map((m) => {
                      const c = fila.marcas[m]
                      const val = celda(c)
                      const alpha = val ? 0.12 + 0.75 * (val / matMax) : 0
                      return (
                        <td key={m} className="text-center px-1 py-1 rounded" style={{ background: alpha ? `rgba(47,111,176,${alpha})` : 'transparent', color: alpha > 0.55 ? '#fff' : C.graphite }}
                            title={c ? `${m} · ${s}: ${c.ot} OT · ${CLP(c.v)} · ticket ${CLP(c.cv ? c.v / c.cv : 0)}` : ''}>
                          {val ? (matM === 'ot' ? val : CLPc(val)) : '·'}
                        </td>
                      )
                    })}
                    <td className="text-right pl-2 font-medium">{matM === 'ot' ? totFila : CLPc(totFila)}</td>
                  </tr>
                )
              }) : <tr><td colSpan={matMarcas.length + 2} className="text-slate-400 py-3">Sin datos para cruzar en este período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Ingresos por centro de ingreso × naturaleza del ingreso ---- */}
      {!cols.centro ? (
        <div className="card p-4 border-l-4" style={{ borderLeftColor: C.amber }}>
          <h3 className="font-semibold text-ink mb-1">Ingresos por centro de ingreso</h3>
          <p className="text-sm text-slate-500">No se encontró una columna de <strong>Centro de ingreso</strong> en la hoja conectada. El panel busca los encabezados por nombre (no por letra de columna), así que la columna debe tener un encabezado que contenga "centro" e "ingreso".</p>
          <details className="mt-2">
            <summary className="text-xs text-slate-400 cursor-pointer">Ver las {cols.keys.length} columnas detectadas en la hoja</summary>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{cols.keys.join(' · ') || 'Ninguna (la hoja no cargó).'}</p>
          </details>
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h3 className="font-semibold text-ink">Ingresos por centro de ingreso</h3>
            <span className="text-[11px] text-slate-400">Columna: {cols.centro} · {net ? 'Neto' : 'Bruto'}</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Clasificación contable de la hoja (independiente de los filtros de marca y área, que son clasificaciones alternativas). Responde al período seleccionado.</p>

          <details className="mb-3">
            <summary className="text-[11px] text-slate-400 cursor-pointer">Columnas usadas en este análisis</summary>
            <ul className="text-[11px] text-slate-500 mt-1 space-y-0.5">
              {cols.sub.map((s) => {
                const esNeto = s.col && /^NETO/.test(normHdr(s.col))
                const mezcla = s.col && (net ? !esNeto : esNeto)
                return (
                  <li key={s.k}>
                    {s.label}: {s.col ? <code>{s.col}</code> : <span style={{ color: C.amber }}>no encontrada</span>}
                    {mezcla && <span style={{ color: C.amber }}> · solo existe en {esNeto ? 'Neto' : 'Bruto'}, se usa en modo {net ? 'Neto' : 'Bruto'} (bases mezcladas)</span>}
                  </li>
                )
              })}
              <li>Descuentos (se restan): {cols.desc.col ? <code>{cols.desc.col}</code> : <span style={{ color: C.amber }}>no encontrada</span>}</li>
              <li>Total de la OT: <code>{ventasField}</code></li>
              <li className="text-slate-400">Ecuación: mano de obra + repuestos + lubricantes + servicios externos − descuentos = total.</li>
            </ul>
          </details>

          {cols.faltantes.length > 0 && (
            <p className="text-[11px] mb-3 px-2 py-1.5 rounded" style={{ background: '#fdf6e3', color: '#8a6d1f' }}>
              No se encontraron columnas para: <strong>{cols.faltantes.join(', ')}</strong>. Esos montos caen en "Sin desglosar".
            </p>
          )}

          {/* Peso de cada centro */}
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            {D.centros.lista.slice(0, 3).map((c) => {
              const pct = D.centros.totalGeneral ? c.total / D.centros.totalGeneral * 100 : 0
              return (
                <div key={c.nombre} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CENTRO_COLOR[c.nombre] || C.muted }} />
                    <span className="text-sm font-medium text-ink">{c.nombre}</span>
                    <span className="ml-auto text-lg font-semibold" style={{ color: CENTRO_COLOR[c.nombre] || C.muted }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="text-xl font-semibold text-ink mt-1">{CLP(c.total)}</div>
                  <div className="text-xs text-slate-400">{c.ot} OTs · ticket {CLP(c.ot ? c.total / c.ot : 0)}</div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: pct + '%', background: CENTRO_COLOR[c.nombre] || C.muted }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Matriz centro × naturaleza del ingreso */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-slate-400 text-xs border-b">
                  <th className="text-left py-1">Centro</th>
                  {SUBAREAS.map((s) => <th key={s.k} className="text-right px-2">{s.label}</th>)}
                  <th className="text-right px-2">Descuentos</th>
                  <th className="text-right px-2">Sin desglosar</th>
                  <th className="text-right px-2">Total</th>
                  <th className="text-right px-2">% empresa</th>
                </tr>
              </thead>
              <tbody>
                {D.centros.lista.map((c) => (
                  <tr key={c.nombre} className="border-b last:border-0">
                    <td className="py-1.5 font-medium text-ink whitespace-nowrap">
                      <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: CENTRO_COLOR[c.nombre] || C.muted }} />{c.nombre}
                    </td>
                    {SUBAREAS.map((s) => (
                      <td key={s.k} className="text-right px-2">
                        {CLPc(c[s.k])}
                        <span className="block text-[10px] text-slate-400">{c.total ? (c[s.k] / c.total * 100).toFixed(0) : 0}%</span>
                      </td>
                    ))}
                    <td className="text-right px-2" style={{ color: c.desc ? C.red : C.muted }}>
                      {c.desc ? '−' + CLPc(c.desc) : '—'}
                      {!!c.desc && <span className="block text-[10px] text-slate-400">{c.total ? (c.desc / c.total * 100).toFixed(1) : 0}%</span>}
                    </td>
                    <td className="text-right px-2 text-slate-400">{CLPc(c.resid)}</td>
                    <td className="text-right px-2 font-semibold">{CLP(c.total)}</td>
                    <td className="text-right px-2">{D.centros.totalGeneral ? (c.total / D.centros.totalGeneral * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-1.5">Total empresa</td>
                  {SUBAREAS.map((s) => (
                    <td key={s.k} className="text-right px-2">
                      {CLPc(D.centros.totalesSub[s.k])}
                      <span className="block text-[10px] text-slate-400 font-normal">{D.centros.totalGeneral ? (D.centros.totalesSub[s.k] / D.centros.totalGeneral * 100).toFixed(0) : 0}%</span>
                    </td>
                  ))}
                  <td className="text-right px-2" style={{ color: C.red }}>
                    {D.centros.totalesSub.desc ? '−' + CLPc(D.centros.totalesSub.desc) : '—'}
                    {!!D.centros.totalesSub.desc && <span className="block text-[10px] text-slate-400 font-normal">{D.centros.totalGeneral ? (D.centros.totalesSub.desc / D.centros.totalGeneral * 100).toFixed(1) : 0}%</span>}
                  </td>
                  <td className="text-right px-2 text-slate-400">{CLPc(D.centros.totalesSub.resid)}</td>
                  <td className="text-right px-2">{CLP(D.centros.totalGeneral)}</td>
                  <td className="text-right px-2">100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Evolución en el tiempo */}
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-ink text-sm">Evolución de la mezcla</h4>
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs no-print">
              <button onClick={() => setCiVista('centro')} className={`px-2 py-1 ${ciVista === 'centro' ? 'bg-deep text-white' : 'text-slate-500'}`}>Por centro</button>
              <button onClick={() => setCiVista('subarea')} className={`px-2 py-1 ${ciVista === 'subarea' ? 'bg-deep text-white' : 'text-slate-500'}`}>Por naturaleza</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={D.centros.serie} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => CLPc(v)} width={54} />
              <Tooltip formatter={(v, n) => [CLP(v), n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {ciVista === 'centro'
                ? D.centros.nombres.map((n) => <Bar key={n} dataKey={n} stackId="ci" name={n} fill={CENTRO_COLOR[n] || C.muted} />)
                : [...SUBAREAS.filter((s) => cols.sub.find((x) => x.k === s.k)?.col).map((s) => (
                    <Bar key={s.k} dataKey={'s_' + s.k} stackId="ci" name={s.label} fill={s.color} />
                  )),
                  cols.desc.col ? <Bar key="desc" dataKey="s_desc" stackId="ci" name="Descuentos" fill={C.red} /> : null,
                  <Bar key="resid" dataKey="s_resid" stackId="ci" name="Sin desglosar" fill={RESIDUO_COLOR} />]}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-slate-400 mt-1">Se agrupa por día si el período cae dentro de un mismo mes, y por mes si lo cruza. "Sin desglosar" = total de la OT − (mano de obra + repuestos + lubricantes + servicios externos − descuentos). Debería ser cercano a cero; lo que queda son diferencias de redondeo de la planilla (cada columna neta se redondea por separado, ±1 peso por OT). Si aparece un monto relevante, hay conceptos en columnas que este análisis no está leyendo.</p>
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-ink mb-2">Ventas por tipo de servicio</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={D.porServicio} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => CLP(v)} />
              <Bar dataKey="value" fill={C.graphite} radius={[0, 3, 3, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-ink mb-2">NPS · Satisfacción</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={npsData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {npsData.map((d) => <Cell key={d.name} fill={d.c} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 text-xs">
            <span style={{ color: C.green }}>● {D.nps.prom} prom</span>
            <span style={{ color: C.amber }}>● {D.nps.pas} pas</span>
            <span style={{ color: C.red }}>● {D.nps.det} det</span>
            <span className="text-slate-500">NPS {(D.nps.nps >= 0 ? '+' : '') + D.nps.nps.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Técnicos comisión + DyP */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-ink mb-1">Mano de obra y comisión por técnico</h3>
          <p className="text-[11px] text-slate-400 mb-2">Comisión {Math.round(cfg.comision_pct * 100)}% sobre MO neta. La MO se divide entre principal y secundarios cuando existen.</p>
          <table className="w-full text-sm">
            <thead><tr className="text-slate-400 text-xs border-b"><th className="text-left py-1">Técnico</th><th className="text-right">OT</th><th className="text-right">MO neta</th><th className="text-right">Comisión</th></tr></thead>
            <tbody>
              {D.tecnicos.length ? D.tecnicos.map((x) => (
                <tr key={x.t} className="border-b last:border-0"><td className="py-1.5">{x.t}</td><td className="text-right">{x.ot}</td><td className="text-right">{CLP(x.mo)}</td><td className="text-right" style={{ color: C.green }}>{CLP(x.com)}</td></tr>
              )) : <tr><td colSpan={4} className="text-slate-400 py-3">Sin OTs de técnicos con comisión en este período.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-ink mb-1">Área DyP (Desabolladura y Pintura)</h3>
          <p className="text-[11px] text-slate-400 mb-2">OTs cuyo servicio pertenece al área DyP según la clasificación de la hoja. El desglose por técnico muestra quién ejecutó esos trabajos.</p>
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <div><div className="text-xs text-slate-400">OTs</div><div className="font-bold text-ink">{D.dyp.rows.length}</div></div>
            <div><div className="text-xs text-slate-400">Ventas</div><div className="font-bold text-ink text-sm">{CLP(D.dyp.ventas)}</div></div>
            <div><div className="text-xs text-slate-400">MO neta</div><div className="font-bold text-ink text-sm">{CLP(D.dyp.mo)}</div></div>
            <div><div className="text-xs text-slate-400">Ticket</div><div className="font-bold text-ink text-sm">{CLP(D.dyp.ticket)}</div></div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-slate-400 text-xs border-b"><th className="text-left py-1">Técnico</th><th className="text-right">OT</th><th className="text-right">Ventas</th><th className="text-right">MO neta</th></tr></thead>
            <tbody>
              {D.dyp.det.length ? D.dyp.det.map((x) => (
                <tr key={x.t} className="border-b last:border-0"><td className="py-1.5">{x.t}</td><td className="text-right">{x.ot}</td><td className="text-right">{CLP(x.v)}</td><td className="text-right">{CLP(x.mo)}</td></tr>
              )) : <tr><td colSpan={4} className="text-slate-400 py-3">Sin OTs del área DyP en este período.</td></tr>}
            </tbody>
          </table>
          <h4 className="font-semibold text-ink text-sm mt-4 mb-1">Desglose por servicio</h4>
          <table className="w-full text-sm">
            <thead><tr className="text-slate-400 text-xs border-b"><th className="text-left py-1">Servicio</th><th className="text-right">OT</th><th className="text-right">Ventas</th><th className="text-right">MO neta</th><th className="text-right">Ticket</th></tr></thead>
            <tbody>
              {D.dyp.servicios.length ? D.dyp.servicios.map((x) => (
                <tr key={x.s} className="border-b last:border-0">
                  <td className="py-1.5">{x.s}</td><td className="text-right">{x.ot}</td>
                  <td className="text-right">{CLP(x.v)}</td><td className="text-right">{CLP(x.mo)}</td>
                  <td className="text-right text-slate-500">{CLP(x.ticket)}</td>
                </tr>
              )) : <tr><td colSpan={5} className="text-slate-400 py-3">Sin servicios DyP en este período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
