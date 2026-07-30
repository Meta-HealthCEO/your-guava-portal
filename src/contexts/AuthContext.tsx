import { createContext, useEffect, useState, type ReactNode } from 'react'
import api from '@/lib/api'
import { clearInsightChatStorage } from '@/lib/chatStorage'
import { clearAccessToken, setAccessToken } from '@/lib/accessToken'
import type { User } from '@/types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isOwner: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (
    email: string,
    password: string,
    name: string,
    cafeName: string,
    orgName?: string
  ) => Promise<{ email: string; message: string }>
  switchCafe: (cafeId: string) => Promise<void>
  updateCurrentUser?: (user: User) => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // /auth/me bootstraps through the HttpOnly refresh cookie when a page load
  // has no in-memory access token.
  useEffect(() => {
    let active = true
    const restoreSession = async () => {
      try {
        const response = await api.get<User>('/auth/me')
        if (active && response?.data) setUser(response.data)
      } catch {
        clearAccessToken()
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void restoreSession()
    return () => {
      active = false
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ accessToken: string; user: User }>('/auth/login', {
      email,
      password,
    })
    clearInsightChatStorage()
    setAccessToken(data.accessToken)
    setUser(data.user)
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      clearAccessToken()
      clearInsightChatStorage()
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
    const { data } = await api.post<{
      verificationRequired: boolean
      email: string
      message: string
    }>('/auth/register', {
      email,
      password,
      name,
      cafeName,
      ...(orgName ? { orgName } : {}),
    })
    clearInsightChatStorage()
    clearAccessToken()
    setUser(null)
    return { email: data.email, message: data.message }
  }

  const switchCafe = async (cafeId: string) => {
    const { data } = await api.post<{ accessToken: string; activeCafeId: string }>(
      '/team/switch-cafe',
      { cafeId }
    )
    setAccessToken(data.accessToken)
    window.location.reload()
  }

  const isOwner = user?.role === 'owner'
  const updateCurrentUser = (nextUser: User) => setUser(nextUser)

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isOwner, login, logout, register, switchCafe, updateCurrentUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}
