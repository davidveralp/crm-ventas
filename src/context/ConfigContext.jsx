import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ConfigContext = createContext(null)
export const useConfig = () => useContext(ConfigContext)

// '#1C4357' -> '28 67 87' (canales para rgb(var() / alpha))
function hexCanales(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const MAPA_VAR = { deep: '--c-deep', red: '--c-red', sky: '--c-sky', ink: '--c-ink',
  steel: '--c-steel', mist: '--c-mist', paper: '--c-paper', carbon: '--c-carbon' }

export function ConfigProvider({ children }) {
  const { perfil } = useAuth()
  const [features, setFeatures] = useState(null) // null = aún cargando -> mostrar todo
  const [marca, setMarca] = useState({ nombre: null, loginTitulo: null })

  useEffect(() => {
    if (!perfil?.empresa_id) return
    let vivo = true
    ;(async () => {
      const [{ data: feats }, { data: brand }] = await Promise.all([
        supabase.rpc('features_empresa'),
        supabase.from('empresa_branding').select('*').eq('empresa_id', perfil.empresa_id).maybeSingle()
      ])
      if (!vivo) return
      // Features (si la RPC no existe todavía, deja null = todo visible)
      if (Array.isArray(feats)) setFeatures(new Set(feats))
      // Branding: nombre + colores en runtime
      if (brand) {
        setMarca({ nombre: brand.nombre_comercial, loginTitulo: brand.login_titulo })
        const cols = brand.colores || {}
        Object.entries(cols).forEach(([k, hex]) => {
          const v = MAPA_VAR[k]; const ch = hexCanales(hex)
          if (v && ch) document.documentElement.style.setProperty(v, ch)
        })
      }
    })().catch(() => {})
    return () => { vivo = false }
  }, [perfil?.empresa_id])

  const tieneFeature = (clave) => features === null || features.has(clave)

  return (
    <ConfigContext.Provider value={{ features, tieneFeature, ...marca }}>
      {children}
    </ConfigContext.Provider>
  )
}
