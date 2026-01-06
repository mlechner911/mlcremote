import * as React from 'react'
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import { useTranslation } from 'react-i18next'

type Props = {
  autoOpen: boolean
  showHidden: boolean
  onToggleAutoOpen: (v: boolean) => void
  onToggleShowHidden: (v: boolean) => void
  showLogs: boolean
  onToggleLogs: (v: boolean) => void
  hideMemoryUsage: boolean
  onToggleHideMemoryUsage: (v: boolean) => void
  onClose: () => void
}

export default function SettingsPopup({ autoOpen, showHidden, onToggleAutoOpen, onToggleShowHidden, showLogs, onToggleLogs, hideMemoryUsage, onToggleHideMemoryUsage, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const [localHideMemoryUsage, setLocalHideMemoryUsage] = React.useState<boolean>(hideMemoryUsage)

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
  ]

  return (
    <div style={{ position: 'absolute', right: 12, top: 40, zIndex: 60 }}>
      <div style={{ width: 320, background: 'var(--bg)', border: '1px solid var(--muted)', borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{t('settings')}</strong>
          <button aria-label={t('close')} title={t('close')} onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Icon name={getIcon('close')} size={16} /></button>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 8, letterSpacing: '0.05em' }}>
            {t('language')}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg-panel)', borderRadius: 6, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {languages.map(l => {
              const isActive = i18n.language === l.code || (l.code === 'en' && !i18n.language)
              return (
                <button
                  key={l.code}
                  onClick={() => changeLanguage(l.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: isActive ? 'var(--bg-select)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'inherit',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    textAlign: 'left',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseOut={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontWeight: isActive ? 600 : 400 }}>{l.name}</span>
                  {isActive && <Icon name={getIcon('check')} size={14} />}
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
            <input type="checkbox" checked={showLogs} onChange={e => onToggleLogs(e.target.checked)} /> {t('show_server_logs', 'Show server logs')}
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
              value={(parseInt(localStorage.getItem('mlc_max_editor_size') || '1048576') / 1024 / 1024).toFixed(1)}
              onChange={(e) => {
                const mb = parseFloat(e.target.value)
                if (mb > 0) {
                  localStorage.setItem('mlc_max_editor_size', Math.floor(mb * 1024 * 1024).toString())
                  // Force re-render not strictly needed as Editor reads on mount/reload, but valid input
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
