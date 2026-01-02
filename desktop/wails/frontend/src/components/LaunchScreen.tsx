import React, { useEffect, useState } from 'react'
import {
    ListProfiles, SaveProfile, DeleteProfile,
    StartTunnelWithProfile
} from '../wailsjs/go/app/App'
import { Icon } from '../generated/icons'
import ProfileEditor, { ConnectionProfile } from './ProfileEditor'
import { Profile } from '../App' // Legacy Profile type if needed, but we use ConnectionProfile mostly

interface LaunchScreenProps {
    onConnected: (p: Profile) => void
    onLocked?: () => void
}

export default function LaunchScreen({ onConnected, onLocked }: LaunchScreenProps) {
    const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [editing, setEditing] = useState(false)
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState('')
    const [errorWin, setErrorWin] = useState<string | null>(null) // For Windows install prompt

    // Load profiles on mount
    const refreshProfiles = async () => {
        try {
            const list = await ListProfiles()
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
        if (!confirm('Are you sure you want to delete this profile?')) return
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
            if (loading) setStatus(msg)
        })
        return () => {
            // Cleanup? Wails runtime doesn't always expose easy off for specific handlers without cleanup function
        }
    }, [loading])

    const handleConnect = async (p: ConnectionProfile) => {
        setLoading(true)
        setStatus('Initializing connection...')
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

            if (res === 'started') {
                setStatus('Connected!')
                onConnected({
                    user: p.user, host: p.host, localPort: p.localPort, remoteHost: 'localhost', remotePort: 8443,
                    identityFile: p.identityFile, extraArgs: p.extraArgs
                })
            } else {
                alert("Failed to start tunnel: " + res)
            }

        } catch (e: any) {
            console.error("Connection failed", e)
            setStatus('Error: ' + (e?.message || String(e)))
        } finally {
            setLoading(false)
        }
    }

    const selectedProfile = profiles.find(p => p.id === selectedId)

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-root)', color: 'var(--text-primary)' }}>
            {/* Sidebar */}
            <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
                <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Connections</h3>
                    <button className="link icon-btn" onClick={() => { setSelectedId(null); setEditing(true) }} title="New Connection">
                        <Icon name="icon-plus" size={16} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
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
                                <div className="muted" style={{ fontSize: 11 }}>{p.user}@{p.host}</div>
                            </div>
                            <button className="icon-btn link" style={{ opacity: 0.5 }} onClick={(e) => handleDelete(p.id!, e)}>
                                <Icon name="icon-trash" size={14} />
                            </button>
                        </div>
                    ))}
                    {profiles.length === 0 && (
                        <div className="muted" style={{ textAlign: 'center', padding: 20 }}>No saved connections</div>
                    )}
                </div>
                <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                    {onLocked && (
                        <button onClick={onLocked} className="btn" style={{ width: '100%', justifyContent: 'center' }}>
                            <span style={{ marginRight: 8, display: 'flex' }}><Icon name="icon-lock" size={14} /></span> Lock App
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {editing || !selectedId ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '100%', maxWidth: 500 }}>
                            <ProfileEditor
                                profile={selectedProfile}
                                onSave={handleSave}
                                onCancel={() => { setEditing(false); if (profiles.length > 0) setSelectedId(profiles[0].id!) }}
                            />
                        </div>
                    </div>
                ) : selectedProfile ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
                        <div style={{ marginBottom: 32, transform: 'scale(1.5)' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: selectedProfile.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', color: 'white' }}>
                                <Icon name="icon-server" size={32} />
                            </div>
                        </div>
                        <h1 style={{ margin: '0 0 8px 0' }}>{selectedProfile.name}</h1>
                        <div className="muted" style={{ fontSize: 16, marginBottom: 32 }}>{selectedProfile.user}@{selectedProfile.host}</div>

                        {status && <div style={{ marginBottom: 20, color: 'var(--accent)' }}>{status}</div>}

                        {errorWin && (
                            <div style={{ background: '#3a1c1c', border: '1px solid #751b1b', color: '#ffadad', padding: 16, borderRadius: 6, marginBottom: 20, maxWidth: 400, textAlign: 'left' }}>
                                <strong>{errorWin}</strong>
                                <p style={{ fontSize: 13, marginTop: 8 }}>
                                    To allow remote connections, please download and run the
                                    <code>MLCRemote-Service.exe</code> on the Windows host.
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button className="btn primary" style={{ padding: '12px 32px', fontSize: 16 }} onClick={() => handleConnect(selectedProfile)} disabled={loading}>
                                {loading ? 'Connecting...' : 'Connect'}
                            </button>
                            <button className="btn" style={{ padding: '12px 24px' }} onClick={() => setEditing(true)} disabled={loading}>
                                Edit
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="muted">
                        Select a connection or create a new one
                    </div>
                )}
            </div>
        </div>
    )
}
