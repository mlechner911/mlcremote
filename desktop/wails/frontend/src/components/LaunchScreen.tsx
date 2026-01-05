import React, { useEffect, useState } from 'react'
import {
    ListProfiles, SaveProfile, DeleteProfile,
    StartTunnelWithProfile, HasMasterPassword, DetectRemoteOS, CheckRemoteVersion, DeploySSHKey,
    IsPremium, SetupManagedIdentity, GetManagedIdentityPath
} from '../wailsjs/go/app/App'
import { useConnectionTester } from '../hooks/useConnectionTester'
import { Icon } from '../generated/icons'
import ProfileEditor, { ConnectionProfile } from './ProfileEditor'
import { Profile } from '../App' // Legacy Profile type if needed, but we use ConnectionProfile mostly
import { useI18n } from '../utils/i18n'
import PasswordDialog from './PasswordDialog'
import AboutDialog from './AboutDialog'

interface LaunchScreenProps {
    onConnected: (p: Profile, token?: string) => void
    onLocked: () => void
    onOpenSettings: () => void
}

export default function LaunchScreen({ onConnected, onLocked, onOpenSettings }: LaunchScreenProps) {
    const { t } = useI18n()
    const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [editing, setEditing] = useState(false)
    const [loading, setLoading] = useState(false)
    const { testStatus, setTestStatus, isTesting, testConnection } = useConnectionTester()
    const [status, setStatus] = useState('')
    const [errorWin, setErrorWin] = useState<string | null>(null) // For Windows install prompt
    const [hasPassword, setHasPassword] = useState(false)
    const [promptDeploy, setPromptDeploy] = useState<ConnectionProfile | null>(null)
    const [deployLoading, setDeployLoading] = useState(false)
    const [showAbout, setShowAbout] = useState(false)
    const [isPremium, setIsPremium] = useState(false)
    const [promptManaged, setPromptManaged] = useState<ConnectionProfile | null>(null) // Prompt for managed identity
    const [managedPath, setManagedPath] = useState('')

    const normalizePath = (p: string) => p.replace(/\\/g, '/').toLowerCase()

    // Load profiles on mount
    const refreshProfiles = async () => {
        try {
            const list = await ListProfiles()
            const hasPass = await HasMasterPassword()
            const premium = await IsPremium()
            setHasPassword(hasPass)
            setIsPremium(premium)

            if (premium) {
                GetManagedIdentityPath().then(setManagedPath).catch(console.error)
            }

            // sort by lastUsed desc
            list.sort((a: ConnectionProfile, b: ConnectionProfile) => b.lastUsed - a.lastUsed)
            setProfiles(list)
            if (!selectedId && list.length > 0) {
                setSelectedId(list[0].id || null)
            }
        } catch (e) {
            console.error('Failed to list profiles', e)
        }
    }

    useEffect(() => { refreshProfiles() }, [])

    const handleSave = async (p: ConnectionProfile) => {
        try {
            // Ensure ID is string to match Wails model
            const validP = { ...p, id: p.id || "" }
            // @ts-ignore - mismatch between local and wails types
            await SaveProfile(validP)
            setEditing(false)
            refreshProfiles()
        } catch (e: any) {
            alert('Failed to save profile: ' + e.message)
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm(t('delete_confirm'))) return
        try {
            await DeleteProfile(id)
            refreshProfiles()
            if (selectedId === id) setSelectedId(null)
        } catch (e: any) {
            alert('Delete failed: ' + e.message)
        }
    }

    useEffect(() => {
        // Listen for backend connection status updates
        // @ts-ignore
        window.runtime.EventsOn("connection-status", (msg: string) => {
            if (loading) {
                // If msg matches a key, translate it
                const key = `status_${msg.toLowerCase().replace(' ', '_')}` as any
                setStatus(t(key) || msg)
            }
        })
        return () => {
        }
    }, [loading, t])

    const handleConnect = async (p: ConnectionProfile) => {
        setLoading(true)
        setStatus(t('initializing_connection'))
        setErrorWin(null)

        try {
            // Map to backend TunnelProfile requirements
            const backendProfile = {
                user: p.user,
                host: p.host,
                localPort: p.localPort,
                remoteHost: 'localhost',
                remotePort: 8443,
                identityFile: p.identityFile,
                extraArgs: [...(p.extraArgs || [])]
            }

            // Handle non-standard SSH port via extra args
            if (p.port && p.port !== 22) {
                backendProfile.extraArgs.push('-p', String(p.port))
            }

            const pStr = JSON.stringify(backendProfile)

            // Update LastUsed
            p.lastUsed = Math.floor(Date.now() / 1000)
            const validP = { ...p, id: p.id || "" }
            // @ts-ignore
            SaveProfile(validP)
            refreshProfiles()

            // Unified Flow: StartTunnelWithProfile handles all logic (Detect -> Deploy -> Connect)
            const res = await StartTunnelWithProfile(pStr)

            if (res === 'started' || res.startsWith('started:')) {
                setStatus(t('status_connected'))

                let token = undefined;
                if (res.startsWith('started:')) {
                    token = res.substring(8);
                }

                try {
                    // Update metadata
                    // @ts-ignore
                    const osArch = await DetectRemoteOS(pStr)
                    // @ts-ignore
                    const ver = await CheckRemoteVersion(pStr)

                    if (osArch) {
                        const [os, arch] = osArch.split(' ')
                        p.remoteOS = os
                        p.remoteArch = arch
                    }
                    if (ver) p.remoteVersion = ver

                    const validP = { ...p, id: p.id || "" }
                    // @ts-ignore
                    SaveProfile(validP)
                    refreshProfiles()
                } catch (e) {
                    console.error("Failed to update metadata", e)
                }

                onConnected({
                    user: p.user, host: p.host, localPort: p.localPort, remoteHost: 'localhost', remotePort: 8443,
                    identityFile: p.identityFile, extraArgs: p.extraArgs,
                    remoteOS: p.remoteOS, remoteArch: p.remoteArch, remoteVersion: p.remoteVersion,
                    id: p.id, color: p.color
                }, token)
            } else {
                // Check if it's an auth error
                if (res.toLowerCase().includes('permission denied') || res.toLowerCase().includes('publickey')) {
                    setPromptDeploy(p)
                    setStatus('')
                } else if (res === 'unknown-host') {
                    alert(t('error_unknown_host'))
                    setStatus('')
                } else {
                    alert(t('status_failed') + ": " + res)
                }
            }

        } catch (e: any) {
            console.error("Connection failed", e)
            const msg = (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)).toLowerCase()
            if (msg.includes('permission denied') || msg.includes('publickey')) {
                setPromptDeploy(p)
                setStatus('')
            } else if (msg.includes('unknown-host')) {
                alert(t('error_unknown_host'))
                setStatus('')
            } else if (msg.includes('ssh-unreachable')) {
                alert(t('error_unreachable'))
                setStatus('')
            } else {
                setStatus(t('status_failed') + ': ' + (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)))
            }
        } finally {
            setLoading(false)
        }
    }

    const onDeployKey = async (password: string) => {
        if (!promptDeploy) return
        setDeployLoading(true)
        try {
            await DeploySSHKey({
                host: promptDeploy.host,
                user: promptDeploy.user,
                port: promptDeploy.port || 22,
                password: password,
                identityFile: promptDeploy.identityFile
            })
            // Success! Clear prompt and retry
            const p = promptDeploy
            setPromptDeploy(null)
            handleConnect(p)
        } catch (e: any) {
            alert(t('status_failed') + ": " + (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)))
        } finally {
            setDeployLoading(false)
        }
    }

    const onSetupManagedIdentity = async (password: string) => {
        if (!promptManaged) return
        setDeployLoading(true)
        try {
            // @ts-ignore
            const privateKeyPath = await SetupManagedIdentity({
                host: promptManaged.host,
                user: promptManaged.user,
                port: promptManaged.port || 22,
                password: password,
                identityFile: "" // Not relevant for this call
            })

            // Success! Update profile to use this identity and clear password
            // We'll update the profile object in memory and save it
            // NOTE: We might want to save it as "Managed Identity" (or path)
            promptManaged.identityFile = privateKeyPath
            // We should ensure we don't save the password if we had one (we don't save passwords anyway)

            // Save updated profile
            const validP = { ...promptManaged, id: promptManaged.id || "" }
            // @ts-ignore
            await SaveProfile(validP)

            // Clear prompt first
            setPromptManaged(null)

            // Refresh list
            refreshProfiles()

            // Auto connect with new key
            handleConnect(promptManaged)

        } catch (e: any) {
            alert(t('status_failed') + ": " + (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)))
        } finally {
            setDeployLoading(false)
        }
    }

    const selectedProfile = profiles.find(p => p.id === selectedId)

    const isManaged = selectedProfile && normalizePath(selectedProfile.identityFile || '') === normalizePath(managedPath || '') && managedPath !== ''

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-root)', color: 'var(--text-primary)', cursor: loading ? 'wait' : 'default' }}>
            {/* Sidebar */}
            <div style={{
                width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
                background: 'var(--bg-panel)',
                opacity: loading ? 0.6 : 1,
                pointerEvents: loading ? 'none' : 'auto'
            }}>
                <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>
                        {t('connections')}
                        {isPremium && <span style={{ fontSize: 10, color: '#f7b955', marginLeft: 8, border: '1px solid #f7b955', borderRadius: 4, padding: '1px 4px' }}>PRO</span>}
                    </h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="link icon-btn" onClick={() => setShowAbout(true)} title={t('about')}>
                            <Icon name="icon-info" size={16} />
                        </button>
                        {onOpenSettings && (
                            <button className="link icon-btn" onClick={onOpenSettings} title={t('settings')}>
                                <Icon name="icon-settings" size={16} />
                            </button>
                        )}
                        <button className="link icon-btn" onClick={() => { setSelectedId(null); setEditing(true) }} title={t('new_connection')}>
                            <Icon name="icon-plus" size={16} />
                        </button>
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 8, minHeight: 0 }}>
                    {profiles.map(p => (
                        <div key={p.id}
                            onClick={() => { setSelectedId(p.id!); setEditing(false) }}
                            style={{
                                padding: '10px 12px', marginBottom: 4, borderRadius: 6,
                                background: selectedId === p.id ? 'var(--bg-select)' : 'transparent',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10
                            }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || '#666' }} />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                <div className="muted" style={{ fontSize: 11 }}>
                                    {p.user}@{p.host}
                                    {p.remoteOS && <span style={{ marginLeft: 6, opacity: 0.8 }}> • {p.remoteOS} {p.remoteVersion && `v${p.remoteVersion}`}</span>}
                                </div>
                            </div>
                            <div className="muted" style={{ fontSize: 10, minWidth: 60, textAlign: 'right' }}>
                                {p.lastUsed > 0 ? (() => {
                                    const diff = Math.floor(Date.now() / 1000) - p.lastUsed
                                    if (diff < 60) return t('just_now')
                                    if (diff < 3600) return `${Math.floor(diff / 60)}${t('minutes_ago')}`
                                    if (diff < 86400) return `${Math.floor(diff / 3600)}${t('hours_ago')}`
                                    return `${Math.floor(diff / 86400)}${t('days_ago')}`
                                })() : ''}
                            </div>
                            <button className="icon-btn link" style={{ opacity: 0.5 }} onClick={(e) => handleDelete(p.id!, e)}>
                                <Icon name="icon-trash" size={14} />
                            </button>
                        </div>
                    ))}
                    {profiles.length === 0 && (
                        <div className="muted" style={{ textAlign: 'center', padding: 20 }}>{t('no_saved_connections')}</div>
                    )}
                </div>
                <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                    {hasPassword && (
                        <button onClick={onLocked} className="btn" style={{ width: '100%', justifyContent: 'center' }}>
                            <span style={{ marginRight: 8, display: 'flex' }}><Icon name="icon-lock" size={14} /></span> {t('lock_app')}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', position: 'relative',
                backgroundImage: 'url(/startup_hero.png)', backgroundSize: 'cover', backgroundPosition: 'center'
            }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(0px)' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.95), rgba(22, 27, 34, 0.8))' }} />

                <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {editing || !selectedId ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '100%', maxWidth: 500 }}>
                                <ProfileEditor
                                    profile={selectedProfile}
                                    onSave={handleSave}
                                    onCancel={() => { setEditing(false); if (profiles.length > 0) setSelectedId(profiles[0].id!) }}
                                    isPremium={isPremium}
                                />
                            </div>
                        </div>
                    ) : selectedProfile ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
                            <div style={{ marginBottom: 32, transform: 'scale(1.5)' }}>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: selectedProfile.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', color: 'white', border: '2px solid rgba(255,255,255,0.1)' }}>
                                    <Icon name="icon-server" size={32} />
                                </div>
                            </div>
                            <h1 style={{ margin: '0 0 8px 0', textShadow: '0 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}>{selectedProfile.name}</h1>
                            <div className="muted" style={{ fontSize: 16, marginBottom: 32, color: 'rgba(255,255,255,0.7)' }}>
                                {selectedProfile.user}@{selectedProfile.host}
                                {isManaged && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 12, background: 'rgba(56, 139, 253, 0.2)', color: '#58a6ff', padding: '2px 8px', borderRadius: 10, fontSize: 11, border: '1px solid rgba(56, 139, 253, 0.3)' }}>
                                        <Icon name="icon-lock" size={10} />
                                        <span>Managed</span>
                                    </div>
                                )}
                            </div>

                            {status && (
                                <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ color: '#ff7b72', background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: 100 }}>
                                        {status === t('status_connecting') ? <span style={{ color: 'var(--text-primary)' }}>{status}</span> : status}
                                    </div>

                                    {(status.includes(t('status_failed')) || status.includes('Failed') || status.includes('Error')) && (
                                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <button
                                                onClick={async () => {
                                                    // @ts-ignore
                                                    const selectedProfileId = selectedId; // Fix connection tester usage
                                                    if (selectedProfileId) {
                                                        const p = profiles.find(pr => pr.id === selectedProfileId)
                                                        if (p) await testConnection(p)
                                                    }
                                                }}
                                                className="btn link"
                                                style={{ color: 'var(--accent)', fontSize: '0.9rem', padding: 0, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none' }}
                                            >
                                                {isTesting ? t('status_checking') : t('test_connection')}
                                            </button>
                                            {testStatus && (
                                                <div style={{ fontSize: '0.8rem', marginTop: 4, color: testStatus.includes(t('connection_ok')) ? '#7ee787' : 'var(--text-muted)' }}>
                                                    {testStatus}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 16 }}>
                                <button className="btn primary" style={{ padding: '12px 32px', fontSize: 16, boxShadow: '0 4px 12px rgba(0,123,255,0.3)' }} onClick={() => handleConnect(selectedProfile)} disabled={loading}>
                                    {loading ? t('connecting') : t('connect')}
                                </button>
                                <button className="btn" style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} onClick={() => setEditing(true)} disabled={loading}>
                                    {t('edit')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="muted">
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 24px', borderRadius: 100, backdropFilter: 'blur(4px)', color: 'rgba(255,255,255,0.6)' }}>
                                {t('select_or_create')}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
            {promptDeploy && (
                <PasswordDialog
                    title={t('master_password')}
                    description={t('deploy_key_msg')}
                    onConfirm={onDeployKey}
                    onCancel={() => setPromptDeploy(null)}
                    loading={deployLoading}
                    isPremium={isPremium}
                    onUseManagedIdentity={() => {
                        setPromptManaged(promptDeploy)
                        setPromptDeploy(null)
                    }}
                />
            )}
            {promptManaged && (
                <PasswordDialog
                    title={t('setup_secure_access')}
                    description={t('setup_managed_key_msg') || "Enter your SSH password one last time. We will generate a secure key and configure the server for password-less access."}
                    onConfirm={onSetupManagedIdentity}
                    onCancel={() => setPromptManaged(null)}
                    loading={deployLoading}
                />
            )}
        </div>
    )
}
