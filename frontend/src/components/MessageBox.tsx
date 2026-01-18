import React from 'react'
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import { useTranslation } from 'react-i18next'

type Props = {
    title: string
    message: string
    onClose: () => void
    confirmLabel?: string
    cancelLabel?: string
    // Prompt extensions
    inputType?: string
    defaultValue?: string
    placeholder?: string
    onConfirm?: (value?: string) => void
    variant?: 'info' | 'error' | 'warning' | 'success'
}

export default function MessageBox({ title, message, onClose, onConfirm, confirmLabel, cancelLabel, inputType, defaultValue, placeholder, variant }: Props) {
    const { t } = useTranslation()
    const [inputValue, setInputValue] = React.useState(defaultValue || '')
    // close on escape key
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    let iconName = 'info'
    let titleColor = 'var(--text-normal)'

    switch (variant) {
        case 'error':
            iconName = 'error' // Ensure this icon exists or map to 'close-circle'
            titleColor = 'var(--red)'
            break
        case 'warning':
            iconName = 'warning' // Ensure this icon exists or map to 'alert-triangle'
            titleColor = 'var(--orange)'
            break
        case 'success':
            iconName = 'check' // Ensure this icon exists or map to 'check-circle'
            titleColor = 'var(--green)'
            break
        case 'info':
        default:
            iconName = 'info'
            titleColor = 'var(--accent)'
            break
    }

    return (
        <div className="login-overlay" onClick={onClose}>
            <div className="login-box" onClick={e => e.stopPropagation()} style={{ minWidth: 350, maxWidth: 500 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {variant && <div style={{ color: titleColor, display: 'flex' }}><Icon name={getIcon(iconName) || `icon-${iconName}`} size={20} /></div>}
                        <h3 style={{ margin: 0, fontSize: 18, color: variant ? titleColor : undefined }}>{title}</h3>
                    </div>
                    <button className="link icon-btn" onClick={onClose} aria-label={t('close')}><Icon name={getIcon('close')} size={16} /></button>
                </div>
                <div style={{ marginBottom: 24, fontSize: 14, lineHeight: '1.5', color: 'var(--text-muted)' }}>
                    {message}
                    {inputType && (
                        <input
                            type={inputType}
                            className="input"
                            style={{ width: '100%', marginTop: 12, padding: 8 }}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            placeholder={placeholder}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && onConfirm) onConfirm(inputValue)
                            }}
                            autoFocus
                        />
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {onConfirm ? (
                        <>
                            <button className="btn" onClick={onClose}>{cancelLabel || t('cancel')}</button>
                            <button className="btn primary" onClick={() => onConfirm(inputType ? inputValue : undefined)}>{confirmLabel || t('ok')}</button>
                        </>
                    ) : (
                        <button className="btn" onClick={onClose}>{t('close')}</button>
                    )}
                </div>
            </div>
        </div>
    )
}
