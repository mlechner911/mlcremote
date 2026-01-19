import React, { useEffect, useState, useRef } from 'react'
import { getRemoteLogs } from '../../api'
import { Icon } from '../../generated/icons'
import { getIcon } from '../../generated/icon-helpers'
import { useTranslation } from 'react-i18next'

interface Props {
    // Support standard tab props if needed in future
}

// ... imports

/**
 * Displays live server logs with auto-scroll and pause functionality.
 */
export default function ServerLogsView(_props: Props) {
    const { t } = useTranslation()
    const [logs, setLogs] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [paused, setPaused] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        console.log('ServerLogsView mounted')
        return () => console.log('ServerLogsView unmounted')
    }, [])

    const fetchLogs = async () => {
        try {
            setLoading(true)
            const text = await getRemoteLogs()
            setLogs(text)
            setError(null)
        } catch (e: any) {
            setError(e.message || 'Failed to fetch logs')
        } finally {
            setLoading(false)
        }
    }

    // Initial fetch
    useEffect(() => {
        fetchLogs()
    }, [])

    // Poll intervals
    useEffect(() => {
        if (paused) return
        const id = setInterval(fetchLogs, 2000)
        return () => clearInterval(id)
    }, [paused])

    // Auto-scroll
    useEffect(() => {
        if (paused) return
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, paused])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-editor)' }}>
            {/* Toolbar */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="icon-server" size={16} />
                <strong>Server Logs (Diagnosing - Bytes: {logs.length})</strong>
                <div style={{ flex: 1 }} />

                {loading && <span className="muted" style={{ fontSize: 12 }}>Fetching...</span>}

                <button className="icon-btn" onClick={() => setPaused(!paused)} title={paused ? "Resume Auto-scroll" : "Pause Auto-scroll"}>
                    <Icon name={paused ? 'icon-play' : 'icon-pause'} size={14} />
                </button>

                <button className="icon-btn" onClick={() => fetchLogs()} title="Refresh">
                    <Icon name="icon-refresh" size={14} />
                </button>

                <button className="icon-btn" onClick={() => setLogs('')} title="Clear View">
                    <Icon name="icon-trash" size={14} />
                </button>
            </div>

            {/* Log Content */}
            <div
                ref={containerRef}
                style={{ flex: 1, overflow: 'auto', padding: 12, fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-editor)' }}
            >
                {error && <div style={{ color: 'var(--error)', marginBottom: 10 }}>Error: {error}</div>}

                {logs.split('\n').map((line, i) => {
                    if (!line) return null
                    let color = 'var(--text)'
                    let bg = 'transparent'

                    if (line.includes('[INFO]') || line.includes('starting server')) color = '#3b82f6' // blue
                    if (line.includes('[ERROR]') || line.includes('fail') || line.includes('Error')) color = '#ef4444' // red
                    if (line.includes('ACCESS:') || line.includes('[ACCESS]')) color = 'var(--text-muted)' // dimmed

                    return (
                        <div key={i} style={{ color, backgroundColor: bg, padding: '2px 0', whiteSpace: 'pre-wrap' }}>
                            {line}
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>
        </div>
    )
}
