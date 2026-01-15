import React, { useState, useEffect } from 'react'
import { makeUrl, getToken } from '../api'
import { useTranslation } from 'react-i18next'
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'

type Props = {
    path: string
}

export default function VideoView({ path }: Props) {
    const { t } = useTranslation()
    const [error, setError] = useState<string | null>(null)
    const [token, setToken] = useState<string>('')

    useEffect(() => {
        setToken(getToken() || '')
        setError(null)
    }, [path])

    const videoUrl = makeUrl(`/api/file?path=${encodeURIComponent(path)}${token ? `&token=${encodeURIComponent(token)}` : ''}`)
    const downloadUrl = makeUrl(`/api/file?path=${encodeURIComponent(path)}${token ? `&token=${encodeURIComponent(token)}` : ''}&download=true`)
    const filename = path.split(/[/\\]/).pop() || 'video.mp4'

    const handleError = () => {
        setError(t('video_playback_failed', 'Video playback failed. The format might not be supported.'))
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
                    <Icon name={getIcon('video')} size={48} />
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
                    {t('download_video', 'Download Video')}
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
            background: '#000',
            overflow: 'hidden'
        }}>
            <video
                key={path} // Force re-mount on path change
                controls
                autoPlay={false}
                style={{ maxWidth: '100%', maxHeight: '100%', outline: 'none' }}
                onError={handleError}
            >
                <source src={videoUrl} />
                {t('video_not_supported', 'Your browser does not support the video tag.')}
            </video>
        </div>
    )
}
