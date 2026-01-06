import { Icon } from '../generated/icons'
import { useI18n } from '../utils/i18n'

interface RemoteViewProps {
    url: string
    profileName: string
    profileId?: string
    profileColor?: string
    user?: string
    localPort?: number
    onDisconnect: () => void
}

export default function RemoteView({ url, profileName, profileId, profileColor, user, localPort, onDisconnect }: RemoteViewProps) {
    const { t } = useI18n()
    // Append profileId to URL if present
    // DEBUG: Point to debug page (Disabled)
    // const targetSrc = `/debug_iframe.html?api=${encodeURIComponent(url)}&_t=${Date.now()}` + (profileId ? `&profileId=${encodeURIComponent(profileId)}` : '')

    // Production View
    const targetSrc = `/ide/index.html?api=${encodeURIComponent(url)}` + (profileId ? `&profileId=${encodeURIComponent(profileId)}` : '')

    const handleShare = () => {
        try {
            // URL is like http://localhost:PORT?token=XXX
            const token = new URLSearchParams(new URL(url).search).get('token')
            if (token) {
                navigator.clipboard.writeText(token)
                alert(t('session_key_copied'))
            } else {
                alert("No token found in session.")
            }
        } catch (e) {
            console.error("Failed to share", e)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
                backgroundColor: '#1f2937', // dark-800
                color: 'white',
                padding: '10px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #374151',
                userSelect: 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {profileColor && (
                        <div style={{
                            width: 12, height: 12, borderRadius: 3,
                            backgroundColor: profileColor,
                            boxShadow: '0 0 8px ' + profileColor + '44'
                        }} />
                    )}
                    <span style={{ fontWeight: 'bold' }}>MLCRemote</span>
                    <span style={{ color: '#9ca3af' }}>|</span>
                    <span style={{ color: '#e5e7eb' }}>
                        {user ? `${t('user')}: ${user}` : `User: ${profileName.split('@')[0]}`}
                    </span>
                    <span style={{ color: '#9ca3af' }}>|</span>
                    <span style={{ color: '#e5e7eb' }}>
                        Tunnel Port: {localPort || 8443}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        onClick={handleShare}
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)',
                            padding: '6px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 500,
                            display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'background-color 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                        title={t('share_session')}
                    >
                        <Icon name="icon-key" size={14} />
                        <span style={{ fontSize: '0.9rem' }}>{t('share_session')}</span>
                    </button>
                    <button
                        onClick={onDisconnect}
                        style={{
                            backgroundColor: '#ef4444', // red-500
                            color: 'white',
                            border: 'none',
                            padding: '6px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 500,
                            transition: 'background-color 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                    >
                        {t('disconnect')}
                    </button>
                </div>
            </div>

            {/* Iframe Content */}
            <div style={{ flex: 1, position: 'relative' }}>
                <iframe
                    src={targetSrc}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        display: 'block'
                    }}
                    title="Remote Backend"
                />
            </div>
        </div>
    )
}
