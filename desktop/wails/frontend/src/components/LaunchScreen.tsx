import React, { useEffect, useState } from 'react'
import {
    ListProfiles, SaveProfile, DeleteProfile,
    StartTunnelWithProfile, HasMasterPassword, DetectRemoteOS, CheckRemoteVersion, DeploySSHKey,
    IsPremium, SetupManagedIdentity, GetManagedIdentityPath, GetRemoteSession, KillRemoteSession
} from '../wailsjs/go/app/App'
import { useConnectionTester } from '../hooks/useConnectionTester'
import ProfileEditor, { ConnectionProfile } from './ProfileEditor'
import SessionDialog, { SessionInfo } from './SessionDialog'
import { Profile } from '../App' // Legacy Profile type if needed, but we use ConnectionProfile mostly
import { useI18n } from '../utils/i18n'
import PasswordDialog from './PasswordDialog'
import AboutDialog from './AboutDialog'
import ConnectionSidebar from './ConnectionSidebar'
import ConnectionDetail from './ConnectionDetail'

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
    const [promptSession, setPromptSession] = useState<{ p: ConnectionProfile, info: SessionInfo } | null>(null)


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

    const performConnect = async (p: ConnectionProfile) => {
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
                extraArgs: [...(p.extraArgs || [])],
                mode: p.mode
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
                let actualPort = p.localPort || 8443;

                if (res.startsWith('started:')) {
                    const parts = res.split(':');
                    if (parts.length === 3) {
                        // started:PORT:TOKEN
                        actualPort = parseInt(parts[1], 10);
                        token = parts[2];
                    } else {
                        // Legacy started:TOKEN
                        token = res.substring(8);
                    }
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
                    user: p.user, host: p.host, localPort: actualPort, remoteHost: 'localhost', remotePort: 8443,
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

    const handleConnect = async (p: ConnectionProfile) => {
        // First check for existing session
        setLoading(true)
        setStatus(t('status_checking'))
        try {
            const backendProfile = {
                user: p.user, host: p.host, localPort: p.localPort, remoteHost: 'localhost', remotePort: 8443,
                identityFile: p.identityFile, extraArgs: [...(p.extraArgs || [])]
            }
            if (p.port && p.port !== 22) backendProfile.extraArgs.push('-p', String(p.port))

            // @ts-ignore
            const info = await GetRemoteSession(JSON.stringify(backendProfile))

            if (info && info.running && info.token) {
                // Session found!
                setPromptSession({ p, info })
                setLoading(false)
                return
            }
        } catch (e) {
            console.error("Failed to check session, proceeding to connect", e)
        }

        // If no session or error, just connect
        performConnect(p)
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
            <ConnectionSidebar
                profiles={profiles}
                selectedId={selectedId}
                onSelect={(id) => { setSelectedId(id); setEditing(false) }}
                onNewConnection={() => { setSelectedId(null); setEditing(true) }}
                onOpenSettings={onOpenSettings}
                onShowAbout={() => setShowAbout(true)}
                onDelete={handleDelete}
                onLock={onLocked}
                hasPassword={hasPassword}
                isPremium={isPremium}
                loading={loading}
                // @ts-ignore - implicit edit logic
                onEdit={() => { }}
            />

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
                        <ConnectionDetail
                            profile={selectedProfile}
                            status={status}
                            isManaged={isManaged || false} // handle potential null return from check
                            loading={loading}
                            onConnect={() => handleConnect(selectedProfile)}
                            onEdit={() => setEditing(true)}
                            onTest={() => testConnection(selectedProfile)}
                            isTesting={isTesting}
                            testStatus={testStatus}
                        />
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
            {promptSession && (
                <SessionDialog
                    info={promptSession.info}
                    onJoin={() => {
                        const p = promptSession.p
                        setPromptSession(null)
                        performConnect(p)
                    }}
                    onRestart={async () => {
                        const p = promptSession.p
                        setPromptSession(null)
                        setLoading(true)
                        setStatus(t('restart_session'))
                        try {
                            const backendProfile = {
                                user: p.user, host: p.host, localPort: p.localPort, remoteHost: 'localhost', remotePort: 8443,
                                identityFile: p.identityFile, extraArgs: [...(p.extraArgs || [])]
                            }
                            if (p.port && p.port !== 22) backendProfile.extraArgs.push('-p', String(p.port))

                            // @ts-ignore
                            await KillRemoteSession(JSON.stringify(backendProfile))
                            // Now connect
                            performConnect(p)
                        } catch (e: any) {
                            const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)
                            alert(t('status_failed') + ": " + msg)
                            setLoading(false)
                        }
                    }}
                    onStartParallel={() => {
                        const p = promptSession.p
                        // Force parallel mode
                        const parallelP = { ...p, mode: 'parallel' }
                        performConnect(parallelP)
                        setPromptSession(null)
                    }}
                    onCancel={() => { setPromptSession(null); setLoading(false) }}
                />
            )}
            {promptDeploy && (
                <PasswordDialog
                    title={t('password')}
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
