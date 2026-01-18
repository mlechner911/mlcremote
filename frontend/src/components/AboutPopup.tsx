import React from 'react'
import { useTranslation } from 'react-i18next'
import { HealthInfo } from '../api/generated.schemas'
import { Icon } from '../generated/icons'
import { formatBytes } from '../utils/bytes'

interface AboutPopupProps {
    onClose: () => void
    health: HealthInfo | null
    lastHealthAt: number | null | undefined
}

export default function AboutPopup({ onClose, health, lastHealthAt }: AboutPopupProps) {
    const { t } = useTranslation()

    return (
        <div className="about-backdrop" onClick={onClose}>
            <div className="about-modal" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('app_title', 'MLCRemote')}</h3>
                    <button aria-label={t('close')} title={t('close')} onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <Icon name="icon-close" size={16} />
                    </button>
                </div>
                <div style={{ marginBottom: 8 }}>{t('copyright')} © {new Date().getFullYear()} Michael Lechner</div>
                <div style={{ marginBottom: 8 }}>{t('version')}: {health ? `${health.status}@${health.version}` : t('unknown')}</div>
                {health && (
                    <div style={{ maxHeight: '40vh', overflow: 'auto', background: '#0b0b0b', color: 'white', padding: 12, borderRadius: 6 }}>
                        <div><strong>{t('host')}:</strong> {health.host}</div>
                        <div><strong>{t('pid')}:</strong> {health.pid}</div>
                        <div><strong>{t('version')}:</strong> {health.version}</div>
                        <div><strong>{t('app_memory')}:</strong> {formatBytes(health.go_alloc_bytes)} ({t('alloc')}) / {formatBytes(health.go_sys_bytes)} ({t('sys')})</div>
                        <div><strong>{t('system_memory')}:</strong> {formatBytes((health.sys_mem_total_bytes || 0) - (health.sys_mem_free_bytes || 0))} / {formatBytes(health.sys_mem_total_bytes || 0)} {t('used')}</div>
                        <div><strong>{t('cpu')}:</strong> {Math.round((health.cpu_percent || 0) * 10) / 10}%</div>
                        <div style={{ marginTop: 8 }}><strong>{t('server_time')}:</strong> {health.server_time}</div>
                        <div style={{ marginTop: 4 }}><strong>{t('timezone')}:</strong> {health.timezone}</div>
                        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>{t('last_refresh')}: {lastHealthAt ? new Date(lastHealthAt).toLocaleString() : 'n/a'}</div>
                    </div>
                )}
            </div>
        </div>
    )
}
