import React from 'react'

interface RemoteViewProps {
    url: string
    profileName: string
    onDisconnect: () => void
}

export default function RemoteView({ url, profileName, onDisconnect }: RemoteViewProps) {
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
                borderBottom: '1px solid #374151'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold' }}>MLCRemote</span>
                    <span style={{ color: '#9ca3af' }}>|</span>
                    <span style={{ color: '#e5e7eb' }}>Connected to: {profileName}</span>
                </div>
                <button
                    onClick={onDisconnect}
                    style={{
                        backgroundColor: '#ef4444', // red-500
                        color: 'white',
                        border: 'none',
                        padding: '6px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'w500',
                        transition: 'background-color 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                >
                    Disconnect
                </button>
            </div>

            {/* Iframe Content */}
            <div style={{ flex: 1, position: 'relative' }}>
                <iframe
                    src={url}
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
