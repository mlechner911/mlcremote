import React from 'react'
import { Icon } from '../generated/icons'
import { useI18n } from '../utils/i18n'
import { ConnectionProfile } from '../types'

interface ConnectionDetailProps {
    profile: ConnectionProfile
    status: string
    isManaged: boolean
    loading: boolean
    onConnect: (task?: any) => void
    onEdit: () => void
    onTest: () => void
    isTesting: boolean
    testStatus: string | null
}

export default function ConnectionDetail({
    profile, status, isManaged, loading, onConnect, onEdit, onTest, isTesting, testStatus
}: ConnectionDetailProps) {
    const { t } = useI18n()

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
            <div style={{ marginBottom: 32, transform: 'scale(1.5)' }}>
                <div className={`${loading ? 'pulse-ring ' : ''}connection-icon`} style={{ width: 64, height: 64, borderRadius: '50%', background: profile.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: 'white' }}>
                    <Icon name="icon-server" size={32} />
                </div>
            </div>
            <h1 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{profile.name}</h1>
            <div className="muted" style={{ fontSize: 16, marginBottom: 32, color: 'var(--text-muted)' }}>
                {profile.user}@{profile.host}
                {isManaged && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 12, background: 'rgba(56, 139, 253, 0.2)', color: '#58a6ff', padding: '2px 8px', borderRadius: 10, fontSize: 11, border: '1px solid rgba(56, 139, 253, 0.3)' }}>
                        <Icon name="icon-lock" size={10} />
                        <span>Managed</span>
                    </div>
                )}
            </div>

            {status && (
                <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className={`status-pill ${status.toLowerCase().includes('failed') || status.toLowerCase().includes('error') ? 'error' : ''}`}>
                        {status}
                    </div>

                    {(status.includes(t('status_failed')) || status.includes('Failed') || status.includes('Error')) && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <button
                                onClick={onTest}
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
                <button className="btn primary" style={{ padding: '12px 32px', fontSize: 16, boxShadow: '0 4px 12px rgba(0,123,255,0.3)' }} onClick={() => onConnect()} disabled={loading}>
                    {loading ? t('connecting') : t('connect')}
                </button>
                <button className="btn" style={{ padding: '12px 24px' }} onClick={onEdit} disabled={loading}>
                    {t('edit')}
                </button>
            </div>

            {/* Startup Tasks */}
            {profile.tasks && profile.tasks.some(t => t.showOnLaunch) && (
                <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t('startup_tasks') || 'Quick Actions'}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {profile.tasks.filter(t => t.showOnLaunch).map(task => (
                            <button
                                key={task.id}
                                className="btn"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border)',
                                    color: task.color || 'var(--text-primary)'
                                }}
                                onClick={() => onConnect(task)}
                                disabled={loading}
                            >
                                <div style={{
                                    width: 16, height: 16, borderRadius: '50%',
                                    background: task.color, color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, fontWeight: 'bold'
                                }}>
                                    {task.icon && task.icon.length === 1 ? task.icon : <Icon name={`icon-${task.icon}`} size={10} />}
                                </div>
                                {task.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
