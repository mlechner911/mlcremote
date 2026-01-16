import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getHealth, authCheck, Health, login as apiLogin } from '../api'

/**
 * Defines the shape of the authentication context.
 * Includes current health/connection status, login methods, and UI state controls.
 */
interface AuthContextType {
    /** Current server health status (version, auth mode, etc.) */
    health: Health | null
    /** Whether the browser has network connectivity */
    isOnline: boolean
    /** Timestamp of the last successful health check */
    lastHealthAt: number | null
    /** Manually triggers a health check */
    refreshHealth: () => Promise<void>
    /** perform login with password */
    login: (password: string) => Promise<void>
    /** Manually set a token (e.g. from URL or input) */
    setToken: (token: string) => void
    /** clear token and state */
    logout: () => void

    // Auth UI states
    /** Controls visibility of the password login modal */
    showLogin: boolean
    setShowLogin: (v: boolean) => void
    /** Controls visibility of the token input modal */
    showTokenInput: boolean
    setShowTokenInput: (v: boolean) => void
    /** Controls visibility of the initial auth method chooser */
    showAuthChooser: boolean
    setShowAuthChooser: (v: boolean) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Global provider for authentication state and server health monitoring.
 * handles polling, online/offline events, and token management.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [health, setHealth] = useState<Health | null>(null)
    const [lastHealthAt, setLastHealthAt] = useState<number | null>(null)
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

    // Auth UI states
    const [showLogin, setShowLogin] = useState(false)
    const [showTokenInput, setShowTokenInput] = useState(false) // renamed from showTokenPrompt/showLoginInput mix
    const [showAuthChooser, setShowAuthChooser] = useState(false)

    // Run this logic once on mount, synchronously, before children render.
    // This ensures localStorage is populated with the URL token (if any)
    // before any child components (like FileExplorer) attempt to fetch data.
    React.useState(() => {
        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        const urlToken = params.get('token')
        if (urlToken) {

            localStorage.setItem('mlcremote_token', urlToken)
            // Remove token from URL for cleaner history
            const newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname
            window.history.replaceState({ path: newUrl }, '', newUrl)
        }
    })

    const refreshHealth = useCallback(async () => {
        if (!navigator.onLine) return
        try {
            const h = await getHealth()
            setHealth(h)
            setLastHealthAt(Date.now())
            const ok = await authCheck()
            if (!ok) {
                // Only remove token if auth check fails AND we didn't just set it from URL?
                // Actually authCheck failing means the token is invalid.
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

/**
 * Hook to access the auth context. Must be used within an AuthProvider.
 */
export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
