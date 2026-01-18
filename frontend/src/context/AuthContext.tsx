import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Health } from '../api' // Keep types from legacy api or generated schemas? generated schemas are better but Health is in index.ts manually defined. 
// Actually generated schemas has HealthInfo. Let's check generated.schemas.ts if needed, but for now stick to manual type or usage.
// generated.ts uses HealthInfo. 
import { useGetHealth, useGetApiAuthCheck, usePostApiLogin } from '../api/generated'
import { HealthInfo } from '../api/generated.schemas'

/**
 * Defines the shape of the authentication context.
 * Includes current health/connection status, login methods, and UI state controls.
 */
interface AuthContextType {
    /** Current server health status (version, auth mode, etc.) */
    health: HealthInfo | null
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
    // We use React Query for health and auth check
    // Polling interval 60s matching original logic
    const healthQuery = useGetHealth({
        query: {
            refetchInterval: 60000,
            retry: false
        }
    })

    // Auth check should also be polled or just checked when health changes? 
    // Original logic: refreshHealth calls getHealth THEN authCheck.
    // Let's run authCheck in parallel but perhaps dependent on health success?
    // Actually, independent is fine.
    const authCheckQuery = useGetApiAuthCheck({
        query: {
            refetchInterval: 60000,
            retry: false,
            // Only runs if we likely have a token? Or always?
            // If strict 401/403 handling is needed.
            enabled: true
        }
    })

    const loginMutation = usePostApiLogin()

    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

    // Auth UI states
    const [showLogin, setShowLogin] = useState(false)
    const [showTokenInput, setShowTokenInput] = useState(false)
    const [showAuthChooser, setShowAuthChooser] = useState(false)

    // Sync health data to local convenient state if strictly needed, 
    // but we can just derive it.
    const health = healthQuery.data?.data || null
    const lastHealthAt = healthQuery.dataUpdatedAt

    // Handle Auth URL Logic (Once on mount)
    React.useState(() => {
        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        const urlToken = params.get('token')
        if (urlToken) {
            localStorage.setItem('mlcremote_token', urlToken)
            const newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname
            window.history.replaceState({ path: newUrl }, '', newUrl)
        }
    })

    // Online/Offline listeners
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            healthQuery.refetch()
            authCheckQuery.refetch()
        }
        const handleOffline = () => {
            setIsOnline(false)
        }
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [healthQuery, authCheckQuery])


    // Effect to handle Auth Check failures (401)
    useEffect(() => {
        if (authCheckQuery.isError) {
            // authCheck failed. 
            // Original logic: localStorage.removeItem('mlcremote_token'); check health.password_auth etc.
            // We can use the cached health data or current health data.

            // Check if it's actually 401? The hook doesn't give status easily unless we type the error.
            // Assuming any error on authCheck means invalid token.
            localStorage.removeItem('mlcremote_token')

            if (health) {
                if (health.password_auth) setShowLogin(true)
                else if (health.auth_required) setShowTokenInput(true)
            }
        }
    }, [authCheckQuery.isError, health])

    // Auth chooser logic
    useEffect(() => {
        if (!health) { setShowAuthChooser(false); return }
        const needsPassword = !!health.password_auth
        const needsTokenOnly = !!health.auth_required && !health.password_auth
        const token = localStorage.getItem('mlcremote_token')

        // If we need auth, but have no token, show chooser
        if ((needsPassword || needsTokenOnly) && !token) {
            // But wait, if we just showed login/token input?
            setShowAuthChooser(true)
        } else {
            // We have a token or don't need one.
            // BUT if the token is invalid (authCheck failed), we might have cleared it.
            // If we cleared it, this effect runs again and shows chooser.
            // Unless showLogin/showTokenInput are already true?
            // Original logic just sets showAuthChooser(true) if !token.
            // But existing setShowLogin(true) might hide chooser?
            // In App.tsx or AuthOverlay, logic usually handles priority.
            setShowAuthChooser(false)
        }
    }, [health]) // missing dependencies: showLogin? No, just health logic.

    const refreshHealth = useCallback(async () => {
        await Promise.all([healthQuery.refetch(), authCheckQuery.refetch()])
    }, [healthQuery, authCheckQuery])

    const login = async (password: string) => {
        try {
            const res = await loginMutation.mutateAsync({ data: { password } })
            if (res.status === 200 && res.data.token) {
                localStorage.setItem('mlcremote_token', res.data.token)
                await refreshHealth()
                setShowLogin(false)
                setShowAuthChooser(false)
            }
        } catch (e) {
            console.error("Login failed", e)
            throw e
        }
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
