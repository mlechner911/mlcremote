import React from 'react'
import { Icon } from '../generated/icons'
import { useI18n } from '../utils/i18n'
// Import from wailsjs
import { ClipboardCopy, ClipboardPasteTo } from '../wailsjs/go/app/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'
import AlertDialog from './AlertDialog'

import TaskBar from './TaskBar'
import { TaskDef } from '../types'

interface RemoteViewProps {
    url: string
    profileName: string
    profileId?: string
    profileColor?: string
    user?: string
    localPort?: number
    theme: 'light' | 'dark'
    tasks?: TaskDef[]
    initialTask?: TaskDef
    onRunTask?: (task: TaskDef) => void
    onSetTheme: (t: 'light' | 'dark') => void
    onDisconnect: () => void
    defaultShell?: string
    showDeveloperControls?: boolean
}

export default function RemoteView({ url, profileName, profileId, profileColor, user, localPort, theme, tasks, initialTask, onRunTask, onSetTheme, onDisconnect, defaultShell, showDeveloperControls }: RemoteViewProps) {
    const { t, lang } = useI18n()
    // Append profileId to URL if present
    // DEBUG: Point to debug page (Disabled)
    // const targetSrc = `/debug_iframe.html?api=${encodeURIComponent(url)}&_t=${Date.now()}` + (profileId ? `&profileId=${encodeURIComponent(profileId)}` : '')

    // Production View
    const [initialTheme] = React.useState(theme)
    const targetSrc = React.useMemo(() => {
        let qs = `?api=${encodeURIComponent(url)}&lng=${lang}&theme=${initialTheme}&controlled=true`
        if (profileId) qs += `&profileId=${encodeURIComponent(profileId)}`
        if (defaultShell) qs += `&shell=${encodeURIComponent(defaultShell)}`
        // If we have an initial task, collapse the sidebar initially to focus on the task output
        if (initialTask) qs += `&collapsed=true`
        return `/ide/index.html${qs}`
    }, [url, profileId, lang, initialTask, defaultShell])

    const iframeRef = React.useRef<HTMLIFrameElement>(null)

    // Handle initial task execution
    const taskRanRef = React.useRef(false)
    React.useEffect(() => {
        if (initialTask && iframeRef.current && !taskRanRef.current) {
            // Wait a bit for iframe to load? Or rely on the fact that postMessage might be queued or we need a 'ready' signal?
            // For now, let's just try sending it after a short delay or check if we can make it reliable.
            // A simple timeout is a crude but often effective MVP solution.
            // Better: List for 'ide-ready' message from iframe. But we don't have that yet.
            const timer = setTimeout(() => {
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    console.log("Auto-running task:", initialTask.name)
                    iframeRef.current.contentWindow.postMessage({
                        type: 'run-task',
                        command: initialTask.command,
                        name: initialTask.name,
                        icon: initialTask.icon,
                        color: initialTask.color
                    }, '*')
                    taskRanRef.current = true
                }
            }, 1500) // 1.5s delay to allow React/IDE to hydrate
            return () => clearTimeout(timer)
        }
    }, [initialTask])

    React.useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: 'set-theme', theme }, '*')
        }
    }, [theme])

    // Listen for app-ready from iframe
    React.useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data && e.data.type === 'app-ready') {
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    // Handshake confirms ready, send theme (tasks already in window.name)
                    iframeRef.current.contentWindow.postMessage({ type: 'set-theme', theme }, '*')
                    // Also send tasks just in case they changed since mount
                    if (tasks) {
                        iframeRef.current.contentWindow.postMessage({ type: 'set-tasks', tasks }, '*')
                    }
                }
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [tasks, theme])

    // Update tasks if they change live
    React.useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow && tasks) {
            iframeRef.current.contentWindow.postMessage({ type: 'set-tasks', tasks }, '*')
        }
    }, [tasks])

    // --- Clipboard Implementation ---
    const [activeRemotePath, setActiveRemotePath] = React.useState<string>('')
    const [alertState, setAlertState] = React.useState<{ open: boolean, title: string, message: string, type: 'info' | 'error' | 'question' | 'progress', progress?: number } | null>(null)

    const showAlert = (title: string, message: string, type: 'info' | 'error' | 'question' | 'progress' = 'info', progress?: number) => {
        setAlertState({ open: true, title, message, type, progress })
    }

    const handlePasteToRemote = async (path: string) => {
        const token = new URLSearchParams(new URL(url).search).get('token') || ''
        try {
            console.log("Pasting to remote:", path)
            await ClipboardPasteTo(path, token)
            // Trigger refresh in iframe
            if (iframeRef.current && iframeRef.current.contentWindow) {
                iframeRef.current.contentWindow.postMessage({ type: 'refresh-path', path }, '*')
            }
        } catch (e: any) {
            console.error("Paste failed:", e)
            alert("Paste failed: " + e.message)
        }
    }

    React.useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (!e.data) return
            if (e.data.type === 'path-change') {
                setActiveRemotePath(e.data.path)
            }
            if (e.data.type === 'copy-to-local') {
                const token = new URLSearchParams(new URL(url).search).get('token') || ''
                const count = e.data.count || e.data.paths.length
                const size = e.data.totalSize
                const names = e.data.names || []

                ClipboardCopy(e.data.paths, token)
                    .then(() => {
                        let msg = "Copied to local clipboard!"
                        if (count > 0 && size !== undefined) {
                            const sizeStr = (size > 1024 * 1024) ? (size / (1024 * 1024)).toFixed(1) + ' MB' : (size / 1024).toFixed(1) + ' KB'
                            const fileLabel = count === 1 ? (names[0] || 'file') : `${count} files`
                            msg = `Copied ${fileLabel} (${sizeStr}) to local clipboard.`
                        }
                        showAlert("Smart Clipboard", msg, 'info')
                    })
                    .catch((err: any) => showAlert("Clipboard Error", "Copy failed: " + err, 'error'))
            }
            if (e.data.type === 'paste-from-local') {
                handlePasteToRemote(e.data.path)
            }

        }
        window.addEventListener('message', handleMessage)

        const handleKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'v') {
                // If focus is in iframe, iframe handles it.
                // This only fires if focus is on the wrapper (e.g. clicked on header).
                if (activeRemotePath) {
                    handlePasteToRemote(activeRemotePath)
                    e.preventDefault()
                }
            }
        }
        window.addEventListener('keydown', handleKey)

        // Listen for Wails events
        const logProgress = (data: any) => {
            console.log("Clipboard Progress:", data)
            if (data.status === 'downloading') {
                // Calculate pseudo-progress based on files?
                // data.currentIndex / data.totalFiles * 100 (halfway) + some buffer
                // For now just indeterminate cycling or simple text update
                const percent = ((data.currentIndex || 0) / (data.totalFiles || 1)) * 100
                showAlert("Smart Clipboard", `Downloading ${data.currentFile}...`, 'progress', percent)
            } else if (data.status === 'unzipping') {
                showAlert("Smart Clipboard", `Unzipping ${data.currentFile}...`, 'progress', 100)
            }
        }
        EventsOn("clipboard-progress", logProgress)

        return () => {
            window.removeEventListener('message', handleMessage)
            window.removeEventListener('keydown', handleKey)
            EventsOff("clipboard-progress")
        }
    }, [activeRemotePath, url]) // Re-bind if path changes

    const handleScreenshot = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            // "servername+date (without special chars)"
            const date = new Date()
            const yyyy = date.getFullYear()
            const mm = String(date.getMonth() + 1).padStart(2, '0')
            const dd = String(date.getDate()).padStart(2, '0')
            const hh = String(date.getHours()).padStart(2, '0')
            const min = String(date.getMinutes()).padStart(2, '0')
            const ss = String(date.getSeconds()).padStart(2, '0')

            const dateStr = `${yyyy}${mm}${dd}-${hh}${min}${ss}`
            const safeName = profileName.replace(/[^a-zA-Z0-9]/g, '_') // Strict sanitization
            const filename = `${safeName}_${dateStr}.png`

            iframeRef.current.contentWindow.postMessage({ type: 'screenshot', filename }, '*')
        }
    }

    const toggleTheme = () => {
        onSetTheme(theme === 'dark' ? 'light' : 'dark')
    }

    const handleShare = () => {
        try {
            // URL is like http://localhost:PORT?token=XXX
            const token = new URLSearchParams(new URL(url).search).get('token')
            if (token) {
                navigator.clipboard.writeText(token)
                alert(t('session_key_copied') || 'Token copied')
            } else {
                alert("No token found in session.")
            }
        } catch (e) {
            console.error("Failed to copy token", e)
        }
    }

    const [isDisconnecting, setIsDisconnecting] = React.useState(false)

    const handleDisconnectWrapper = () => {
        setIsDisconnecting(true)
        onDisconnect()
    }

    // Embed tasks in window.name for synchronous load
    const frameName = React.useMemo(() => {
        return JSON.stringify({ tasks: tasks || [] })
    }, [tasks])

    const btnStyle = {
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: theme === 'dark' ? 'white' : '#333',
        border: theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.1)',
        padding: '6px 12px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 500 as const,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'background-color 0.2s',
        height: 32
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-root)' }}>
            {/* Header */}
            <div style={{
                height: 48,
                background: theme === 'dark' ? '#0f0f0f' : '#e5e5e5', // Distinct header
                borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#ccc'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 16px',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 6, background: '#a855f7' }}></div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>MLCRemote</span>
                    <span style={{ opacity: 0.3 }}>|</span>
                    <span style={{ opacity: 0.8, fontSize: 14 }}>
                        {t('user')}: {user || 'root'}
                    </span>
                    <span style={{ opacity: 0.3 }}>|</span>
                    <span style={{ opacity: 0.6, fontSize: 13 }}>
                        Port: {localPort}
                    </span>
                    {/* Active Remote Dir Indicator for Debug/Confirmation */}
                    {activeRemotePath && (
                        <>
                            <span style={{ opacity: 0.3 }}>|</span>
                            <span style={{ opacity: 0.6, fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {activeRemotePath}
                            </span>
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>

                    {/* Developer Controls - Hidden by default */}
                    {showDeveloperControls && (
                        <>
                            <button
                                onClick={handleScreenshot}
                                title={t('screenshot')}
                                style={{ ...btnStyle, color: theme === 'dark' ? 'white' : '#333' }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
                            >
                                <Icon name="icon-screenshot" size={18} />
                            </button>
                            <button
                                onClick={handleShare}
                                title={t('share_session')}
                                style={{ ...btnStyle, color: theme === 'dark' ? 'white' : '#333' }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
                            >
                                <Icon name="icon-link" size={18} />
                            </button>

                            <button
                                onClick={() => {
                                    if (iframeRef.current && iframeRef.current.contentWindow) {
                                        iframeRef.current.contentWindow.postMessage({ type: 'open-logs' }, '*')
                                    }
                                }}
                                title={t('server_logs') || 'Server Logs'}
                                style={{ ...btnStyle, color: theme === 'dark' ? 'white' : '#333' }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
                            >
                                {/* Use a clear icon like 'list' or 'file-text' if available, otherwise 'info' */}
                                <Icon name="icon-list" size={18} />
                            </button>
                        </>
                    )}

                    <button
                        onClick={handleDisconnectWrapper}
                        disabled={isDisconnecting}
                        style={{
                            backgroundColor: '#ef4444', // red-500
                            border: 'none',
                            opacity: isDisconnecting ? 0.7 : 1,
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: 4,
                            cursor: isDisconnecting ? 'wait' : 'pointer'
                        }}
                    >
                        {isDisconnecting ? t('disconnecting') || 'Disconnecting...' : t('disconnect')}
                    </button>
                </div>
            </div>

            <div style={{
                flex: 1, background: '#000', position: 'relative',
                opacity: isDisconnecting ? 0.5 : 1,
                transition: 'opacity 0.5s ease',
                pointerEvents: isDisconnecting ? 'none' : 'auto'
            }}>
                <iframe
                    ref={iframeRef}
                    src={targetSrc}
                    onLoad={() => {
                        // Send tasks when iframe is fully loaded
                        if (iframeRef.current && iframeRef.current.contentWindow && tasks) {
                            console.log("Iframe loaded, sending tasks:", tasks)
                            iframeRef.current.contentWindow.postMessage({ type: 'set-tasks', tasks }, '*')
                            iframeRef.current.contentWindow.postMessage({ type: 'set-theme', theme }, '*')
                        }
                    }}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        background: theme === 'dark' ? '#111827' : '#f9fafb'
                    }}
                    allow="clipboard-read; clipboard-write"
                    title="Remote Backend"
                />
            </div>
            {
                alertState && (
                    <AlertDialog
                        open={alertState.open}
                        title={alertState.title}
                        message={alertState.message}
                        type={alertState.type}
                        progress={alertState.progress}
                        onClose={() => setAlertState(null)}
                    />
                )
            }
        </div >
    )
}
