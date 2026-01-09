import React from 'react'
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import { useTranslation } from 'react-i18next'

type Props = {
    title: string
    message: string
    onClose: () => void
    onConfirm?: () => void
    confirmLabel?: string
    cancelLabel?: string
}

export default function MessageBox({ title, message, onClose, onConfirm, confirmLabel, cancelLabel }: Props) {
    const { t } = useTranslation()
    // close on escape key
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div className="login-overlay" onClick={onClose}>
            <div className="login-box" onClick={e => e.stopPropagation()} style={{ minWidth: 350, maxWidth: 500 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
                    <button className="link icon-btn" onClick={onClose} aria-label={t('close')}><Icon name={getIcon('close')} size={16} /></button>
                </div>
                <div style={{ marginBottom: 24, fontSize: 14, lineHeight: '1.5', color: 'var(--text-muted)' }}>
                    {message}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {onConfirm ? (
                        <>
                            <button className="btn" onClick={onClose}>{cancelLabel || t('cancel')}</button>
                            <button className="btn primary" onClick={onConfirm}>{confirmLabel || t('continue')}</button>
                        </>
                    ) : (
                        <button className="btn" onClick={onClose}>{t('close')}</button>
                    )}
                </div>
            </div>
        </div>
    )
}
