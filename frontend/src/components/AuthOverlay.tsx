import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'

export default function AuthOverlay() {
    const { t } = useTranslation()
    const {
        showAuthChooser, setShowAuthChooser,
        showLogin, setShowLogin,
        showTokenInput, setShowTokenInput,
        login, setToken
    } = useAuth()
    const { showDialog } = useDialog()

    const [password, setPassword] = React.useState('')
    const [token, setTokenInput] = React.useState('')

    if (!showAuthChooser && !showLogin && !showTokenInput) return null

    return (
        <>
            {/* Unified authentication chooser/modal */}
            {showAuthChooser && (
                <div className="premium-overlay">
                    <div className="premium-dialog">
                        <h3 style={{ margin: '0 0 12px 0' }}>{t('auth_not_authenticated', 'Not Authenticated')}</h3>
                        <p style={{ margin: '0 0 20px 0', opacity: 0.9 }}>{t('auth_required_msg', 'You need to sign in or provide an access key to continue.')}</p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button className="btn primary" onClick={() => { setShowAuthChooser(false); setShowLogin(true) }}>
                                {t('open')} ({t('password', 'password')})
                            </button>
                            <button className="btn" onClick={() => { setShowAuthChooser(false); setShowTokenInput(true) }}>
                                {t('auth_have_key', 'I have an access key')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password input modal (shown when user chooses to sign in) */}
            {showLogin && (
                <div className="premium-overlay">
                    <div className="premium-dialog">
                        <h3 style={{ margin: '0 0 12px 0' }}>{t('sign_in', 'Sign in')}</h3>
                        <p style={{ margin: '0 0 20px 0', opacity: 0.9 }}>{t('auth_enter_password', 'Please enter the server password to obtain an access token.')}</p>
                        <input
                            type="password"
                            placeholder={t('password', 'Password')}
                            style={{ width: '100%', marginBottom: 20 }}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    login(password).catch((e: any) => showDialog({ title: t('login_failed'), message: e?.message || e, variant: 'error' }))
                                }
                            }}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn primary" onClick={async () => {
                                try {
                                    await login(password)
                                } catch (e: any) {
                                    showDialog({ title: t('login_failed'), message: e?.message || e, variant: 'error' })
                                }
                            }}>{t('open')}</button>
                            <button className="btn link" onClick={() => { setShowLogin(false); setShowAuthChooser(true) }}>{t('back', 'Back')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Token input modal (shown when user chooses to provide an access key) */}
            {showTokenInput && (
                <div className="premium-overlay">
                    <div className="premium-dialog">
                        <h3 style={{ margin: '0 0 12px 0' }}>{t('auth_enter_token', 'Enter Access Token')}</h3>
                        <p style={{ margin: '0 0 20px 0', opacity: 0.9 }}>{t('auth_token_msg', 'The server requires an access token. Paste it here to continue.')}</p>
                        <input
                            type="text"
                            placeholder={t('token', 'token')}
                            style={{ width: '100%', marginBottom: 20 }}
                            value={token}
                            onChange={(e) => setTokenInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    try {
                                        setToken(token.trim())
                                    } catch (e: any) {
                                        showDialog({ title: t('token_failed'), message: e?.message || e, variant: 'error' })
                                    }
                                }
                            }}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn primary" onClick={async () => {
                                try {
                                    setToken(token.trim())
                                } catch (e: any) {
                                    showDialog({ title: t('token_failed'), message: e?.message || e, variant: 'error' })
                                }
                            }}>{t('use_token', 'Use token')}</button>
                            <button className="btn link" onClick={() => { setShowTokenInput(false); setShowAuthChooser(true) }}>{t('back', 'Back')}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
