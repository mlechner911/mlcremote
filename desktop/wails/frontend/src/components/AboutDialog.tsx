import React from 'react'
import { useI18n } from '../utils/i18n'

interface AboutDialogProps {
    onClose: () => void
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
    const { t } = useI18n()

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: 'var(--bg-panel)', padding: 24, borderRadius: 8,
                width: '100%', maxWidth: 400, border: '1px solid var(--border)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>{t('app_title')}</h2>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {t('version')} 1.4.5
                    </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                    <div style={{
                        background: 'var(--bg-root)', padding: 16, borderRadius: 6,
                        border: '1px solid var(--border)', fontSize: '0.9rem'
                    }}>
                        <div style={{ marginBottom: 8 }}>
                            <strong>{t('copyright')}</strong> &copy; 2025 Michael Lechner
                        </div>
                        <div>
                            <strong>{t('license')}</strong> MIT
                        </div>
                    </div>

                    <div style={{
                        borderTop: '1px solid var(--border)', margin: '16px 0', paddingTop: 16,
                        fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center'
                    }}>
                        Schönachstrasse 27, 86972 Altenstadt, Germany<br />
                        <a href="mailto:lechner.altenstadt@web.de" style={{ color: 'var(--accent)', textDecoration: 'none' }}>lechner.altenstadt@web.de</a>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '10px', background: 'var(--accent)', color: 'white',
                        border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '1rem',
                        fontWeight: 500
                    }}
                >
                    {t('close')}
                </button>
            </div>
        </div>
    )
}
