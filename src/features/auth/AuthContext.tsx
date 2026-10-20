import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { type Session, type User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { type Profile } from '@/types'
import { useQueryClient } from '@tanstack/react-query'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const currentUserId = useRef<string | null>(null)
  const profileRequest = useRef(0)
  const invalidateProfile = useCallback(() => { ++profileRequest.current }, [])

  const fetchProfile = useCallback(async (userId: string) => {
    const request = ++profileRequest.current
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (currentUserId.current !== userId || request !== profileRequest.current) return

    if (error) {
      console.error('Error fetching profile:', error)
      setProfile(null)
      queryClient.clear()
    } else {
      setProfile(data as Profile)
      if (data.is_active !== true) queryClient.clear()
    }
    setIsLoading(false)
  }, [queryClient])

  useEffect(() => {
    let disposed = false
    let authEventReceived = false
    const applySession = (next: Session | null) => {
      if (disposed) return
      const id = next?.user.id ?? null
      if (currentUserId.current !== id) {
        queryClient.clear()
        setProfile(null)
        setIsLoading(Boolean(id))
      }
      currentUserId.current = id
      setSession(next)
      setUser(next?.user ?? null)
      if (id) void fetchProfile(id)
      else {
        setProfile(null)
        setIsLoading(false)
      }
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!authEventReceived) applySession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession: Session | null) => {
      authEventReceived = true
      applySession(newSession)
    })

    return () => {
      disposed = true
      invalidateProfile()
      subscription.unsubscribe()
    }
  }, [fetchProfile, queryClient, invalidateProfile])

  useEffect(() => {
    if (!user) return
    const refresh = () => { void fetchProfile(user.id) }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [user, fetchProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
