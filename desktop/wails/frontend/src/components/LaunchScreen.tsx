import React, { useEffect, useState } from 'react'
import {
    ListProfiles, SaveProfile, DeleteProfile,
    StartTunnelWithProfile, DetectRemoteOS, CheckRemoteVersion
} from '../wailsjs/go/app/App'
import { Icon } from '../generated/icons'
import ProfileEditor, { ConnectionProfile } from './ProfileEditor'
import { Profile } from '../App' // Legacy Profile type if needed, but we use ConnectionProfile mostly

import { useI18n } from '../utils/i18n'

interface LaunchScreenProps {
    onConnected: (p: Profile) => void
    onLocked?: () => void
    onOpenSettings?: () => void
}

export default function LaunchScreen({ onConnected, onLocked, onOpenSettings }: LaunchScreenProps) {
    const { t } = useI18n()
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

            if (res === 'started') {
                setStatus(t('status_connected'))

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
                    id: p.id
                })
            } else {
                alert(t('status_failed') + ": " + res)
            }

        } catch (e: any) {
            console.error("Connection failed", e)
            setStatus(t('status_failed') + ': ' + (e?.message || String(e)))
        } finally {
            setLoading(false)
        }
    }

    const selectedProfile = profiles.find(p => p.id === selectedId)

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
                    <h3 style={{ margin: 0 }}>{t('connections')}</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
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
                    {onLocked && (
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
                            <div className="muted" style={{ fontSize: 16, marginBottom: 32, color: 'rgba(255,255,255,0.7)' }}>{selectedProfile.user}@{selectedProfile.host}</div>

                            {status && <div style={{ marginBottom: 20, color: '#ff7b72', background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: 100 }}>{status}</div>}

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
        </div>
    )
}
