import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/login" element={<div>Login coming soon</div>} />
          <Route path="/register" element={<div>Register coming soon</div>} />
          <Route path="/board" element={<div>Board coming soon</div>} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}

export default App
