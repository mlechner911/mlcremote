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
}

export default function StatusBar({ health, isOnline, hideMemoryUsage, lastHealthAt }: Props) {
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
                                <span title={`OS: ${health.os} ${health.distro || ''}`}>{health.distro || health.os}</span>
                            </>
                        )}
                        <span className="sep" />
                        <span title={t('server_time', 'Server Time')}>{health.server_time ? new Date(health.server_time).toLocaleTimeString() : ''}</span>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={`System Memory: ${formatBytes(used)} / ${formatBytes(total)}`}>
                                <span>Mem:</span>
                                <div style={{ width: 50, height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${pct}%`,
                                        height: '100%',
                                        background: pct > 80 ? '#ef4444' : '#10b981'
                                    }} />
                                </div>
                                <span>{pct}%</span>
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
