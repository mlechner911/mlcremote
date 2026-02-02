import React from 'react'
import { Icon } from '../generated/icons'
import { useI18n } from '../utils/i18n'
import { ConnectionProfile } from '../types'

interface ConnectionSidebarProps {
    profiles: ConnectionProfile[]
    stats?: Record<string, import('../types').Stats>
    selectedId: string | null
    onSelect: (id: string) => void
    onEdit: (isNew: boolean) => void
    onNewConnection: () => void
    onOpenSettings: () => void
    onShowAbout: () => void
    onDelete: (id: string, e: React.MouseEvent) => void
    onLock: () => void
    hasPassword: boolean
    isPremium: boolean
    loading: boolean
}

export default function ConnectionSidebar({
    profiles, stats, selectedId, onSelect, onNewConnection, onOpenSettings, onShowAbout, onDelete, onLock,
    hasPassword, isPremium, loading
}: ConnectionSidebarProps) {
    const { t } = useI18n()

    return (
        <div style={{
            width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
            background: 'var(--bg-panel)',
            opacity: loading ? 0.6 : 1,
            pointerEvents: loading ? 'none' : 'auto'
        }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>
                    {t('connections')}
                    {isPremium && <span style={{ fontSize: 10, color: '#f7b955', marginLeft: 8, border: '1px solid #f7b955', borderRadius: 4, padding: '1px 4px', textShadow: '0 0 1px rgba(0,0,0,0.5)' }}>PRO</span>}
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="link icon-btn" onClick={onShowAbout} title={t('about')}>
                        <Icon name="icon-info" size={16} />
                    </button>
                    {onOpenSettings && (
                        <button className="link icon-btn" onClick={onOpenSettings} title={t('settings')}>
                            <Icon name="icon-settings" size={16} />
                        </button>
                    )}
                    <button className="link icon-btn" onClick={onNewConnection} title={t('new_connection')}>
                        <Icon name="icon-plus" size={16} />
                    </button>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8, minHeight: 0 }}>
                {profiles.map(p => {
                    const stat = stats?.[p.id!]
                    const isHealthy = stat && stat.cpu < 90 && stat.memory < 90 && stat.disk < 90 // simple threshold
                    // Check freshness? timestamp is unix seconds
                    const isFresh = stat && (Date.now() / 1000 - stat.timestamp) < (p.monitoring?.interval || 10) * 60 + 300 // interval + buffer

                    return (
                        <div key={p.id}
                            onClick={() => onSelect(p.id!)}
                            style={{
                                padding: '10px 12px', marginBottom: 4, borderRadius: 6,
                                background: selectedId === p.id ? 'var(--bg-select)' : 'transparent',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10
                            }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || '#666' }} />
                                {p.monitoring?.enabled && (
                                    <div style={{
                                        position: 'absolute', bottom: -5, right: -5,
                                        background: 'var(--bg-panel)',
                                        borderRadius: '50%',
                                        padding: 2,
                                        boxShadow: '0 0 0 1px var(--bg-panel)'
                                    }}>
                                        {(() => {
                                            if (!isFresh) {
                                                return <div title={t('stale_data_tooltip', 'Stale Data (Server may be down)')} style={{ color: 'var(--text-muted)' }}><Icon name="icon-warning" size={14} /></div>
                                            }
                                            if (isHealthy) {
                                                return <div style={{ color: '#10b981', filter: 'drop-shadow(0 0 1px rgba(16,185,129,0.3))' }} title={t('all_systems_healthy', 'All Systems Healthy')}><Icon name="icon-check" size={14} /></div>
                                            }
                                            // Determine max usage
                                            const max = Math.max(stat?.cpu || 0, stat?.memory || 0, stat?.disk || 0)
                                            let label = ''
                                            let color = '#f59e0b' // orange
                                            if (max > 90) color = '#ef4444' // red

                                            if ((stat?.cpu || 0) === max) label = t('cpu', 'CPU')
                                            else if ((stat?.memory || 0) === max) label = t('ram', 'RAM')
                                            else label = t('disk_short', 'DSK') // disk

                                            return (
                                                <div style={{
                                                    fontSize: 10, fontWeight: 700, color: '#fff',
                                                    background: color, padding: '1px 4px', borderRadius: 4,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: '0 0 0 1px var(--bg-panel)'
                                                }} title={t('high_usage_tooltip', { label, value: max.toFixed(0) })}>
                                                    {label}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                )}
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                <div className="muted" style={{ fontSize: 11 }}>
                                    {p.user}@{p.host}
                                    {p.remoteOS && (
                                        <span style={{ marginLeft: 6, opacity: 0.8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            {(() => {
                                                const os = p.remoteOS.toLowerCase()
                                                let icon = ''
                                                if (os.includes('windows')) icon = 'icon-os-windows'
                                                else if (os.includes('darwin') || os.includes('macos') || os.includes('apple')) icon = 'icon-os-apple'
                                                else if (os.includes('ubuntu') || os.includes('linux')) icon = 'icon-os-ubuntu' // Fallback to ubuntu for general linux for now? Or maybe a generic terminal icon if not found

                                                if (icon) return <Icon name={icon} size={12} />
                                                return null
                                            })()}
                                            {p.remoteOS} {p.remoteVersion && `v${p.remoteVersion}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="muted" style={{ fontSize: 10, minWidth: 60, textAlign: 'right' }}>
                                {p.lastUsed > 0 ? (() => {
                                    const diff = Math.floor(Date.now() / 1000) - p.lastUsed
                                    if (diff < 60) return t('just_now')
                                    if (diff < 3600) return t('minutes_ago', { val: Math.floor(diff / 60) })
                                    if (diff < 86400) return t('hours_ago', { val: Math.floor(diff / 3600) })
                                    return t('days_ago', { val: Math.floor(diff / 86400) })
                                })() : ''}
                            </div>
                            <button className="icon-btn link muted-icon" onClick={(e) => onDelete(p.id!, e)}>
                                <Icon name="icon-trash" size={14} />
                            </button>
                        </div>
                    )
                })}
                {profiles.length === 0 && (
                    <div className="muted" style={{ textAlign: 'center', padding: 20 }}>{t('no_saved_connections')}</div>
                )}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                {hasPassword && (
                    <button onClick={onLock} className="btn" style={{ width: '100%', justifyContent: 'center' }}>
                        <span style={{ marginRight: 8, display: 'flex' }}><Icon name="icon-lock" size={14} /></span> {t('lock_app')}
                    </button>
                )}
            </div>
        </div >
    )
}
