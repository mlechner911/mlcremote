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
            return customInstance<{ data: Settings, status: number }>({
                url: getGetApiSettingsUrl(),
                method: 'POST',
                data // changed from body to data for axios
            })
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

    const [theme, setThemeState] = React.useState<'dark' | 'light'>('dark')

    React.useEffect(() => {
        if (settings) {
            if (settings.theme) setThemeState(settings.theme as any)
        }
    }, [settings])

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
    const setTheme = (t: 'dark' | 'light') => {
        setThemeState(t)
        saveSettings({ theme: t })
    }

    // URL Param Syncing Logic (Ported from old hook)
    React.useEffect(() => {
        if (!settings) return

        const params = new URLSearchParams(window.location.search)
        const urlTheme = params.get('theme')
        if (urlTheme === 'light' || urlTheme === 'dark') {
            setThemeState(urlTheme as any)
            if (urlTheme === 'light') document.documentElement.classList.add('theme-light')
            else document.documentElement.classList.remove('theme-light')
        } else {
            // Apply loaded theme
            if (settings.theme === 'light') document.documentElement.classList.add('theme-light')
            else document.documentElement.classList.remove('theme-light')
        }

        const urlLang = params.get('lng') || params.get('lang')
        if (urlLang && urlLang !== settings.language) {
            saveSettings({ language: urlLang })
            if (i18n.language !== urlLang) i18n.changeLanguage(urlLang)
        } else if (settings.language && i18n.language !== settings.language) {
            i18n.changeLanguage(settings.language)
        }
    }, [settings, i18n])


    // Theme effect
    React.useEffect(() => {
        if (theme === 'light') document.documentElement.classList.add('theme-light')
        else document.documentElement.classList.remove('theme-light')
    }, [theme])


    return {
        settings: settings || undefined,
        loadedSettings,
        theme, setTheme,
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
