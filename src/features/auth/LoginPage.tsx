import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      navigate('/boards')
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-mark">
          <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <div className="auth-heading">
          <h1>Bienvenido a Furthurr</h1>
          <p>Inicia sesión para seleccionar un tablero</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
          {error && (
            <div className="ui-feedback ui-feedback--error" role="alert">
              <p><strong>No se pudo iniciar sesión.</strong> {error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="ui-label">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="ui-field"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="ui-label">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="ui-field"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="ui-button ui-button--primary w-full"
          >
            {isLoading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
          <span role="status" className="sr-only">{isLoading ? 'Iniciando sesión…' : ''}</span>
        </form>

        <div className="auth-footer">
          <p>¿No tienes cuenta? Contacta a tu administrador.</p>
        </div>
      </div>
    </main>
  )
}
