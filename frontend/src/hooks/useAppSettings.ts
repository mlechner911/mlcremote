import React from 'react'
import { useTranslation } from 'react-i18next'
import { useGetApiSettings, getGetApiSettingsUrl } from '../api/generated'
import { Settings } from '../api/generated.schemas'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customInstance } from '../api/axios_custom'

export function useAppSettings() {
    const { i18n } = useTranslation()
    const queryClient = useQueryClient()

    // React Query Hooks
    // GET /api/settings
    const { data: settingsResponse, isLoading, isError } = useGetApiSettings({
        query: {
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60 * 5, // 5 minutes
        }
    })

    // POST /api/settings
    // Manual mutation because Orval generation seems to skip this endpoint for some reason
    const updateSettingsMutation = useMutation({
        mutationFn: async (data: Partial<Settings>) => {
            return customInstance<{ data: Settings, status: number }>(
                getGetApiSettingsUrl(),
                {
                    method: 'POST',
                    data // changed from body to data for axios
                }
            )
        },
        onSuccess: (res) => {
            const newData = res.data
            // Update cache
            queryClient.setQueryData(['/api/settings'], (old: any) => {
                if (!old) return { data: newData, status: 200 }
                return { ...old, data: { ...old.data, ...newData } }
            })
        }
    })


    const settings = settingsResponse?.data || null
    const loadedSettings = !isLoading && !isError

    const [themeMode, setThemeMode] = React.useState<'dark' | 'light' | 'auto'>('auto')
    const [theme, setThemeState] = React.useState<'dark' | 'light'>('dark')

    // Initialize from localStorage or fallback
    React.useEffect(() => {
        const savedMode = localStorage.getItem('mlc_theme_mode') as 'dark' | 'light' | 'auto' | null
        if (savedMode) {
            setThemeMode(savedMode)
        } else if (settings?.theme) {
            // Fallback to backend setting if no local override
            setThemeMode(settings.theme as any)
        }
    }, [settings]) // Only run when settings first load if no local storage

    // Resolve theme from mode
    React.useEffect(() => {
        const resolveTheme = () => {
            if (themeMode === 'auto') {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
            }
            return themeMode
        }

        const t = resolveTheme()
        setThemeState(t)

        // If auto, listen for system changes
        if (themeMode === 'auto') {
            const media = window.matchMedia('(prefers-color-scheme: dark)')
            const listener = (e: MediaQueryListEvent) => {
                setThemeState(e.matches ? 'dark' : 'light')
            }
            media.addEventListener('change', listener)
            return () => media.removeEventListener('change', listener)
        }
    }, [themeMode])

    // Helper wrapper for mutation
    const saveSettings = (s: Partial<Settings>) => {
        updateSettingsMutation.mutate(s)
    }

    // Derived values with fallbacks
    const autoOpen = settings?.autoOpen ?? true
    const showHidden = settings?.showHiddenFiles ?? false
    const hideMemoryUsage = settings?.hideMemoryUsage ?? false

    const setAutoOpen = (v: boolean) => saveSettings({ autoOpen: v })
    const setShowHidden = (v: boolean) => saveSettings({ showHiddenFiles: v })
    const toggleHideMemoryUsage = (v: boolean) => saveSettings({ hideMemoryUsage: v })

    const updateMaxEditorSize = (sz: number) => {
        saveSettings({ maxEditorSize: sz })
        localStorage.setItem('mlc_max_editor_size', sz.toString())
    }

    const setUiMode = (m: 'classic' | 'modern') => saveSettings({ uiMode: m })

    // Updated setTheme to handle Auto mode
    const setTheme = (t: 'dark' | 'light' | 'auto') => {
        setThemeMode(t)
        localStorage.setItem('mlc_theme_mode', t)

        // Best effort sync with backend: if auto, we don't know for sure, so maybe don't sync? 
        // Or sync the resolved value? Let's sync the resolved value if explicit, or just skip if auto?
        // User asked for frontend override effectively.
        if (t !== 'auto') {
            saveSettings({ theme: t })
        }
    }

    // URL Param Syncing Logic
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const urlTheme = params.get('theme')

        if (urlTheme === 'light' || urlTheme === 'dark' || urlTheme === 'auto') {
            setThemeMode(urlTheme as any)
        }

        const urlLang = params.get('lng') || params.get('lang')
        if (urlLang && urlLang !== settings?.language) {
            saveSettings({ language: urlLang })
            if (i18n.language !== urlLang) i18n.changeLanguage(urlLang)
        } else if (settings?.language && i18n.language !== settings.language) {
            i18n.changeLanguage(settings.language)
        }
    }, [settings, i18n]) // Keep settings dep for language sync

    // Theme effect - Single source of truth for DOM class
    React.useEffect(() => {
        if (theme === 'light') document.documentElement.classList.add('theme-light')
        else document.documentElement.classList.remove('theme-light')
    }, [theme])


    return {
        settings: settings || undefined,
        loadedSettings,
        theme, setTheme, themeMode,
        autoOpen, setAutoOpen,
        showHidden, setShowHidden,
        hideMemoryUsage, toggleHideMemoryUsage,
        maxEditorSize: settings?.maxEditorSize || 0,
        updateMaxEditorSize,
        canChangeRoot: !!settings?.allowDelete,
        uiMode: settings?.uiMode || 'classic',
        setUiMode,
        updateSettings: saveSettings,
        i18n
    }
}
