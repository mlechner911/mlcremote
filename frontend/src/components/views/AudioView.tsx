import React, { useState, useEffect } from 'react'
import { makeUrl, getToken } from '../../api'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../generated/icons'
import { getIcon } from '../../generated/icon-helpers'

import { ViewProps, FileHandler, DecideOpts } from '../../handlers/types'

/**
 * Plays audio files using the native HTML5 audio player.
 */
export default function AudioView({ path }: ViewProps) {
    const { t } = useTranslation()
    const [error, setError] = useState<string | null>(null)
    const [token, setToken] = useState<string>('')

    useEffect(() => {
        setToken(getToken() || '')
        setError(null)
    }, [path])

    const audioUrl = makeUrl(`/api/file?path=${encodeURIComponent(path)}${token ? `&token=${encodeURIComponent(token)}` : ''}`)
    const downloadUrl = makeUrl(`/api/file?path=${encodeURIComponent(path)}${token ? `&token=${encodeURIComponent(token)}` : ''}&download=true`)
    const filename = path.split(/[/\\]/).pop() || 'audio.mp3'

    const handleError = () => {
        setError(t('audio_playback_failed', 'Audio playback failed. The format might not be supported.'))
    }

    if (error) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 40,
                height: '100%',
                color: 'var(--text-muted)'
            }}>
                <div style={{ marginBottom: 16, opacity: 0.5 }}>
                    <Icon name={getIcon('file_audio') || 'icon-file-audio'} size={48} />
                </div>
                <div style={{ fontSize: 16, marginBottom: 8, fontWeight: 500 }}>{t('playback_error', 'Playback Error')}</div>
                <div style={{ marginBottom: 24, textAlign: 'center', maxWidth: 400 }}>{error}</div>
                <a
                    href={downloadUrl}
                    download={filename}
                    className="btn primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
                >
                    <Icon name={getIcon('download')} />
                    {t('download_audio', 'Download Audio')}
                </a>
            </div>
        )
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: 'var(--bg-main)',
            overflow: 'hidden'
        }}>
            <div style={{
                padding: 40,
                borderRadius: 16,
                background: 'var(--bg-panel)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                maxWidth: 400,
                width: '100%'
            }}>
                <div style={{
                    width: 80, height: 80, borderRadius: 16,
                    background: 'var(--accent)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 24,
                    fontSize: 32
                }}>
                    <Icon name={getIcon('file_audio') || 'icon-file-audio'} />
                </div>

                <h3 style={{ margin: '0 0 8px 0', textAlign: 'center', wordBreak: 'break-all' }}>
                    {filename}
                </h3>
                <div className="muted" style={{ fontSize: 12, marginBottom: 24 }}>
                    {t('audio_preview', 'Audio Preview')}
                </div>

                <audio
                    key={path}
                    controls
                    autoPlay={false}
                    style={{ width: '100%', outline: 'none' }}
                    onError={handleError}
                >
                    <source src={audioUrl} />
                    {t('audio_not_supported', 'Your browser does not support the audio element.')}
                </audio>
            </div>
        </div>
    )
}

export const AudioHandler: FileHandler = {
    name: 'Audio',
    priority: 76, // Slightly higher than Video? Or same range. Video is 75.
    matches: (opts: DecideOpts) => {
        if (opts.probe && opts.probe.mime && opts.probe.mime.startsWith('audio/')) return true
        if (opts.path) {
            const lower = opts.path.toLowerCase()
            return lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.flac') || lower.endsWith('.aac') || lower.endsWith('.m4a')
        }
        return false
    },
    view: AudioView,
    isEditable: false
}
