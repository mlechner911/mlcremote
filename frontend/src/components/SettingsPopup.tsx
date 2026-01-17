import * as React from 'react'
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import { useTranslation } from 'react-i18next'
import { captureElementToPng } from '../utils/capture'

type Props = {
  autoOpen: boolean
  showHidden: boolean
  onToggleAutoOpen: (v: boolean) => void
  onToggleShowHidden: (v: boolean) => void
  showLogs: boolean
  onToggleLogs: (v: boolean) => void
  showServerLogs: boolean
  onToggleServerLogs: (v: boolean) => void
  hideMemoryUsage: boolean
  onToggleHideMemoryUsage: (v: boolean) => void
  onClose: () => void
  onLanguageChange?: (lang: string) => void
  maxEditorSize?: number
  onMaxFileSizeChange?: (size: number) => void
  uiMode: 'classic' | 'modern'
  onToggleUiMode: (m: 'classic' | 'modern') => void
  onLogout?: () => void
}

export default function SettingsPopup({ autoOpen, showHidden, onToggleAutoOpen, onToggleShowHidden, showLogs, onToggleLogs, showServerLogs, onToggleServerLogs, hideMemoryUsage, onToggleHideMemoryUsage, onClose, onLanguageChange, maxEditorSize, onMaxFileSizeChange, uiMode, onToggleUiMode, onLogout }: Props) {
  const { t, i18n } = useTranslation()
  const [localHideMemoryUsage, setLocalHideMemoryUsage] = React.useState<boolean>(hideMemoryUsage)

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    onLanguageChange?.(lng)
  }

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
  ]

  return (
    <div style={{ position: 'absolute', right: 12, top: 40, zIndex: 5000 }}>
      <div style={{ width: 320, background: 'var(--bg)', border: '1px solid var(--muted)', borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{t('settings')}</strong>
          <button aria-label={t('close')} title={t('close')} onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Icon name={getIcon('close')} size={16} /></button>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 8, letterSpacing: '0.05em' }}>
            {t('language')}
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {languages.map(l => {
              const isActive = i18n.language === l.code || (l.code === 'en' && !i18n.language)
              // Mapping 'en' to 'gb' for flagcdn, others match usually
              const flagCode = l.code === 'en' ? 'gb' : l.code

              return (
                <button
                  key={l.code}
                  onClick={() => changeLanguage(l.code)}
                  title={l.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                    background: isActive ? 'var(--bg-select)' : 'var(--bg-panel)',
                    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: isActive ? 1 : 0.7
                  }}
                  onMouseOver={(e) => { if (!isActive) e.currentTarget.style.opacity = '1' }}
                  onMouseOut={(e) => { if (!isActive) e.currentTarget.style.opacity = '0.7' }}
                >
                  <Icon name={`icon-flag-${flagCode}`} size={24} />
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={autoOpen} onChange={e => onToggleAutoOpen(e.target.checked)} />{' '}
            {t('auto_open_files', 'Auto open files')}
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showHidden} onChange={e => onToggleShowHidden(e.target.checked)} />{' '}
            {t('show_hidden_files', 'Show hidden files')}
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showLogs} onChange={e => onToggleLogs(e.target.checked)} /> {t('show_console_logs', 'Show console logs (Debug)')}
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showServerLogs} onChange={e => onToggleServerLogs(e.target.checked)} /> {t('show_server_logs', 'Show server logs (Backend)')}
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={localHideMemoryUsage} onChange={e => { setLocalHideMemoryUsage(e.target.checked); onToggleHideMemoryUsage(e.target.checked) }} /> {t('hide_memory_usage', 'Hide memory usage gauge')}
          </label>
        </div>

        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <strong style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('editor_settings', 'Editor Settings')}</strong>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 13 }} title={t('max_file_size_tooltip', 'Files larger than this (MB) will open in read-only mode')}>
              {t('max_file_size', 'Max File Size (MB)')}
            </label>
            <input
              type="number"
              min="0.1"
              step="0.5"
              style={{ width: 60, background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, padding: '2px 4px' }}
              value={((maxEditorSize || parseInt(localStorage.getItem('mlc_max_editor_size') || '1048576')) / 1024 / 1024).toFixed(1)}
              onChange={(e) => {
                const mb = parseFloat(e.target.value)
                if (mb > 0) {
                  const bytes = Math.floor(mb * 1024 * 1024)
                  localStorage.setItem('mlc_max_editor_size', bytes.toString())
                  onMaxFileSizeChange?.(bytes)
                }
              }}
            />
          </div>
        </div>


        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => {
            const app = document.querySelector('.app') as HTMLElement
            if (app) captureElementToPng(app, 'screenshot.png')
            onClose()
          }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ marginRight: 6, display: 'flex' }}>
              <Icon name="icon-camera" size={14} />
            </div>
            {t('screenshot', 'Screenshot')}
          </button>

          {onLogout && (
            <button className="btn btn-danger" onClick={() => {
              if (confirm(t('confirm_logout', 'Disconnect?'))) {
                onLogout()
                onClose()
              }
            }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ marginRight: 6, display: 'flex' }}>
                <Icon name="icon-logout" size={14} />
              </div>
              {t('disconnect', 'Disconnect')}
            </button>
          )}
        </div>
      </div >
    </div >
  )
}
