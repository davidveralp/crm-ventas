import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, soloAdmin = false }) {
  const { session, perfil, cargando, esAdmin } = useAuth()
  if (cargando) {
    return (
      <div className="h-full grid place-items-center text-slate-400 text-sm">
        Cargando…
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (soloAdmin && !esAdmin) return <Navigate to="/" replace />
  if (!perfil) {
    return (
      <div className="h-full grid place-items-center text-center p-6">
        <div>
          <p className="text-slate-700 font-medium">Tu cuenta aún no tiene perfil asignado.</p>
          <p className="text-slate-500 text-sm mt-1">
            Pide al administrador que ejecute el script de vinculación de usuarios.
          </p>
        </div>
      </div>
    )
  }
  return children
}
