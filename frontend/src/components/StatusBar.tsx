import React from 'react'
import { Health } from '../api'
import { formatBytes } from '../utils/bytes'
import { Icon } from '../generated/icons'
import { useTranslation } from 'react-i18next'

type Props = {
    health: Health | null
    isOnline: boolean
    hideMemoryUsage: boolean
    lastHealthAt: number | null | undefined
    isSidebarCollapsed?: boolean
    onToggleSidebar?: () => void
}

export default function StatusBar({ health, isOnline, hideMemoryUsage, lastHealthAt, isSidebarCollapsed, onToggleSidebar }: Props) {
    const { t } = useTranslation()
    const [now, setNow] = React.useState<Date>(new Date())

    React.useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 1000)
        return () => window.clearInterval(id)
    }, [])

    return (
        <div className="status-bar" style={{
            height: 24,
            background: 'var(--bg-alt)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            fontSize: 12,
            color: 'var(--text-muted)',
            justifyContent: 'space-between',
            userSelect: 'none'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Connection Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={lastHealthAt ? `${t('last_checked', 'Last checked')}: ${new Date(lastHealthAt).toLocaleTimeString()}` : ''}>
                    {isSidebarCollapsed && onToggleSidebar && (
                        <button
                            onClick={onToggleSidebar}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                padding: '0 4px',
                                display: 'flex',
                                alignItems: 'center',
                                marginRight: 4
                            }}
                            title="Show Sidebar"
                        >
                            <Icon name="icon-menu" size={14} />
                        </button>
                    )}
                    <span style={{
                        width: 8, height: 8, borderRadius: 4,
                        background: health && health.host ? '#10b981' : (isOnline ? '#f59e0b' : '#ef4444')
                    }} />
                    <span>{health && health.host ? health.host : (isOnline ? t('connecting') : t('offline', 'Offline'))}</span>
                </div>

                {/* Online Status */}
                <span className={isOnline ? 'ok' : 'err'} title={isOnline ? t('status_connected') : t('disconnected')}>
                    <Icon name="icon-circle-filled" size={10} /> {isOnline ? t('online', 'Online') : t('offline', 'Offline')}
                </span>
                {health && (
                    <>
                        <span className="sep" />
                        <span title={`PID: ${health.pid}`}>Host: {health.host || 'localhost'}</span>
                        {health.os && (
                            <>
                                <span className="sep" />
                                {(() => {
                                    const os = (health.os || '').toLowerCase()
                                    let icon = ''
                                    if (os.includes('windows')) icon = 'icon-os-windows'
                                    else if (os.includes('darwin') || os.includes('macos') || os.includes('apple')) icon = 'icon-os-apple'
                                    else if (os.includes('ubuntu') || os.includes('linux')) icon = 'icon-os-ubuntu'

                                    return (
                                        <span title={`OS: ${health.os} ${health.distro || ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {icon && <Icon name={icon} size={12} />}
                                            {health.distro || health.os}
                                        </span>
                                    )
                                })()}
                            </>
                        )}

                        <span className="sep" />
                        <span title={t('connected_since', 'Connected since')}>{t('connected_since', 'Connected since')}: {health.start_time} {health.timezone}</span>
                    </>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Memory Usage */}
                {!hideMemoryUsage && health && health.sys_mem_total_bytes ? (
                    (() => {
                        const total = health.sys_mem_total_bytes || 1
                        const free = health.sys_mem_free_bytes || 0
                        const used = total - free
                        const pct = Math.round((used / total) * 100)
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={`System Memory: ${formatBytes(used)} / ${formatBytes(total)} (${pct}%)`}>
                                <div style={{
                                    width: 32, height: 14,
                                    background: 'var(--bg-panel)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 3,
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${pct}%`,
                                        height: '100%',
                                        background: pct > 85 ? '#ef4444' : (pct > 60 ? '#f59e0b' : '#3b82f6'),
                                        transition: 'width 0.5s ease'
                                    }} />
                                    {/* Mini text overlay */}
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 9, fontWeight: 700, color: 'var(--text)',
                                        textShadow: '0 0 2px var(--bg)'
                                    }}>
                                        {pct}%
                                    </div>
                                </div>
                            </div>
                        )
                    })()
                ) : null}

                {/* Clock */}
                <div title={now.toLocaleDateString()}>
                    {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(now)}
                </div>
            </div>
        </div>
    )
}
