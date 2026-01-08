import React from 'react'
import { Icon } from '../generated/icons'
import { useI18n } from '../utils/i18n'

export type DialogType = 'info' | 'error' | 'question'

interface AlertDialogProps {
    open: boolean
    title: string
    message: string
    type?: DialogType
    onClose: () => void
    onConfirm?: () => void
    confirmText?: string
    cancelText?: string
}

export default function AlertDialog({
    open, title, message, type = 'info', onClose, onConfirm, confirmText, cancelText
}: AlertDialogProps) {
    const { t } = useI18n()

    if (!open) return null

    const handleConfirm = () => {
        if (onConfirm) onConfirm()
        onClose()
    }

    const isError = type === 'error'
    const isQuestion = type === 'question'

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-panel)', border: '1px solid var(--border)',
                borderRadius: 8, width: 400, maxWidth: '90vw', padding: 24,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                opacity: 1, transform: 'scale(1)',
                animation: 'fadein 0.2s ease-out'
            }} onClick={e => e.stopPropagation()}>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: isError ? 'rgba(220, 53, 69, 0.1)' : isQuestion ? 'rgba(255, 193, 7, 0.1)' : 'rgba(13, 110, 253, 0.1)',
                        color: isError ? '#dc3545' : isQuestion ? '#ffc107' : '#0d6efd',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Icon name={isError ? 'icon-warning' : isQuestion ? 'icon-info' : 'icon-info'} size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{title}</h3>
                        <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {message}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                    {isQuestion && (
                        <button className="btn" onClick={onClose}>
                            {cancelText || t('cancel')}
                        </button>
                    )}
                    <button
                        className={`btn ${isError ? 'danger' : 'primary'}`}
                        onClick={handleConfirm}
                        style={{ minWidth: 80, justifyContent: 'center' }}
                    >
                        {confirmText || t('ok')}
                    </button>
                </div>
            </div>
        </div>
    )
}
