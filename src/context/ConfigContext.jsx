import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { cargarCatalogos } from '../lib/helpers'

const ConfigContext = createContext(null)
export const useConfig = () => useContext(ConfigContext)

function hexCanales(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const MAPA_VAR = { deep: '--c-deep', red: '--c-red', sky: '--c-sky', ink: '--c-ink',
  steel: '--c-steel', mist: '--c-mist', paper: '--c-paper', carbon: '--c-carbon' }

export function aplicarColores(cols) {
  Object.entries(cols || {}).forEach(([k, hex]) => {
    const v = MAPA_VAR[k]; const ch = hexCanales(hex)
    if (v && ch) document.documentElement.style.setProperty(v, ch)
  })
}

const porClave = (rows, fn) => Object.fromEntries((rows || []).map((r) => [r.clave, fn(r)]))

export function ConfigProvider({ children }) {
  const { perfil } = useAuth()
  const [features, setFeatures] = useState(null)
  const [marca, setMarca] = useState({ nombre: null, loginTitulo: null })
  const [cargadoPara, setCargadoPara] = useState(null) // empresa_id ya cargada

  const cargar = useCallback(async () => {
    if (!perfil?.empresa_id) return
    const eid = perfil.empresa_id
    try {
      const [feats, brand, seg, tsrv, eges, tag] = await Promise.all([
        supabase.rpc('features_empresa'),
        supabase.from('empresa_branding').select('*').eq('empresa_id', eid).maybeSingle(),
        supabase.from('cat_segmentos').select('*').eq('empresa_id', eid).order('orden'),
        supabase.from('cat_tipos_servicio').select('*').eq('empresa_id', eid).order('orden'),
        supabase.from('cat_estados_gestion').select('*').eq('empresa_id', eid).order('orden'),
        supabase.from('cat_tipos_agenda').select('*').eq('empresa_id', eid).order('orden')
      ])
      cargarCatalogos({
        segmentos:      porClave(seg.data,  (r) => ({ label: r.nombre, color: r.color })),
        tiposServicio:  porClave(tsrv.data, (r) => r.nombre),
        estadosGestion: porClave(eges.data, (r) => ({ label: r.nombre, color: r.color, cierre: r.es_cierre })),
        tiposAgenda:    porClave(tag.data,  (r) => ({ label: r.nombre, color: r.color }))
      })
      if (Array.isArray(feats.data)) setFeatures(new Set(feats.data))
      if (brand.data) {
        setMarca({ nombre: brand.data.nombre_comercial, loginTitulo: brand.data.login_titulo })
        aplicarColores(brand.data.colores || {})
      }
    } catch { /* mantiene defaults */ }
    setCargadoPara(eid)
  }, [perfil?.empresa_id])

  useEffect(() => { cargar() }, [cargar])

  const tieneFeature = (clave) => features === null || features.has(clave)

  // Gesta solo en la primera carga del tenant (no al recargar tras editar)
  if (perfil?.empresa_id && cargadoPara !== perfil.empresa_id) {
    return <div className="h-full grid place-items-center text-slate-400 text-sm">Cargando…</div>
  }

  return (
    <ConfigContext.Provider value={{ features, tieneFeature, ...marca, recargar: cargar }}>
      {children}
    </ConfigContext.Provider>
  )
}
