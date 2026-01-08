import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import licenseText from '../assets/LICENSE.txt?raw'

interface Props {
    onComplete: () => void
}

export default function SetupWizard({ onComplete }: Props) {
    const { t, i18n } = useTranslation()
    const [step, setStep] = useState<'language' | 'license'>('language')
    const [accepted, setAccepted] = useState(false)

    // Language options
    const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
        // Add more languages here as they become available
    ]

    const handleLanguageSelect = (lang: string) => {
        i18n.changeLanguage(lang)
        setStep('license')
    }

    return (
        <div className="setup-wizard" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'var(--bg)',
            color: 'var(--text)',
            padding: '2rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '600px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '2rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.8rem' }}>
                        {step === 'language' ? 'Welcome to MLCRemote' : t('license_agreement', 'License Agreement')}
                    </h1>
                    <p style={{ margin: 0, opacity: 0.7 }}>
                        {step === 'language' ? 'Please select your language' : t('please_accept_license', 'Please review and accept the license terms to continue.')}
                    </p>
                </div>

                {/* Content */}
                {step === 'language' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        {languages.map(l => (
                            <button
                                key={l.code}
                                className="btn"
                                onClick={() => handleLanguageSelect(l.code)}
                                style={{
                                    padding: '1.5rem',
                                    fontSize: '1.2rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    border: i18n.language === l.code ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                                    background: 'var(--bg)'
                                }}
                            >
                                <span style={{ fontSize: '2rem' }}>{l.flag}</span>
                                {l.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{
                            height: '300px',
                            overflowY: 'auto',
                            background: 'var(--bg)',
                            border: '1px solid var(--border-color)',
                            padding: '1rem',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {licenseText}
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                            <input
                                type="checkbox"
                                checked={accepted}
                                onChange={(e) => setAccepted(e.target.checked)}
                                style={{ width: '1.2rem', height: '1.2rem' }}
                            />
                            {t('i_accept_terms', 'I accept the terms in the License Agreement')}
                        </label>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                            <button className="btn link" onClick={() => setStep('language')}>
                                {t('back', 'Back')}
                            </button>
                            <button
                                className="btn btn-primary"
                                disabled={!accepted}
                                onClick={onComplete}
                                style={{ padding: '0.6rem 2rem' }}
                            >
                                {t('continue', 'Continue')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div style={{ marginTop: '2rem', opacity: 0.5, fontSize: '0.8rem' }}>
                MLCRemote v1.0.1
            </div>
        </div>
    )
}
