import React, { useState } from 'react'
import { VerifyMasterPassword } from '../wailsjs/go/app/App'
import { Icon } from '../generated/icons'

interface AppLockProps {
    onUnlock: () => void
}

export default function AppLock({ onUnlock }: AppLockProps) {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleUnlock = async () => {
        if (!password) return
        setLoading(true)
        setError('')
        try {
            const valid = await VerifyMasterPassword(password)
            if (valid) {
                onUnlock()
            } else {
                setError('Incorrect password')
            }
        } catch (e: any) {
            setError('Error verifying password: ' + (e.message || e))
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleUnlock()
        }
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--bg-root)', color: 'var(--text-primary)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000
        }}>
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
                <div style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="icon-lock" size={48} /></div>
                <h2 style={{ marginTop: 16 }}>MLCRemote is Locked</h2>
                <div className="muted">Please enter your master password to continue.</div>
            </div>

            <div style={{ width: 300 }}>
                <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Master Password"
                    autoFocus
                    style={{
                        width: '100%', padding: '10px 12px', borderRadius: 4,
                        border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'inherit',
                        outline: 'none', marginBottom: 12
                    }}
                />
                {error && <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

                <button
                    onClick={handleUnlock}
                    disabled={loading || !password}
                    className="btn"
                    style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
                >
                    {loading ? 'Verifying...' : 'Unlock'}
                </button>
            </div>
        </div>
    )
}
