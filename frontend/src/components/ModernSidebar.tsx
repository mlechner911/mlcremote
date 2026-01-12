import React from 'react'
import FileTree from './FileTree'
import { DirEntry } from '../api' // imported for type usage
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'

type ModernSidebarProps = {
    showHidden: boolean
    selectedPath?: string
    onSelect: (path: string, isDir: boolean) => void
    root?: string
    className?: string
    onActivityChange?: (activity: string) => void
    onOpen?: (path: string) => void
    onOpenTerminal?: () => void
    onToggleSettings?: () => void
    onOpenTrash?: () => void
    onOpenTrash?: () => void
    onContextMenu?: (entry: DirEntry, x: number, y: number) => void
    refreshSignal?: { path: string, ts: number }
}

export default function ModernSidebar(props: ModernSidebarProps) {
    const { showHidden, selectedPath, onSelect, root = '/', onActivityChange } = props
    const [activeActivity, setActiveActivity] = React.useState('files')

    const handleActivityClick = (activity: string) => {
        setActiveActivity(activity)
        onActivityChange?.(activity)
    }

    return (
        <div className="modern-sidebar">
            {/* Activity Bar */}
            <div className="activity-bar">
                <div className={`activity-icon ${activeActivity === 'files' ? 'active' : ''}`} onClick={() => handleActivityClick('files')} title="Explorer">
                    <Icon name={getIcon('copy')} size={24} />
                </div>
                {/* Terminal Icon - Always available command */}
                <div className="activity-icon" onClick={() => props.onOpenTerminal?.()} title="New Terminal">
                    <Icon name={getIcon('terminal')} size={24} />
                </div>
                {/* Trash Icon */}
                <div className="activity-icon" onClick={() => props.onOpenTrash?.()} title="Trash">
                    <Icon name="icon-trash" size={24} />
                </div>
                {/* Spacer */}
                <div style={{ flex: 1 }}></div>
                <div className={`activity-icon ${activeActivity === 'settings' ? 'active' : ''}`} onClick={() => props.onToggleSettings?.()} title="Settings">
                    <Icon name={getIcon('settings')} size={24} />
                </div>
            </div>

            {/* Side Panel */}
            <div className="side-panel">
                {activeActivity === 'files' && (
                    <>
                        <div className="panel-title">EXPLORER</div>
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            <FileTree
                                root={root}
                                showHidden={showHidden}
                                selectedPath={selectedPath}
                                onSelect={onSelect}
                                onOpen={props.onOpen}
                                onContextMenu={props.onContextMenu}
                                refreshSignal={props.refreshSignal}
                            />
                        </div>
                    </>
                )}
                {activeActivity === 'settings' && (
                    <div style={{ padding: 20, textAlign: 'center', opacity: 0.5 }}>Settings via gear icon</div>
                )}
            </div>
        </div>
    )
}
