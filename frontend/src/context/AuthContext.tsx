import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getHealth, authCheck, Health, login as apiLogin } from '../api'

interface AuthContextType {
    health: Health | null
    isOnline: boolean
    lastHealthAt: number | null
    refreshHealth: () => Promise<void>
    login: (password: string) => Promise<void>
    setToken: (token: string) => void
    logout: () => void
    // Auth UI states
    showLogin: boolean
    setShowLogin: (v: boolean) => void
    showTokenInput: boolean
    setShowTokenInput: (v: boolean) => void
    showAuthChooser: boolean
    setShowAuthChooser: (v: boolean) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [health, setHealth] = useState<Health | null>(null)
    const [lastHealthAt, setLastHealthAt] = useState<number | null>(null)
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

    // Auth UI states
    const [showLogin, setShowLogin] = useState(false)
    const [showTokenInput, setShowTokenInput] = useState(false) // renamed from showTokenPrompt/showLoginInput mix
    const [showAuthChooser, setShowAuthChooser] = useState(false)

    const refreshHealth = useCallback(async () => {
        if (!navigator.onLine) return
        try {
            const h = await getHealth()
            setHealth(h)
            setLastHealthAt(Date.now())
            const ok = await authCheck()
            if (!ok) {
                localStorage.removeItem('mlcremote_token')
                if (h.password_auth) setShowLogin(true)
                else if (h.auth_required) setShowTokenInput(true)
            }
        } catch {
            setHealth(null)
        }
    }, [])

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            refreshHealth()
        }
        const handleOffline = () => {
            setIsOnline(false)
            setHealth(null)
        }
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // Polling
        const id = setInterval(refreshHealth, 60 * 1000)
        refreshHealth() // Initial fetch

        // Global auth failure listener
        const authFailHandler = () => setShowAuthChooser(true)
        window.addEventListener('mlcremote:auth-failed', authFailHandler)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            window.removeEventListener('mlcremote:auth-failed', authFailHandler)
            clearInterval(id)
        }
    }, [refreshHealth])

    // Auth chooser logic
    useEffect(() => {
        if (!health) { setShowAuthChooser(false); return }
        const needsPassword = !!health.password_auth
        const needsTokenOnly = !!health.auth_required && !health.password_auth
        const token = localStorage.getItem('mlcremote_token')
        if ((needsPassword || needsTokenOnly) && !token) setShowAuthChooser(true)
        else setShowAuthChooser(false)
    }, [health])

    const login = async (password: string) => {
        await apiLogin(password)
        await refreshHealth()
        setShowLogin(false)
        setShowAuthChooser(false)
    }

    const setToken = (token: string) => {
        localStorage.setItem('mlcremote_token', token)
        refreshHealth()
        setShowTokenInput(false)
        setShowAuthChooser(false)
    }

    const logout = () => {
        localStorage.removeItem('mlcremote_token')
        refreshHealth()
    }

    return (
        <AuthContext.Provider value={{
            health, isOnline, lastHealthAt, refreshHealth,
            login, setToken, logout,
            showLogin, setShowLogin,
            showTokenInput, setShowTokenInput,
            showAuthChooser, setShowAuthChooser
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
