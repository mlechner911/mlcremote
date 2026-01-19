import React from 'react'
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import { useTranslation } from 'react-i18next'
import SettingsPopup from './SettingsPopup'
import { Settings, saveSettings } from '../api'

interface AppHeaderProps {
    logoVisible: boolean
    setLogoVisible: (v: boolean) => void
    onOpenTerminal: () => void
    onScreenshot: () => void
    onOpenTrash: () => void
    onSplitPane: (direction: 'horizontal' | 'vertical') => void
    onCloseActivePane: () => void
    canCloseActivePane: boolean
    isControlled: boolean
    theme: 'light' | 'dark'
    themeMode: 'light' | 'dark' | 'auto'
    onToggleTheme: (mode: 'light' | 'dark' | 'auto') => void

    // Settings props
    settingsOpen: boolean
    setSettingsOpen: (v: boolean | ((p: boolean) => boolean)) => void
    aboutOpen: boolean
    setAboutOpen: (v: boolean) => void

    // Settings hook values passed through
    autoOpen: boolean
    setAutoOpen: (v: boolean) => void
    showHidden: boolean
    setShowHidden: (v: boolean) => void
    showLogs: boolean
    toggleLogs: (v: boolean) => void
    hideMemoryUsage: boolean
    toggleHideMemoryUsage: (v: boolean) => void
    maxEditorSize: number
    updateMaxEditorSize: (v: number) => void
    uiMode: 'classic' | 'modern'
    onToggleUiMode: (v: 'classic' | 'modern') => void
    i18n: any
}

export default function AppHeader(props: AppHeaderProps) {
    const { t } = useTranslation()
    const {
        logoVisible, setLogoVisible,
        onOpenTerminal,
        onToggleTheme,
        onScreenshot,
        onOpenTrash,
        onSplitPane,
        onCloseActivePane, canCloseActivePane,
        isControlled, theme, themeMode,
        settingsOpen, setSettingsOpen,
        aboutOpen, setAboutOpen,

        // Settings
        autoOpen, setAutoOpen,
        showHidden, setShowHidden,
        showLogs, toggleLogs,
        hideMemoryUsage, toggleHideMemoryUsage,


        maxEditorSize, updateMaxEditorSize,
        uiMode, onToggleUiMode,
        i18n
    } = props

    const handleThemeToggle = () => {
        // Cycle: Auto -> Light -> Dark -> Auto
        if (themeMode === 'auto') onToggleTheme('light')
        else if (themeMode === 'light') onToggleTheme('dark')
        else onToggleTheme('auto')
    }

    return (
        <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src="/logo.png" alt="MLCRemote logo" style={{ height: 28, display: 'block' }} onLoad={() => setLogoVisible(true)} onError={() => setLogoVisible(false)} />
                {!logoVisible && <h1 style={{ margin: 0 }}>MLCRemote</h1>}
            </div>
            <div className="status">
                <button className="link icon-btn" onClick={onOpenTerminal} title={t('terminal')} aria-label={t('terminal')}><Icon name={getIcon('terminal')} title={t('terminal')} size={16} /></button>

                {!isControlled && (
                    <button className="link icon-btn" aria-label="Toggle theme" onClick={handleThemeToggle}>
                        {themeMode === 'auto' ? (
                            <Icon name="icon-theme-auto" title="System Theme" size={16} />
                        ) : themeMode === 'light' ? (
                            <Icon name={getIcon('sun')} title="Light Mode" size={16} />
                        ) : (
                            <Icon name={getIcon('moon')} title="Dark Mode" size={16} />
                        )}
                    </button>
                )}

                <button className="link icon-btn" title={t('about')} aria-label={t('about')} onClick={() => setAboutOpen(true)}><Icon name={getIcon('info')} title={t('about')} size={16} /></button>
                {!isControlled && (
                    <button className="link icon-btn" title="Screenshot" aria-label="Screenshot" onClick={onScreenshot}><Icon name={getIcon('screenshot')} title="Screenshot" size={16} /></button>
                )}
                <button className="link icon-btn" title="Trash" aria-label="Trash" onClick={onOpenTrash}><Icon name="icon-trash" title="Trash" size={16} /></button>


                <button className="link icon-btn" title="Split Right" aria-label="Split Right" onClick={() => onSplitPane('vertical')}>
                    {/* Split Horizontal Icon (Vertical Split) */}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
                        <path fillRule="evenodd" d="M14 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1zM2 2a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H2z" clipRule="evenodd" />
                        <path d="M8 4v8H7V4h1z" />
                    </svg>
                </button>
                <button className="link icon-btn" title="Split Down" aria-label="Split Down" onClick={() => onSplitPane('horizontal')}>
                    {/* Split Vertical Icon (Horizontal Split) */}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
                        <path fillRule="evenodd" d="M14 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1zM2 2a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H2z" clipRule="evenodd" />
                        <path d="M2 8h12v1H2V8z" />
                    </svg>
                </button>

                {canCloseActivePane && (
                    <button className="link icon-btn" title="Close Active Pane" aria-label="Close Active Pane" onClick={onCloseActivePane} style={{ marginLeft: 4 }}>
                        <Icon name={getIcon('close')} size={16} />
                    </button>
                )}
                <button className="link icon-btn" aria-label={t('settings')} title={t('settings')} onClick={() => setSettingsOpen(s => !s)}><Icon name={getIcon('settings')} title={t('settings')} size={16} /></button>
            </div>
        </header>
    )
}
