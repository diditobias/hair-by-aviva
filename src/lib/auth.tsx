import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, UserRole } from './types'

interface SignUpInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isStaff: boolean
  role: UserRole | null
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (input: SignUpInput) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('profile fetch', error.message)
    return null
  }
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) {
      setProfile(null)
      return
    }
    setProfile(await fetchProfile(userId))
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        setProfile(await fetchProfile(data.session.user.id))
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const userId = next?.user?.id ?? null
      setSession(next)
      if (!userId) {
        setProfile(null)
        setLoading(false)
        return
      }
      setProfile((current) => (current?.id === userId ? current : null))
      window.setTimeout(() => {
        void fetchProfile(userId).then((loaded) => {
          if (!mounted) return
          setProfile((current) => {
            if (loaded?.id === userId) return loaded
            return current?.id === userId ? current : null
          })
          setLoading(false)
        })
      }, 0)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (data.user) {
      const nextProfile = await fetchProfile(data.user.id)
      setProfile(nextProfile)
      setSession(data.session)
    }
    return { error: null }
  }, [])

  const signUp = useCallback(async ({ email, password, firstName, lastName, phone }: SignUpInput) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          role: 'client',
        },
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    return { error: error?.message ?? null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error?.message ?? null }
  }, [])

  const role =
    profile && session?.user?.id === profile.id ? profile.role : null
  const isStaff = role === 'owner' || role === 'admin'

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isStaff,
      role,
      refreshProfile,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [
      session,
      profile,
      loading,
      isStaff,
      role,
      refreshProfile,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
