import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setIsLoading(false)
      return
    }

    navigate('/board')
  }

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-mark">
          <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <div className="auth-heading">
          <h1>Alta de usuario</h1>
          <p>Solo administradores pueden crear cuentas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
          {error && (
            <div className="ui-feedback ui-feedback--error" role="alert">
              <p><strong>No se pudo crear la cuenta.</strong> {error}</p>
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="ui-label">
              Nombre completo
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="ui-field"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label htmlFor="email" className="ui-label">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
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
              autoComplete="new-password"
              aria-describedby="password-hint"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="ui-field"
              placeholder="••••••••"
            />
            <p id="password-hint" className="mt-2 text-xs text-[var(--color-text-muted)]">Usa al menos 6 caracteres.</p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="ui-button ui-button--primary w-full"
          >
            <span role="status">{isLoading ? 'Creando cuenta…' : 'Crear cuenta'}</span>
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/board" className="ui-link inline-flex items-center gap-2">
            <svg aria-hidden="true" className="ui-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m12 5-7 7 7 7M5 12h14" />
            </svg>
            Volver al tablero
          </Link>
        </div>
      </div>
    </main>
  )
}
