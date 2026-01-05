import React from 'react'
import { Icon } from '../generated/icons'
import { useI18n } from '../utils/i18n'
import { ConnectionProfile } from './ProfileEditor'

interface ConnectionSidebarProps {
    profiles: ConnectionProfile[]
    selectedId: string | null
    onSelect: (id: string) => void
    onEdit: (isNew: boolean) => void // true for new, false/implicit for editing logic handled by parent usually?
    // Actually in LaunchScreen:
    // New: setSelectedId(null); setEditing(true)
    // Edit: (Handled in Detail view)
    // Sidebar just selects.

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
    profiles, selectedId, onSelect, onNewConnection, onOpenSettings, onShowAbout, onDelete, onLock,
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
                    {isPremium && <span style={{ fontSize: 10, color: '#f7b955', marginLeft: 8, border: '1px solid #f7b955', borderRadius: 4, padding: '1px 4px' }}>PRO</span>}
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
                {profiles.map(p => (
                    <div key={p.id}
                        onClick={() => onSelect(p.id!)}
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
                        <button className="icon-btn link" style={{ opacity: 0.5 }} onClick={(e) => onDelete(p.id!, e)}>
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
                    <button onClick={onLock} className="btn" style={{ width: '100%', justifyContent: 'center' }}>
                        <span style={{ marginRight: 8, display: 'flex' }}><Icon name="icon-lock" size={14} /></span> {t('lock_app')}
                    </button>
                )}
            </div>
        </div>
    )
}
