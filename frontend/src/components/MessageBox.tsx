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

export default function MessageBox({ title, message, onClose, onConfirm, confirmLabel, cancelLabel, inputType, defaultValue, placeholder, variant = 'info' }: Props) {
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
    switch (variant) {
        case 'error': iconName = 'error'; break
        case 'warning': iconName = 'warning'; break
        case 'success': iconName = 'check'; break
        case 'info':
        default: iconName = 'info'; break
    }

    return (
        <div className="premium-overlay" onClick={onClose}>
            <div className="premium-dialog" onClick={e => e.stopPropagation()}>
                <div className="premium-close-btn" onClick={onClose} aria-label={t('close')}>
                    <Icon name={getIcon('close') || 'icon-close'} size={18} />
                </div>
                <div className={`vibrant-icon-box ${variant}`}>
                    <Icon name={getIcon(iconName) || `icon-${iconName}`} size={24} />
                </div>

                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600 }}>{title}</h3>

                <div style={{ marginBottom: 24, fontSize: 15, lineHeight: '1.6', opacity: 0.9 }}>
                    {message}
                    {inputType && (
                        <input
                            type={inputType}
                            className="input"
                            style={{
                                width: '100%',
                                marginTop: 16,
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background: 'rgba(0,0,0,0.1)',
                                border: '1px solid var(--border)'
                            }}
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

                <div className="premium-footer">
                    {onConfirm ? (
                        <>
                            <button className="btn" style={{ padding: '8px 16px' }} onClick={onClose}>
                                {cancelLabel || t('cancel')}
                            </button>
                            <button className="btn primary" style={{ padding: '8px 20px' }} onClick={() => onConfirm(inputType ? inputValue : undefined)}>
                                {confirmLabel || t('ok')}
                            </button>
                        </>
                    ) : (
                        <button className="btn primary" style={{ padding: '8px 20px' }} onClick={onClose}>
                            {t('close')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
