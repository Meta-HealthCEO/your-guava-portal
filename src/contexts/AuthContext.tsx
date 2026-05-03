import { createContext, useEffect, useState, type ReactNode } from 'react'
import api from '@/lib/api'
import type { User } from '@/types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isOwner: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string, name: string, cafeName: string, orgName?: string) => Promise<void>
  switchCafe: (cafeId: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: validate session via /auth/me if token exists
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setIsLoading(false)
      return
    }

    api
      .get<User>('/auth/me')
      .then(({ data }) => {
        setUser(data)
      })
      .catch(() => {
        // Token invalid or expired — interceptor will try refresh.
        // If refresh also fails the interceptor redirects to /login.
        localStorage.removeItem('accessToken')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ accessToken: string; user: User }>('/auth/login', {
      email,
      password,
    })
    localStorage.setItem('accessToken', data.accessToken)
    setUser(data.user)
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      localStorage.removeItem('accessToken')
      setUser(null)
    }
  }

  const register = async (
    email: string,
    password: string,
    name: string,
    cafeName: string,
    orgName?: string
  ) => {
    const { data } = await api.post<{ accessToken: string; user: User }>('/auth/register', {
      email,
      password,
      name,
      cafeName,
      ...(orgName ? { orgName } : {}),
    })
    localStorage.setItem('accessToken', data.accessToken)
    setUser(data.user)
  }

  const switchCafe = async (cafeId: string) => {
    const { data } = await api.post<{ accessToken: string; activeCafeId: string }>(
      '/team/switch-cafe',
      { cafeId }
    )
    localStorage.setItem('accessToken', data.accessToken)
    // Reload the page so all data refetches for the new cafe
    window.location.reload()
  }

  const isOwner = user?.role === 'owner'

  return (
    <AuthContext.Provider value={{ user, isLoading, isOwner, login, logout, register, switchCafe }}>
      {children}
    </AuthContext.Provider>
  )
}
