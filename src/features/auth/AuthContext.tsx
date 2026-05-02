import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { type Session, type User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { type Profile } from '@/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      setProfile(null)
    } else {
      setProfile(data as Profile)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const currentSession = data.session
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (!currentSession?.user) {
        setProfile(null)
        setIsLoading(false)
      } else {
        fetchProfile(currentSession.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession: Session | null) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (!newSession?.user) {
        setProfile(null)
        setIsLoading(false)
      } else {
        fetchProfile(newSession.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, signOut }}>
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