import React from 'react'
import { useTranslation } from 'react-i18next'
import FileTree from './FileTree'
import { DirEntry, TaskDef, uploadFile } from '../api' // imported for type usage
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import ContextMenu from './ContextMenu'

export interface ActivityBarProps {
    isExpanded: boolean
    onToggleSidebar: (expanded: boolean) => void
    onOpenTerminal: () => void
    onOpenTrash: () => void
    onOpenLogs: () => void
    onToggleSettings: () => void
    quickTasks: TaskDef[]
    onRunTask: (task: TaskDef) => void

    onActivityChange: (activity: string) => void
}

export interface SidebarPanelProps {
    showHidden: boolean
    selectedPath: string | undefined
    onSelect: (path: string, isDir: boolean) => void
    root: string
    onOpen: (path: string) => void
    onContextMenu: (entry: DirEntry, x: number, y: number) => void
    refreshSignal: { path: string, ts: number } | undefined
    onRefresh: () => void
    onChangeRoot?: (path: string) => void
}

// Legacy combined type (kept for compatibility if needed, though strictly we should split usage)
interface ModernSidebarProps extends ActivityBarProps, SidebarPanelProps { }

// Re-export specific components for layout flexibility

export function ActivityBar(props: ActivityBarProps) {
    const { t } = useTranslation()
    const { isExpanded = true, onToggleSidebar, onActivityChange, onOpenTerminal, onOpenTrash, onOpenLogs, onToggleSettings } = props
    const [activeActivity, setActiveActivity] = React.useState('files')

    const handleActivityClick = (activity: string) => {
        if (activity === 'files') {
            if (activeActivity === 'files' && isExpanded) {
                // Toggle off
                onToggleSidebar(false)
            } else {
                // Toggle on and set active
                setActiveActivity('files')
                if (!isExpanded) onToggleSidebar(true)
            }
        } else {
            setActiveActivity(activity)
            onActivityChange(activity)
            if (activity === 'files' && !isExpanded) onToggleSidebar(true)
        }
    }

    return (
        <div className="activity-bar" style={{ display: 'flex', flexDirection: 'column', width: 48, background: 'var(--bg-activity)', height: '100%', borderRight: '1px solid var(--border)', padding: '8px 0', alignItems: 'center' }}>
            <div className={`activity-icon ${(activeActivity === 'files' && isExpanded) ? 'active' : ''}`} onClick={() => handleActivityClick('files')} title="Explorer">
                <Icon name={getIcon('folder')} size={24} />
            </div>

            {/* Quick Tasks */}
            {props.quickTasks.map((task: TaskDef, idx: number) => (
                <div key={idx} mlc-test="a" className="activity-icon" onClick={() => props.onRunTask(task)} title={task.name}>
                    <div style={{ color: task.color, display: 'flex' }}>
                        <Icon name={'icon-' + task.icon} size={24} />

                    </div>
                </div>
            ))}
            {/* DEBUG: Show count if 0/undefined but expected? No, just keep clean if empty. 
                But for this debug session, render a dot if empty? */}
            {(props.quickTasks === undefined || props.quickTasks.length === 0) && (
                <div style={{ fontSize: 8, opacity: 0.3 }} title="No tasks">.</div>
            )}

            {/* Terminal Icon - Always available command */}
            <div className="activity-icon" onClick={() => onOpenTerminal()} title={t('new_terminal')}>
                <Icon name="icon-terminal" size={24} />
            </div>
            {/* Trash Icon */}
            <div className="activity-icon" onClick={() => onOpenTrash()} title={t('trash')}>
                <Icon name="icon-trash" size={24} />
            </div>
            {/* Logs Icon - Always visible */}
            <div className="activity-icon" onClick={() => onOpenLogs()} title={t('server_logs') || 'Server Logs'}>
                <Icon name="icon-file-code" size={24} />
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }}></div>
            <div className={`activity-icon ${activeActivity === 'settings' ? 'active' : ''}`} onClick={() => onToggleSettings()} title="Settings">
                <Icon name={getIcon('settings')} size={24} />
            </div>
        </div>
    )
}

export function SidebarPanel(props: SidebarPanelProps) {
    const { t } = useTranslation()
    const { showHidden, selectedPath, onSelect, root = '/', onRefresh, onOpen, onContextMenu, refreshSignal, onChangeRoot } = props
    const [isDragOver, setIsDragOver] = React.useState(false)
    const [uploading, setUploading] = React.useState(false)
    // Header Context Menu
    const [headerMenu, setHeaderMenu] = React.useState<{ x: number, y: number } | null>(null)

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setUploading(true)
            try {
                const uploads = Array.from(e.dataTransfer.files).map(file =>
                    uploadFile(root, file)
                )
                await Promise.all(uploads)
                if (onRefresh) onRefresh()
            } catch (err) {
                console.error("Upload failed", err)
                alert(t('status_failed'))
            } finally {
                setUploading(false)
            }
        }
    }

    return (
        <div
            className="side-panel"
            style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-sidebar)', minWidth: 0, position: 'relative' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragOver && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10, backdropFilter: 'blur(2px)' }}>
                    <div style={{ pointerEvents: 'none', fontWeight: 'bold' }}>{t('drop_to_upload')}</div>
                </div>
            )}
            {uploading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--accent)', zIndex: 11, animation: 'pulse 1s infinite' }}></div>
            )}
            <div className="panel-title"
                onContextMenu={(e) => {
                    if (onChangeRoot) {
                        e.preventDefault()
                        setHeaderMenu({ x: e.clientX, y: e.clientY })
                    }
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 35, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: onChangeRoot ? 'context-menu' : 'default' }}>
                <span>EXPLORER</span>
                <div style={{ display: 'flex', gap: 4 }}>
                    {onRefresh && (
                        <button className="icon-btn" title="Refresh" onClick={onRefresh}>
                            <Icon name={getIcon('refresh') || 'icon-refresh'} size={14} />
                        </button>
                    )}
                </div>
            </div>
            {headerMenu && (
                <ContextMenu
                    x={headerMenu.x}
                    y={headerMenu.y}
                    onClose={() => setHeaderMenu(null)}
                    items={[
                        {
                            label: t('change_root', 'Change Root'),
                            icon: <Icon name={getIcon('folder')} />,
                            action: () => {
                                if (onChangeRoot) onChangeRoot(root)
                            }
                        }
                    ]}
                />
            )}
            <div className="file-tree-container" style={{ flex: 1, overflow: 'auto' }}>
                <FileTree
                    root={root}
                    showHidden={showHidden}
                    selectedPath={selectedPath}
                    onSelect={onSelect}
                    onOpen={onOpen}
                    onContextMenu={onContextMenu}
                    refreshSignal={refreshSignal}
                />
            </div>
        </div>
    )
}

// Deprecated default export to maintain compatibility if needed, but App.tsx should use named exports
export default function ModernSidebar(props: ModernSidebarProps) {
    return (
        <div className="modern-sidebar" style={{ display: 'flex', height: '100%' }}>
            <ActivityBar {...props} />
            {props.isExpanded && (
                <div style={{ width: 250, borderRight: '1px solid var(--border)' }}>
                    <SidebarPanel {...props} />
                </div>
            )}
        </div>
    )
}
