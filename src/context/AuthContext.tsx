import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, getCachedUser, setCachedUser, setToken, getToken } from '../lib/api'
import type { User } from '../lib/types'
import { can } from '../lib/perms'

interface AuthState {
  user: User | null
  token: string | null
  booting: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  can: (p: string) => boolean
}

const AuthCtx = createContext<AuthState>(null as unknown as AuthState)

export function useAuth() {
  return useContext(AuthCtx)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setTok] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const t = getToken()
    setTok(t)
    const cached = getCachedUser<User>()
    if (!t) {
      setBooting(false)
      return
    }
    if (cached) setUser(cached)
    const bootTimer = setTimeout(() => setBooting(false), 120)
    api<User>('/api/auth/me', { useCache: false })
      .then((u) => {
        setUser(u)
        setCachedUser(u)
      })
      .catch(() => {
        // token may be stale; keep cached user for offline, but let pages decide
      })
      .finally(() => {
        clearTimeout(bootTimer)
        // double-gate bool
        setBooting(false)
      })
    return () => clearTimeout(bootTimer)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      booting,
      can: (p: string) => can(user?.role, p),
      logout: () => {
        setToken(null)
        setCachedUser(null)
        setUser(null)
        setTok(null)
      },
      login: async (email, password) => {
        const res = await api<{ token: string; user: User }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        setToken(res.token)
        setCachedUser(res.user)
        setUser(res.user)
        setTok(res.token)
        return res.user
      },
    }),
    [user, token, booting],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}