import React, { useState, useEffect } from 'react'
import { Icon } from '../generated/icons'
import { useI18n } from '../utils/i18n'
import { ProbeConnection, DeploySSHKey, VerifyPassword, GetManagedIdentityPath, PickIdentityFile } from '../wailsjs/go/app/App'
import PasswordDialog from './PasswordDialog'
import { useConnectionTester } from '../hooks/useConnectionTester'

// Define the shape locally until generated bindings are available/updated
// should come from swagger at some point..
export interface ConnectionProfile {
    id?: string
    name: string
    color: string
    user: string
    host: string
    port: int
    localPort: int
    identityFile: string
    isWindows: boolean
    lastUsed: number
    extraArgs: string[]
    remoteOS?: string
    remoteArch?: string
    remoteVersion?: string
}

type int = number

interface ProfileEditorProps {
    profile?: ConnectionProfile
    onSave: (p: ConnectionProfile) => void
    onCancel: () => void
    isPremium?: boolean
}

const COLORS = [
    '#007bff', // blue
    '#6f42c1', // purple
    '#28a745', // green
    '#dc3545', // red
    '#ffc107', // yellow
    '#17a2b8', // cyan
    '#fd7e14', // orange
]

export default function ProfileEditor({ profile, onSave, onCancel, isPremium }: ProfileEditorProps) {
    const { t } = useI18n()
    const [name, setName] = useState(profile?.name || '')
    const [color, setColor] = useState(profile?.color || COLORS[0])
    const [user, setUser] = useState(profile?.user || '')
    const [host, setHost] = useState(profile?.host || '')
    const [port, setPort] = useState(profile?.port || 22)
    const [localPort, setLocalPort] = useState(profile?.localPort || 8443)

    // Auth Type Logic
    const [identityFile, setIdentityFile] = useState(profile?.identityFile || '')
    const [authType, setAuthType] = useState<'agent' | 'custom' | 'managed'>('agent')
    const [managedPath, setManagedPath] = useState('')
    const [isVerified, setIsVerified] = useState(false)

    const normalizePath = (p: string) => p.replace(/\\/g, '/').toLowerCase()

    useEffect(() => {
        // Determine initial auth type
        if (!profile?.identityFile) {
            setAuthType('agent')
        } else {
            // Check if it matches managed path? For now default to custom if set, 
            // unless we can verify it's the managed one.
            setAuthType('custom')
        }

        // Fetch managed path if premium
        if (isPremium) {
            GetManagedIdentityPath().then(path => {
                setManagedPath(path)
                const normPath = normalizePath(path)
                const normId = normalizePath(profile?.identityFile || '')

                if (normId && (normId === normPath)) {
                    setAuthType('managed')
                } else if (normId) {
                    // Check if it's strictly equal to managed path (case insensitive normalized)
                }
            }).catch(console.error)
        }
    }, [isPremium, profile])

    const handleAuthTypeChange = (type: 'agent' | 'custom' | 'managed') => {
        setAuthType(type)
        if (type === 'agent') {
            setIdentityFile('')
        } else if (type === 'managed') {
            setIdentityFile(managedPath)
        } else {
            // custom, keep existing or empty
            if (identityFile === managedPath) setIdentityFile('')
        }
    }

    const [showPasswordDialog, setShowPasswordDialog] = useState(false)
    const [passwordAction, setPasswordAction] = useState<'deploy' | 'test'>('test')

    // Use the new hook
    const { testStatus, setTestStatus, isTesting, testConnection } = useConnectionTester()
    const [passwordReason, setPasswordReason] = useState<'auth-failed' | 'no-key'>('no-key')


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave({
            ...profile,
            name: name || `${user}@${host}`, // default name if empty
            color,
            user,
            host,
            port: Number(port),
            localPort: Number(localPort),
            identityFile,
            isWindows: profile?.isWindows || false,
            lastUsed: profile?.lastUsed || 0,
            extraArgs: profile?.extraArgs || []
        })
    }

    const handleTestConnection = async () => {
        const res = await testConnection({
            host, user, port: Number(port), identityFile
        })

        if (res === 'ok') {
            setIsVerified(true)
        } else {
            setIsVerified(false)
        }

        if (res === 'auth-failed' || res === 'no-key') {
            const msg = res === 'auth-failed' ? t('auth_failed_pwd_fallback') : t('no_key_pwd_fallback')
            if (window.confirm(msg)) {
                setPasswordAction('test')
                setPasswordReason(res as any)
                setShowPasswordDialog(true)
            }
        }
    }

    const handlePasswordConfirm = async (password: string) => {
        if (passwordAction === 'deploy') {
            await performDeploy(password)
            return
        }

        // Test Password
        setTestStatus(t('status_checking'))
        try {
            // @ts-ignore
            const res = await VerifyPassword({
                host, user, port: Number(port), password, identityFile: ''
            })

            if (res === 'ok') {
                setIsVerified(true)
                setShowPasswordDialog(false)
                setTestStatus(t('connection_ok'))

                // If we have a local key (auth-failed), offer to deploy
                if (passwordReason === 'auth-failed') {
                    setTimeout(async () => {
                        if (window.confirm(t('add_key_question'))) {
                            await performDeploy(password)
                        }
                    }, 100)
                } else if (passwordReason === 'no-key') {
                    // No local key found, show instructions on how to generate one
                    alert(t('ssh_key_missing_info'))
                }
            } else {
                alert(t('status_failed') + ": " + res)
                // Keep dialog open? 
            }
        } catch (e: any) {
            alert(t('status_failed') + ": " + (e.message || e))
        }
    }

    const performDeploy = async (password: string) => {
        setTestStatus(t('installing_key'))
        setShowPasswordDialog(false)
        try {
            // @ts-ignore
            await DeploySSHKey({
                host, user, port: Number(port), password, identityFile
            })
            setTestStatus(t('key_installed'))
            setTimeout(handleTestConnection, 1000)
        } catch (e: any) {
            setTestStatus(`${t('status_failed')}: ${e.message || e}`)
        }
    }

    return (
        <div style={{ padding: 24, paddingBottom: 0 }}>
            <h2 style={{ marginTop: 0, marginBottom: 20 }}>{profile ? t('edit_connection') : t('new_connection')}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
                {/* Name & Color */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                    <div>
                        <label className="label">{t('name')}</label>
                        <input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="My Remote Server" />
                    </div>
                    <div>
                        <label className="label">{t('color')}</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {COLORS.map(c => (
                                <div
                                    key={c}
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: 20, height: 20, borderRadius: '50%', background: c,
                                        cursor: 'pointer',
                                        border: color === c ? '2px solid white' : '2px solid transparent',
                                        outline: color === c ? '1px solid var(--accent)' : 'none'
                                    }}
                                />
                            ))}

                            {/* Custom Picker */}
                            <div style={{ position: 'relative', width: 20, height: 20 }}>
                                <input
                                    type="color"
                                    value={COLORS.includes(color) ? '#ffffff' : color}
                                    onChange={e => setColor(e.target.value)}
                                    style={{
                                        position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
                                        width: '100%', height: '100%', padding: 0, margin: 0
                                    }}
                                />
                                <div style={{
                                    width: 20, height: 20, borderRadius: '50%',
                                    background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                                    border: !COLORS.includes(color) ? '2px solid white' : '2px solid transparent',
                                    outline: !COLORS.includes(color) ? '1px solid var(--accent)' : 'none',
                                    pointerEvents: 'none'
                                }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* User & Host */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <div>
                        <label className="label">{t('user')}</label>
                        <input className="input" required value={user} onChange={e => setUser(e.target.value)} placeholder="root" />
                    </div>
                    <div>
                        <label className="label">{t('host')}</label>
                        <input className="input" required value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.100" />
                    </div>
                </div>

                {/* SSH Port & Local Port */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label className="label">{t('port')}</label>
                        <input className="input" type="number" value={port} onChange={e => setPort(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="label">{t('localPort')}</label>
                        <input className="input" type="number" value={localPort} onChange={e => setLocalPort(Number(e.target.value))} />
                    </div>
                </div>

                <div>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t('auth_method')}
                        {isVerified && <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>}
                    </label>
                    <select
                        className="input"
                        value={authType}
                        onChange={e => handleAuthTypeChange(e.target.value as any)}
                        style={{ width: '100%', marginBottom: 12 }}
                    >
                        <option value="agent">{t('auth_agent')}</option>
                        <option value="custom">{t('auth_custom')}</option>
                        {isPremium && <option value="managed">{t('premium_managed')}</option>}
                    </select>

                    {authType === 'managed' && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
                            {t('managed_key_info')}
                        </div>
                    )}

                    {authType === 'custom' && (
                        <div>
                            <label className="label">{t('identityFile')}</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    className="input"
                                    value={identityFile}
                                    onChange={e => setIdentityFile(e.target.value)}
                                    placeholder="/path/to/private/key"
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={async () => {
                                        try {
                                            const file = await PickIdentityFile()
                                            if (file) setIdentityFile(file)
                                        } catch (e) {
                                            console.error(e)
                                        }
                                    }}
                                >
                                    {t('browse')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12, alignItems: 'center' }}>
                    {testStatus && <span style={{ fontSize: '0.85rem', color: testStatus.includes('failed') ? 'var(--error)' : 'var(--accent)' }}>{testStatus}</span>}
                    <button type="button" className="btn link" onClick={handleTestConnection} style={{ marginRight: 'auto' }}>{t('test_connection')}</button>
                    <button type="button" className="btn link" onClick={onCancel}>{t('cancel')}</button>
                    <button type="submit" className="btn primary">{t('save_profile')}</button>
                </div>
            </form>

            {showPasswordDialog && (
                <PasswordDialog
                    title={passwordAction === 'deploy' ? t('deploy_key_msg') : t('password')}
                    description={t('enter_remote_password')}
                    onConfirm={handlePasswordConfirm}
                    onCancel={() => setShowPasswordDialog(false)}
                />
            )}

            <style>{`
        .label { display: block; font-size: 0.85rem; color: var(--text-muted); marginBottom: 4px; }
        .input { 
          width: 100%; padding: 8px 10px; borderRadius: 4px;
          border: 1px solid var(--border); background: var(--bg-root); color: var(--text-primary);
        }
        .input:focus { border-color: var(--accent); outline: none; }
      `}</style>
        </div>
    )
}
