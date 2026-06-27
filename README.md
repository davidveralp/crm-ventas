import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil]   = useState(null)
  const [cargando, setCargando] = useState(true)

  async function cargarPerfil(userId) {
    if (!userId) { setPerfil(null); return }
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single()
    setPerfil(data || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await cargarPerfil(data.session?.user?.id)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      await cargarPerfil(s?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = {
    session,
    perfil,
    cargando,
    esAdmin: perfil?.rol === 'admin',
    async login(email, password) {
      return supabase.auth.signInWithPassword({ email, password })
    },
    async logout() {
      await supabase.auth.signOut()
      setPerfil(null)
    }
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
