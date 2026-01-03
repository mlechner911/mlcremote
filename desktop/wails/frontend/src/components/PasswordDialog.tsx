import React, { useState } from 'react'
import { useI18n } from '../utils/i18n'

interface PasswordDialogProps {
    title: string
    description?: string
    onConfirm: (password: string) => void
    onCancel: () => void
    loading?: boolean
}

export default function PasswordDialog({ title, description, onConfirm, onCancel, loading }: PasswordDialogProps) {
    const { t } = useI18n()
    const [password, setPassword] = useState('')

    const handleConfirm = () => {
        if (password) onConfirm(password)
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: 'var(--bg-panel)', padding: 24, borderRadius: 8,
                width: '100%', maxWidth: 400, border: '1px solid var(--border)'
            }}>
                <h3 style={{ marginTop: 0 }}>{title}</h3>
                {description && <p className="muted" style={{ marginBottom: 20 }}>{description}</p>}

                <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                    placeholder={t('password')}
                    autoFocus
                    style={{
                        width: '100%', padding: '10px', borderRadius: 4,
                        border: '1px solid var(--border)', background: 'var(--bg-root)',
                        color: 'inherit', marginBottom: 20
                    }}
                />

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={onCancel} disabled={loading}>{t('cancel')}</button>
                    <button className="btn primary" onClick={handleConfirm} disabled={!password || loading}>
                        {loading ? '...' : t('ok')}
                    </button>
                </div>
            </div>
        </div>
    )
}
