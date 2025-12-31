import React, { useEffect, useState } from 'react'
import { Profile } from '../App'

interface WelcomeProps {
    onConnect: (profile?: Profile) => void
    onOpenSettings: () => void
}

export default function Welcome({ onConnect, onOpenSettings }: WelcomeProps) {
    const [history, setHistory] = useState<Profile[]>([])

    useEffect(() => {
        try {
            const h = localStorage.getItem('mlcremote_history')
            if (h) {
                setHistory(JSON.parse(h))
            }
        } catch (e) {
            console.error(e)
        }
    }, [])

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100vh',
            fontFamily: 'system-ui, sans-serif', backgroundColor: '#0f172a', color: 'white'
        }}>
            {/* Hero Section */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background Image with Overlay */}
                <img
                    src="/startup_hero.png"
                    alt="Background"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.4,
                        zIndex: 0
                    }}
                />

                <div style={{ zIndex: 1, textAlign: 'center', padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 15, marginBottom: 20 }}>
                        <img src="/logo.png" alt="Logo" style={{ width: 64, height: 64, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }} />
                        <h1 style={{ fontSize: '3rem', margin: 0, fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>MLCRemote</h1>
                    </div>
                    <p style={{ fontSize: '1.2rem', color: '#cbd5e1', maxWidth: 600, margin: '0 auto 40px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                        Secure high-performance remote file management and terminal access.
                    </p>

                    <button
                        onClick={() => onConnect()}
                        style={{
                            padding: '16px 48px',
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                            transition: 'transform 0.1s, box-shadow 0.1s'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 6px 10px rgba(0, 0, 0, 0.3)'
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.2)'
                        }}
                    >
                        Connect to Server
                    </button>
                </div>
            </div>

            {/* Recent Connections Section */}
            {history.length > 0 && (
                <div style={{
                    backgroundColor: '#1e293b',
                    padding: '24px',
                    borderTop: '1px solid #334155'
                }}>
                    <div style={{ maxWidth: 800, margin: '0 auto' }}>
                        <h3 style={{ color: '#94a3b8', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Recent Connections</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                            {history.map((p, i) => (
                                <button key={i} onClick={() => onConnect(p)} style={{
                                    textAlign: 'left', padding: 16, border: '1px solid #334155',
                                    borderRadius: 8, background: '#0f172a', cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', gap: 4,
                                    transition: 'background-color 0.2s'
                                }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0f172a'}
                                >
                                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.host}</span>
                                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>{p.user}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Footer / Settings Link */}
            <div style={{ padding: 10, textAlign: 'right', backgroundColor: '#0f172a' }}>
                <button onClick={onOpenSettings} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.875rem' }}>
                    Settings
                </button>
            </div>
        </div>
    )
}
