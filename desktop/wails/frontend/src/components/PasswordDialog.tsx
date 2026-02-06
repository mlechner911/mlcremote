import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import { useI18n } from '../utils/i18n'

interface PasswordDialogProps {
    title: string
    description?: string
    onConfirm: (password: string, passphrase?: string, bootstrapKey?: string) => void
    onCancel: () => void
    loading?: boolean
    isPremium?: boolean
    onUseManagedIdentity?: () => void
    showNewPassphrase?: boolean
    passwordLabel?: string
    passphraseLabel?: string
    allowBootstrapKey?: boolean
    placeholder?: string
    errorMessage?: string
}

export default function PasswordDialog({ title, description, onConfirm, onCancel, loading, isPremium, onUseManagedIdentity, showNewPassphrase, passwordLabel, passphraseLabel, allowBootstrapKey, placeholder, errorMessage }: PasswordDialogProps) {
    const { t } = useI18n()
    const [password, setPassword] = useState('')
    const [passphrase, setPassphrase] = useState('')
    const [bootstrapKey, setBootstrapKey] = useState('')
    const [useBootstrapKey, setUseBootstrapKey] = useState(false)

    const handleConfirm = () => {
        onConfirm(password, passphrase, bootstrapKey)
    }

    const pickBootstrapKey = async () => {
        try {
            // @ts-ignore
            const path = await window['go']['app']['App']['PickIdentityFile']()
            if (path) setBootstrapKey(path)
        } catch (e) {
            console.error(e)
        }
    }

    const content = (
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

                {errorMessage && (
                    <div style={{ color: 'var(--danger)', marginBottom: 15, fontSize: 13, background: 'rgba(255,0,0,0.1)', padding: '8px 12px', borderRadius: 4 }}>
                        {errorMessage}
                    </div>
                )}

                {!useBootstrapKey ? (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <label style={{ fontSize: 12, opacity: 0.7 }}>
                                {passwordLabel || "SSH Password (for authentication)"}
                            </label>
                            {allowBootstrapKey && (
                                <button
                                    className="btn-text"
                                    onClick={() => setUseBootstrapKey(true)}
                                    style={{ fontSize: 11, color: 'var(--primary)', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
                                >
                                    Use Key instead
                                </button>
                            )}
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                            placeholder={placeholder || t('password') || "Password"}
                            autoFocus
                            style={{
                                width: '100%', padding: '10px', borderRadius: 4,
                                border: '1px solid var(--border)', background: 'var(--bg-root)',
                                color: 'inherit'
                            }}
                        />
                    </div>
                ) : (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <label style={{ fontSize: 12, opacity: 0.7 }}>
                                Bootstrapping Key
                            </label>
                            <button
                                className="btn-text"
                                onClick={() => setUseBootstrapKey(false)}
                                style={{ fontSize: 11, color: 'var(--primary)', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                                Use Password
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                type="text"
                                value={bootstrapKey}
                                readOnly
                                placeholder="Select private key..."
                                style={{
                                    flex: 1, padding: '10px', borderRadius: 4,
                                    border: '1px solid var(--border)', background: 'var(--bg-root)',
                                    color: 'inherit', fontSize: 13
                                }}
                            />
                            <button className="btn" onClick={pickBootstrapKey}>Browse</button>
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                            Use an existing authorized key to install the new key.
                        </div>
                    </div>
                )}

                {showNewPassphrase && (
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 }}>
                            {passphraseLabel || t('new_key_passphrase') || "New Key Passphrase (Optional)"}
                        </label>
                        <input
                            type="password"
                            value={passphrase}
                            onChange={e => setPassphrase(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                            placeholder={t('passphrase_placeholder') || "Leave empty for no passphrase"}
                            style={{
                                width: '100%', padding: '10px', borderRadius: 4,
                                border: '1px solid var(--border)', background: 'var(--bg-root)',
                                color: 'inherit'
                            }}
                        />
                        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                            {t('passphrase_hint') || "Protects your key if your device is stolen."}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={onCancel} disabled={loading}>{t('cancel')}</button>
                    <button className="btn primary" onClick={handleConfirm} disabled={(loading) || (!password && !bootstrapKey && !showNewPassphrase)}>
                        {loading ? '...' : t('ok')}
                    </button>
                </div>
            </div>
        </div>
    )

    return ReactDOM.createPortal(content, document.body)
}
