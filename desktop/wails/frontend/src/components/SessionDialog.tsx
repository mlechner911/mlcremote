import React from 'react'
import { useI18n } from '../utils/i18n'

export interface SessionInfo {
    running: boolean
    version: string
    updated: string
    token: string
}

interface SessionDialogProps {
    info: SessionInfo
    onJoin: () => void
    onRestart: () => void
    onStartParallel: () => void
    onCancel: () => void
}

export default function SessionDialog({ info, onJoin, onRestart, onStartParallel, onCancel }: SessionDialogProps) {
    const { t } = useI18n()
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, width: 440, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>{t('session_found')}</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
                    {t('session_found_desc')}
                </p>
                <div style={{ background: 'var(--bg-select)', padding: 12, borderRadius: 4, marginBottom: 24, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('version')}</span>
                        <span>{info.version || 'Unknown'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Token</span>
                        <span style={{ fontFamily: 'monospace' }}>{info.token ? '••••' + info.token.slice(-4) : 'Private'}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn" onClick={onStartParallel} style={{ opacity: 0.9 }}>{t('start_parallel') || "Start New"}</button>
                    <button className="btn" onClick={onRestart} style={{ opacity: 0.8 }}>{t('restart_session')}</button>
                    <button className="btn primary" onClick={onJoin}>{t('join_session')}</button>
                </div>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button className="btn link" onClick={onCancel} style={{ fontSize: '0.85rem' }}>{t('cancel')}</button>
                </div>
            </div>
        </div>
    )
}
