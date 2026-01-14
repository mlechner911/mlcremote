import React, { useState, useEffect } from 'react'
import { Icon } from '../generated/icons'
import { ConnectionProfile } from '../types'
import { useI18n } from '../utils/i18n'
import { ProbeConnection, DeploySSHKey, VerifyPassword, GetManagedIdentityPath, PickIdentityFile } from '../wailsjs/go/app/App'
import PasswordDialog from './PasswordDialog'
import { useConnectionTester } from '../hooks/useConnectionTester'
import ColorPicker, { DEFAULT_COLORS } from './ColorPicker'
import { TaskDef } from '../types'
import TaskEditor from './TaskEditor'
import TaskIcon from './TaskIcon'



type int = number

interface ProfileEditorProps {
    profile?: ConnectionProfile
    onSave: (p: ConnectionProfile) => void
    onCancel: () => void
    isPremium?: boolean
}



// Define the shape locally until generated bindings are available/updated


export default function ProfileEditor({ profile, onSave, onCancel, isPremium }: ProfileEditorProps) {
    const { t } = useI18n()
    const [name, setName] = useState(profile?.name || '')
    const [color, setColor] = useState(profile?.color || DEFAULT_COLORS[0])
    const [user, setUser] = useState(profile?.user || '')
    const [host, setHost] = useState(profile?.host || '')
    const [port, setPort] = useState(profile?.port || 22)
    const [localPort, setLocalPort] = useState(profile?.localPort || 8443)

    // Auth Type Logic
    const [identityFile, setIdentityFile] = useState(profile?.identityFile || '')
    const [authType, setAuthType] = useState<'agent' | 'custom' | 'managed'>('agent')
    const [managedPath, setManagedPath] = useState('')
    const [isVerified, setIsVerified] = useState(false)

    // Task & Premium Logic
    const [tasks, setTasks] = useState<TaskDef[]>(profile?.tasks || [])
    const [editingTask, setEditingTask] = useState<TaskDef | null>(null)
    const [showTaskEditor, setShowTaskEditor] = useState(false)

    const normalizePath = (p: string) => p.replace(/\\/g, '/').toLowerCase()

    useEffect(() => {
        if (profile) {
            setName(profile.name || '')
            setColor(profile.color || DEFAULT_COLORS[0])
            setUser(profile.user || '')
            setHost(profile.host || '')
            setPort(profile.port || 22)
            setLocalPort(profile.localPort || 8443)
            setIdentityFile(profile.identityFile || '')
        } else {
            setName('')
            setColor(DEFAULT_COLORS[0])
            setUser('')
            setHost('')
            setPort(22)
            setLocalPort(8443)
            setIdentityFile('')
        }
    }, [profile])

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
            extraArgs: profile?.extraArgs || [],
            tasks: tasks
        })
    }

    const handleTaskSave = (t: TaskDef) => {
        const idx = tasks.findIndex(x => x.id === t.id)
        if (idx >= 0) {
            const copy = [...tasks]
            copy[idx] = t
            setTasks(copy)
        } else {
            setTasks([...tasks, t])
        }
        setShowTaskEditor(false)
        setEditingTask(null)
    }

    const handleDeleteTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id))
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
                        <ColorPicker value={color} onChange={setColor} />
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

                {/* Tasks Section */}
                <div style={{ padding: 16, background: 'var(--bg-section)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('quick_tasks') || "Quick Tasks"}</h3>
                        {isPremium && (
                            <button type="button" className="btn secondary small" onClick={() => { setEditingTask(null); setShowTaskEditor(true) }}>
                                <Icon name="icon-plus" size={12} /> {t('add_task')}
                            </button>
                        )}
                        {!isPremium && <div style={{ fontSize: '0.75rem', color: '#f7b955', border: '1px solid #f7b955', padding: '2px 6px', borderRadius: 4 }}>PREMIUM</div>}
                    </div>

                    {!isPremium && (
                        <div className="muted" style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>
                            {t('premium_tasks_upsell') || "Upgrade to Premium to create custom server shortcuts and automate your workflow."}
                        </div>
                    )}

                    {isPremium && tasks.length === 0 && (
                        <div className="muted" style={{ fontSize: '0.9rem', textAlign: 'center', padding: 10 }}>
                            {t('no_tasks') || "No tasks defined. Add one to get started."}
                        </div>
                    )}

                    {isPremium && tasks.length > 0 && (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {tasks.map(task => (
                                <div key={task.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 12px', background: 'var(--bg-panel)', borderRadius: 6,
                                    border: '1px solid var(--border)'
                                }}>
                                    <TaskIcon icon={task.icon || 'play'} color={task.color || '#3b82f6'} size={20} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{task.name}</div>
                                        <div className="muted" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{task.command}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button type="button" className="icon-btn" onClick={() => { setEditingTask(task); setShowTaskEditor(true) }}>
                                            <Icon name="icon-settings" size={14} />
                                        </button>
                                        <button type="button" className="icon-btn" onClick={() => handleDeleteTask(task.id)}>
                                            <Icon name="icon-trash" size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
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

            {showTaskEditor && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-root)', padding: 0, borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                        <TaskEditor
                            task={editingTask || undefined}
                            onSave={handleTaskSave}
                            onCancel={() => { setShowTaskEditor(false); setEditingTask(null) }}
                        />
                    </div>
                </div>
            )}

            {showPasswordDialog && (
                <PasswordDialog
                    title={passwordAction === 'deploy' ? t('deploy_key_msg') : t('password')}
                    description={t('enter_remote_password')}
                    onConfirm={handlePasswordConfirm}
                    onCancel={() => setShowPasswordDialog(false)}
                />
            )}
        </div>
    )
}
