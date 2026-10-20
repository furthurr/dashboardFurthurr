import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthContext'
import { LoginPage } from '@/features/auth/LoginPage'
import { UsersPage } from '@/features/users/UsersPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { BoardPage } from '@/features/board/BoardPage'
import { ProfilePage } from '@/features/auth/ProfilePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/board" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<Navigate to="/users" replace />} />
            <Route path="/users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/board"
              element={
                <ProtectedRoute>
                  <BoardPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

function AuthCallback() {
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token=')) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  return <Navigate to="/board" replace />
}

export default App
