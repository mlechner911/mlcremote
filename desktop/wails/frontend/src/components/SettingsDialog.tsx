import React from 'react'
import { useI18n } from '../utils/i18n'
import { Icon } from '../generated/icons'
import { SetMasterPassword, HasMasterPassword, IsPremium, GetManagedIdentity } from '../wailsjs/go/app/App'

export default function SettingsDialog({ onClose, theme, onSetTheme }: { onClose: () => void, theme: 'light' | 'dark' | 'auto', onSetTheme: (t: 'light' | 'dark' | 'auto') => void }) {
  const { lang, setLang, t } = useI18n()
  const [newPassword, setNewPassword] = React.useState('')
  const [saveStatus, setSaveStatus] = React.useState('')
  const [hasPassword, setHasPassword] = React.useState(false)
  const [isPremium, setIsPremium] = React.useState(false)
  const [managedKey, setManagedKey] = React.useState('')

  React.useEffect(() => {
    HasMasterPassword().then(setHasPassword)
    IsPremium().then(p => {
      setIsPremium(p)
      if (p) {
        GetManagedIdentity().then(setManagedKey)
      }
    })
  }, [])


  const handleSetPassword = async () => {
    try {
      await SetMasterPassword(newPassword)
      setSaveStatus(t('status_saved'))
      setNewPassword('')
      setHasPassword(true)
      setTimeout(() => setSaveStatus(''), 3000)
    } catch (e: any) {
      setSaveStatus(t('status_failed'))
    }
  }

  const handleRemovePassword = async () => {
    if (!window.confirm(t('remove_password_confirm'))) return
    try {
      await SetMasterPassword("")
      setHasPassword(false)
      setSaveStatus(t('password_removed'))
      setTimeout(() => setSaveStatus(''), 3000)
    } catch (e: any) {
      setSaveStatus(t('status_failed'))
    }
  }


  const languages = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
  ] as const;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', backgroundColor: 'var(--bg-root)', color: 'var(--text-primary)'
    }}>
      <div style={{
        background: 'var(--bg-sidebar)', padding: 32, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: 500, width: '100%', textAlign: 'center', border: '1px solid var(--border)'
      }}>
        <h2 style={{ marginTop: 0 }}>{t('settings')}</h2>

        <div style={{ margin: '20px 0', borderBottom: '1px solid var(--border)', paddingBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {t('master_password')}
          </label>

          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={hasPassword ? t('new_password') : t('new_password')}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 4,
                  border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'inherit'
                }}
              />
              <button className="btn" onClick={handleSetPassword}>{t('save')}</button>
            </div>

            {hasPassword && (
              <button
                onClick={handleRemovePassword}
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  border: '1px solid var(--error)',
                  color: 'var(--error)',
                  padding: '6px 12px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {t('remove_password')}
              </button>
            )}
          </div>

          {saveStatus && <div style={{ fontSize: 12, marginTop: 4, color: saveStatus === t('status_saved') || saveStatus === t('password_removed') ? '#7ee787' : 'var(--error)' }}>{saveStatus}</div>}
        </div>

        <div style={{ margin: '20px 0' }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {t('language')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {languages.map(l => {
              const isActive = lang === l.code;
              const flagCode = l.code === 'en' ? 'gb' : l.code;
              return (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  title={l.name}
                  style={{
                    padding: 8,
                    borderRadius: '6px',
                    background: isActive ? 'var(--accent)' : 'var(--bg-panel)',
                    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    opacity: isActive ? 1 : 0.7
                  }}
                  onMouseOver={(e) => { if (!isActive) e.currentTarget.style.opacity = '1' }}
                  onMouseOut={(e) => { if (!isActive) e.currentTarget.style.opacity = '0.7' }}
                >
                  <Icon name={`icon-flag-${flagCode}`} size={28} />
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ margin: '20px 0' }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {t('appearance')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onSetTheme('auto')}
              style={{
                flex: 1, padding: '8px', borderRadius: 6,
                background: theme === 'auto' ? 'var(--accent)' : 'var(--bg-panel)',
                border: theme === 'auto' ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: theme === 'auto' ? 'white' : 'inherit',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              <Icon name="icon-theme-auto" size={18} />
              {t('system_theme')}
            </button>
            <button
              onClick={() => onSetTheme('dark')}
              style={{
                flex: 1, padding: '8px', borderRadius: 6,
                background: theme === 'dark' ? 'var(--accent)' : 'var(--bg-panel)',
                border: theme === 'dark' ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: theme === 'dark' ? 'white' : 'inherit',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              <Icon name="icon-moon" size={18} />
              {t('dark_mode')}
            </button>
            <button
              onClick={() => onSetTheme('light')}
              style={{
                flex: 1, padding: '8px', borderRadius: 6,
                background: theme === 'light' ? 'var(--accent)' : 'var(--bg-panel)',
                border: theme === 'light' ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: theme === 'light' ? 'white' : 'inherit',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              <Icon name="icon-sun" size={18} />
              {t('light_mode')}
            </button>
          </div>
        </div>

        {isPremium && (
          <div style={{ margin: '20px 0', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <label style={{ marginBottom: 8, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: '#f7b955', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('managed_identity_label')}
              <span style={{ fontSize: 9, border: '1px solid #f7b955', borderRadius: 4, padding: '0 4px' }}>PRO</span>
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                readOnly
                value={managedKey || "Loading..."}
                style={{
                  width: '100%', height: 60, padding: 8, borderRadius: 6,
                  background: 'var(--bg-panel)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: 11, resize: 'none',
                  fontFamily: 'monospace'
                }}
              />
              <button
                onClick={() => {
                  if (managedKey) {
                    navigator.clipboard.writeText(managedKey)
                    setSaveStatus("Copied to clipboard!")
                    setTimeout(() => setSaveStatus(''), 2000)
                  }
                }}
                style={{
                  position: 'absolute', bottom: 8, right: 8,
                  fontSize: 10, padding: '2px 8px', background: 'var(--bg-root)', border: '1px solid var(--border)', borderRadius: 4,
                  cursor: 'pointer', color: 'var(--text-primary)'
                }}>
                {t('copy')}
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'left' }}>
              {t('managed_identity_desc')}
            </div>
          </div>
        )}

      </div>

      <button
        onClick={onClose}
        style={{
          padding: '8px 24px', background: 'var(--accent)', color: 'white',
          border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '1rem'
        }}
      >
        {t('close')}
      </button>
    </div>
  )
}
