import React from 'react'
import { useI18n } from '../utils/i18n'

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { lang, setLang, t } = useI18n()

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
        <h2 style={{ marginTop: 0 }}>{t('about')}</h2>

        <div style={{ margin: '24px 0', lineHeight: '1.6', textAlign: 'left' }}>
          <p>
            <strong>{t('version')}:</strong> 1.0.1<br />
            <strong>{t('license')}:</strong> MIT License
          </p>

          <div style={{ margin: '20px 0' }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              {t('language')}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {languages.map(l => {
                const isActive = lang === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      background: isActive ? 'var(--accent)' : 'var(--bg-panel)',
                      color: isActive ? 'white' : 'var(--text-primary)',
                      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: isActive ? 600 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.2s'
                    }}
                  >
                    {l.name}
                    {isActive && <span style={{ fontSize: '0.8rem' }}>●</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0', paddingTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>{t('copyright')} © {new Date().getFullYear()} Michael Lechner</strong><br />
            Schönachstrasse 27<br />
            86972 Altenstadt, Germany<br />
            <a href="mailto:lechner.altenstadt@web.de" style={{ color: 'var(--accent)' }}>lechner.altenstadt@web.de</a>
          </div>
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
    </div>
  )
}
