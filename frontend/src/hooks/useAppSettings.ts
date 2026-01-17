import React from 'react'
import { useTranslation } from 'react-i18next'
import { getSettings, saveSettings, type Settings } from '../api'
import { defaultStore, strSerializer } from '../utils/storage'

export function useAppSettings() {
    const { i18n } = useTranslation()
    const [settings, setSettings] = React.useState<Settings | null>(null)
    const [loadedSettings, setLoadedSettings] = React.useState(false)

    // Individual settings state
    const [theme, setTheme] = React.useState<'dark' | 'light'>('dark')
    const [autoOpen, setAutoOpenState] = React.useState<boolean>(true)
    const [showHidden, setShowHiddenState] = React.useState<boolean>(false)
    const [showLogs, setShowLogs] = React.useState<boolean>(false)
    const [showServerLogs, setShowServerLogs] = React.useState<boolean>(false)
    const [hideMemoryUsage, setHideMemoryUsage] = React.useState<boolean>(false)
    const [maxEditorSize, setMaxEditorSize] = React.useState<number>(0)
    const [canChangeRoot, setCanChangeRoot] = React.useState<boolean>(false)
    const [uiMode, setUiModeState] = React.useState<'classic' | 'modern'>('classic')

    // Setters that also persist
    const setAutoOpen = (v: boolean) => { setAutoOpenState(v); saveSettings({ autoOpen: v }).catch(console.error) }
    const setShowHidden = (v: boolean) => { setShowHiddenState(v); saveSettings({ showHiddenFiles: v }).catch(console.error) }
    const toggleLogs = (v: boolean) => { setShowLogs(v); saveSettings({ showLogs: v }).catch(console.error) }
    const toggleServerLogs = (v: boolean) => { setShowServerLogs(v); saveSettings({ showServerLogs: v }).catch(console.error) }
    const toggleHideMemoryUsage = (v: boolean) => { setHideMemoryUsage(v); saveSettings({ hideMemoryUsage: v }).catch(console.error) }
    const updateMaxEditorSize = (sz: number) => {
        setMaxEditorSize(sz)
        saveSettings({ maxEditorSize: sz }).catch(console.error)
        localStorage.setItem('mlc_max_editor_size', sz.toString()) // Keep local legacy support if needed
    }
    const setUiMode = (m: 'classic' | 'modern') => { setUiModeState(m); saveSettings({ uiMode: m }).catch(console.error) }

    // Load settings on mount
    React.useEffect(() => {
        getSettings()
            .then(s => {
                setSettings(s)
                if (typeof s.allowDelete !== 'undefined') setCanChangeRoot(!!s.allowDelete)

                // Apply user prefs
                if (s.theme) setTheme(s.theme as any)
                if (typeof s.autoOpen !== 'undefined') setAutoOpenState(s.autoOpen)
                if (typeof s.showHiddenFiles !== 'undefined') setShowHiddenState(s.showHiddenFiles)
                if (typeof s.showLogs !== 'undefined') setShowLogs(s.showLogs)
                if (typeof s.showServerLogs !== 'undefined') setShowServerLogs(s.showServerLogs)
                if (s.hideMemoryUsage) setHideMemoryUsage(s.hideMemoryUsage)
                if (s.maxEditorSize) {
                    setMaxEditorSize(s.maxEditorSize)
                    localStorage.setItem('mlc_max_editor_size', s.maxEditorSize.toString())
                }
                // Persist uiMode
                if (s.uiMode) setUiModeState(s.uiMode as any)

                // URL Param Syncing
                const params = new URLSearchParams(window.location.search)
                const urlTheme = params.get('theme')
                if (urlTheme === 'light' || urlTheme === 'dark') {
                    setTheme(urlTheme as any)
                    if (urlTheme === 'light') document.documentElement.classList.add('theme-light')
                    else document.documentElement.classList.remove('theme-light')
                } else {
                    // Apply loaded theme
                    if (s.theme === 'light') document.documentElement.classList.add('theme-light')
                    else document.documentElement.classList.remove('theme-light')
                }

                const urlLang = params.get('lng') || params.get('lang')
                if (urlLang && urlLang !== s.language) {

                    saveSettings({ language: urlLang }).catch(console.error)
                    if (i18n.language !== urlLang) i18n.changeLanguage(urlLang)
                } else if (s.language && i18n.language !== s.language) {
                    i18n.changeLanguage(s.language)
                }
                setLoadedSettings(true)
            })
            .catch(() => {
                setSettings({ allowDelete: false, defaultShell: 'bash' })
                setLoadedSettings(true)
            })
    }, [])

    // Theme effect
    React.useEffect(() => {
        if (theme === 'light') document.documentElement.classList.add('theme-light')
        else document.documentElement.classList.remove('theme-light')
    }, [theme])

    // External theme control (via window message) should probably stay in App.tsx or use a separate hook, 
    // but for now we can expose setTheme to be called from there if needed, 
    // or better yet, move the message listener here?
    // The message listener modifies DOM classList and calls defaultStore.
    // Let's keep the message listener in App.tsx for now to avoid complexity, 
    // but expose setTheme so App.tsx can update the state.

    // Generic updater
    const updateSettings = (updates: Partial<Settings>) => {
        setSettings(prev => prev ? { ...prev, ...updates } : updates as Settings)
        saveSettings(updates).catch(console.error)
    }

    return {
        settings,
        loadedSettings,
        theme, setTheme,
        autoOpen, setAutoOpen,
        showHidden, setShowHidden,
        showLogs, toggleLogs,
        showServerLogs, toggleServerLogs,
        hideMemoryUsage, toggleHideMemoryUsage,
        maxEditorSize, updateMaxEditorSize,
        canChangeRoot,
        uiMode, setUiMode,
        updateSettings, // Export generic updater
        i18n
    }
}
