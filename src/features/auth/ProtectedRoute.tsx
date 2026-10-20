import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  adminOnly?: boolean
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { session, profile, isLoading, signOut } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <main className="auth-shell" aria-busy="true">
        <p role="status" className="ui-feedback">Cargando sesión…</p>
      </main>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!profile || profile.is_active !== true) {
    return <main className="auth-shell"><div className="auth-panel">
      <h1>Acceso no disponible</h1>
      <p role="alert" className="ui-feedback ui-feedback--error">{profile?.is_active === false ? 'Tu cuenta está desactivada. Contacta con un administrador.' : 'No se pudo verificar tu perfil. Recarga la página o contacta con un administrador.'}</p>
      <button className="ui-button" onClick={() => signOut()}>Cerrar sesión</button>
    </div></main>
  }
  if (adminOnly && profile.role !== 'admin') return <Navigate to="/board" replace />

  return <>{children}</>
}
