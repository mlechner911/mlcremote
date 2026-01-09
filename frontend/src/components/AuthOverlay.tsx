import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

export default function AuthOverlay() {
    const { t } = useTranslation()
    const {
        showAuthChooser, setShowAuthChooser,
        showLogin, setShowLogin,
        showTokenInput, setShowTokenInput,
        login, setToken
    } = useAuth()

    const [password, setPassword] = React.useState('')
    const [token, setTokenInput] = React.useState('')

    if (!showAuthChooser && !showLogin && !showTokenInput) return null

    return (
        <>
            {/* Unified authentication chooser/modal */}
            {showAuthChooser && (
                <div className="login-overlay">
                    <div className="login-box">
                        <h3>{t('auth_not_authenticated', 'Not Authenticated')}</h3>
                        <p>{t('auth_required_msg', 'You need to sign in or provide an access key to continue.')}</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="btn" onClick={() => { setShowAuthChooser(false); setShowLogin(true) }}>
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
                <div className="login-overlay">
                    <div className="login-box">
                        <h3>{t('sign_in', 'Sign in')}</h3>
                        <p>{t('auth_enter_password', 'Please enter the server password to obtain an access token.')}</p>
                        <input
                            type="password"
                            placeholder={t('password', 'Password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    login(password).catch((e: any) => alert(t('login_failed', 'Login failed') + ': ' + (e?.message || e)))
                                }
                            }}
                        />
                        <div style={{ marginTop: 8 }}>
                            <button className="btn" onClick={async () => {
                                try {
                                    await login(password)
                                } catch (e: any) {
                                    alert(t('login_failed', 'Login failed') + ': ' + (e?.message || e))
                                }
                            }}>{t('open')}</button>
                            <button className="btn link" style={{ marginLeft: 8 }} onClick={() => { setShowLogin(false); setShowAuthChooser(true) }}>{t('back', 'Back')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Token input modal (shown when user chooses to provide an access key) */}
            {showTokenInput && (
                <div className="login-overlay">
                    <div className="login-box">
                        <h3>{t('auth_enter_token', 'Enter Access Token')}</h3>
                        <p>{t('auth_token_msg', 'The server requires an access token. Paste it here to continue.')}</p>
                        <input
                            type="text"
                            placeholder={t('token', 'token')}
                            value={token}
                            onChange={(e) => setTokenInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    try {
                                        setToken(token.trim())
                                    } catch (e: any) {
                                        alert(t('token_failed', 'Failed to store token') + ': ' + (e?.message || e))
                                    }
                                }
                            }}
                        />
                        <div style={{ marginTop: 8 }}>
                            <button className="btn" onClick={async () => {
                                try {
                                    setToken(token.trim())
                                } catch (e: any) {
                                    alert(t('token_failed', 'Failed to store token') + ': ' + (e?.message || e))
                                }
                            }}>{t('use_token', 'Use token')}</button>
                            <button className="btn link" style={{ marginLeft: 8 }} onClick={() => { setShowTokenInput(false); setShowAuthChooser(true) }}>{t('back', 'Back')}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
