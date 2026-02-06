import React from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useTranslation } from 'react-i18next'
import type { LayoutNode, PaneState, Tab } from '../types/layout'
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import { useDialog } from '../context/DialogContext'
import { SPECIAL_TAB_IDS } from '../constants/specialTabs'
import { DirEntry } from '../api'
import { authedFetch } from '../utils/auth'

// Components
import TabBarComponent from './TabBar'
import TrashView from './views/TrashView'
import Editor from './Editor'
import BinaryView from './views/BinaryView'
import FileDetailsView from './views/FileDetailsView'
import ServerLogsView from './views/ServerLogsView'
import DirectoryView from './views/DirectoryView'
import UnifiedView from './views/UnifiedView'
const TerminalTab = React.lazy(() => import('./views/TerminalTab'))

export interface LayoutManagerProps {
    layout: LayoutNode
    panes: Record<string, PaneState>
    activePaneId: string
    isSidebarExpanded: boolean
    selectedPath: string // prop added

    // Actions
    setActivePaneId: (id: string) => void
    setPanes: React.Dispatch<React.SetStateAction<Record<string, PaneState>>>
    closePane: (id: string) => void
    splitPane: (direction: 'horizontal' | 'vertical', targetTabId?: string) => void

    // Tab/Editor State & Actions
    shellCwds: Record<string, string>
    commandSignals: Record<string, { cmd: string, ts: number }>
    reloadTriggers: Record<string, number>
    unsavedChanges: Record<string, boolean>
    setUnsavedChanges: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    setPaneContextMenu: (ctx: { x: number; y: number } | null) => void

    // Global State
    settings: any
    openFile: (path: string, type?: any, label?: string, intent?: any, extra?: any) => void
    setActiveTab: (id: string) => void
    setFileMetas: React.Dispatch<React.SetStateAction<Record<string, any>>>
    onTabSelect?: (path: string) => void
    onDirectoryContextMenu?: (e: React.MouseEvent, entry: DirEntry) => void
}

export default function LayoutManager(props: LayoutManagerProps) {
    const { t } = useTranslation()
    const {
        layout, panes, activePaneId, isSidebarExpanded, selectedPath,
        setActivePaneId, setPanes, closePane, splitPane,
        shellCwds, commandSignals, reloadTriggers, unsavedChanges, setUnsavedChanges,
        setPaneContextMenu,
        settings, openFile, setActiveTab, setFileMetas
    } = props

    const { showDialog } = useDialog()

    // Recursive renderer using react-resizable-panels
    const renderLayout = (node: LayoutNode, level: number = 0): React.ReactNode => {
        if (node.type === 'leaf') {
            return (
                <Panel id={`pane-${node.paneId}`} order={1} minSize={10} style={{ display: 'flex', flexDirection: 'column' }}>
                    {renderPane(node.paneId)}
                </Panel>
            )
        }

        // Node is a split
        const direction = node.direction === 'vertical' ? 'horizontal' : 'vertical'

        return (
            <PanelGroup
                direction={direction}
                autoSaveId={`layout-split-${level}-${node.direction}`}
            >
                {/* First Child */}
                {node.children[0].type === 'leaf' ? (
                    renderLayout(node.children[0], level + 1)
                ) : (
                    <Panel minSize={10}>
                        {renderLayout(node.children[0], level + 1)}
                        {/* Resize Handle for Sidebar if strictly needed here? 
                            In App.tsx it was checking isSidebarExpanded for the resizing handle of the sidebar panel 
                            but that's outside this recursive loop typically. 
                            However, if this node is adjacent to sidebar it might matter. 
                            Wait, App.tsx had a specal check: 
                            {isSidebarExpanded && ( <PanelResizeHandle ... sidebar-handle /> )} 
                            This was likely misplaced inside the recursive function in App.tsx or I misread context.
                            Actually, Looking at App.tsx, it seems it was inside renderLayout.
                            Let's keep it safe.
                        */}

                    </Panel>
                )}

                <PanelResizeHandle className={`ResizeHandleOuter group-${direction}`}>
                    <div className="ResizeHandleInner" />
                </PanelResizeHandle>

                {/* Second Child */}
                {node.children[1].type === 'leaf' ? (
                    renderLayout(node.children[1], level + 1)
                ) : (
                    <Panel minSize={10}>
                        {renderLayout(node.children[1], level + 1)}
                    </Panel>
                )}
            </PanelGroup>
        )
    }

    // The content of a single pane (TabBar + Editors)
    const renderPane = (paneId: string) => {
        const pState = panes[paneId]
        if (!pState) return <div className="muted">Pane not found</div>

        // Merge unsaved status and dynamic labels into tabs for rendering
        const pTabs = pState.tabs.map(tab => {
            let label = tab.label

            if (tab.id === 'metadata') {
                label = t('details', 'Details')
            }

            if (tab.type === 'terminal' && !tab.id.startsWith('task-')) {
                const cwd = shellCwds[tab.id]
                if (cwd) {
                    const parts = cwd.split('/').filter(Boolean)
                    if (parts.length > 0) {
                        label = parts[parts.length - 1]
                    } else {
                        label = '/'
                    }
                }
            }
            return {
                ...tab,
                label,
                dirty: unsavedChanges[tab.id] || false
            }
        })
        const pActiveId = pState.activeTabId || ''

        const onActivate = (id: string) => {
            setActivePaneId(paneId)
            setPanes((prev: Record<string, PaneState>) => {
                const p = prev[paneId]
                if (!p) return prev
                return { ...prev, [paneId]: { ...p, activeTabId: id } }
            })

            const tab = pState.tabs.find(t => t.id === id)
            if (tab && props.onTabSelect) {
                // For editors, path is the file path. For others, it might vary.
                // We generally only want to sync file selection for editors or metadata.
                // FIX: Only sync if it's an editor or binary AND has a path. 
                // Metadata tab (id='metadata') usually doesn't have a path relevant to explorer selection.
                // Terminals also shouldn't change file selection.
                if ((tab.type === 'editor' || tab.type === 'binary') && tab.path) {
                    props.onTabSelect(tab.path)
                }
            }
        }

        const onClose = async (id: string) => {
            const p = panes[paneId]
            if (!p) return

            const doClose = () => {
                if (p.tabs.length === 1 && p.tabs[0].id === id && paneId !== 'root') {
                    closePane(paneId)
                    return
                }

                setPanes((prev: Record<string, PaneState>) => {
                    const p2 = prev[paneId]
                    if (!p2) return prev
                    const nextTabs = p2.tabs.filter(x => x.id !== id)
                    let nextActive = p2.activeTabId
                    if (p2.activeTabId === id) {
                        nextActive = nextTabs[0]?.id || ''
                    }
                    return { ...prev, [paneId]: { ...p2, tabs: nextTabs, activeTabId: nextActive } }
                })
            }

            const tabToClose = pTabs.find(t => t.id === id)
            if (tabToClose?.type === 'terminal') {
                try {
                    const r = await authedFetch(`/api/terminal/status?session=${encodeURIComponent(id)}`)
                    if (r.ok) {
                        const j = await r.json()
                        if (j.busy) {
                            showDialog({
                                title: t('terminal_busy', 'Terminal Busy'),
                                message: t('confirm_close_busy_terminal', 'A process is still running in this terminal. Close anyway?'),
                                confirmLabel: t('close_anyway', 'Close Anyway'),
                                onConfirm: doClose
                            })
                            return
                        }
                    }
                } catch (e) {
                    console.warn('Busy check failed', e)
                }
            }

            const hasUnsaved = unsavedChanges[id]
            if (hasUnsaved) {
                showDialog({
                    title: t('unsaved_changes_title', 'Unsaved Changes'),
                    message: t('confirm_close_unsaved', 'You have unsaved changes. Close anyway?'),
                    confirmLabel: t('close_discard', 'Close & Discard'),
                    onConfirm: () => {
                        setUnsavedChanges(prev => {
                            const next = { ...prev }
                            delete next[id]
                            return next
                        })
                        doClose()
                    }
                })
                return
            }

            doClose()
        }

        const isActivePane = paneId === activePaneId

        return (
            <div className={`pane-content modern-tabs`}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0, overflow: 'hidden' }}
                onClick={() => { if (!isActivePane) setActivePaneId(paneId) }}
            >
                {isActivePane && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent)', zIndex: 10 }} />}

                {pTabs.length > 0 ? (
                    <>
                        <div style={{ width: '100%', minWidth: 0, overflow: 'hidden', flexShrink: 0 }} onContextMenu={(e) => {
                            e.preventDefault()
                            setActivePaneId(paneId)
                            setPaneContextMenu({ x: e.clientX, y: e.clientY })
                        }}>
                            <React.Suspense fallback={null}>
                                <TabBarComponent
                                    tabs={pTabs}
                                    activeId={pActiveId}
                                    onActivate={onActivate}
                                    onClose={onClose}
                                    onCloseOthers={(id) => {
                                        setPanes((prev: Record<string, PaneState>) => {
                                            const st = prev[paneId]
                                            if (!st) return prev
                                            const tToKeep = st.tabs.find(t => t.id === id)
                                            if (!tToKeep) return prev
                                            return { ...prev, [paneId]: { ...st, tabs: [tToKeep], activeTabId: id } }
                                        })
                                    }}
                                    onCloseLeft={(id) => {
                                        setPanes((prev: Record<string, PaneState>) => {
                                            const st = prev[paneId]
                                            if (!st) return prev
                                            const idx = st.tabs.findIndex(t => t.id === id)
                                            if (idx <= 0) return prev
                                            const newTabs = st.tabs.slice(idx)
                                            let newActive = st.activeTabId
                                            if (!newTabs.map(t => t.id).includes(newActive)) {
                                                newActive = id
                                            }
                                            return { ...prev, [paneId]: { ...st, tabs: newTabs, activeTabId: newActive } }
                                        })
                                    }}
                                    onSplitRight={(id) => splitPane('vertical', id)}
                                    onSplitDown={(id) => splitPane('horizontal', id)}
                                />
                            </React.Suspense>
                        </div>
                        <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
                            {pTabs.map(tab => (
                                <div key={tab.id} style={{ display: tab.id === pActiveId ? 'block' : 'none', height: '100%' }}>
                                    {(() => {
                                        switch (tab.type) {
                                            case 'terminal':
                                                return (
                                                    <React.Suspense fallback={<div className="muted">{t('loading')}</div>}>
                                                        <TerminalTab
                                                            id={tab.id}
                                                            shell={tab.metadata?.shell || props.settings?.defaultShell || 'bash'}
                                                            path={tab.path}
                                                            label={tab.label}
                                                            initialCommand={commandSignals[tab.id]?.cmd}
                                                            commandSignal={commandSignals[tab.id]}
                                                            onExit={() => onClose && onClose(tab.id)}
                                                            isActive={tab.id === pActiveId}
                                                        />
                                                    </React.Suspense>
                                                )
                                            case 'trash':
                                                return <TrashView />

                                            case 'custom':
                                                // Handle generic custom tabs if any
                                                console.warn(`[LayoutManager] Unknown custom tab type: ${tab.id}`, tab)
                                                return (
                                                    <div className="muted" style={{ padding: 20, textAlign: 'center' }}>
                                                        <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 10 }}>⚠️</div>
                                                        <div>Unknown view type: {tab.id}</div>
                                                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                                                            Check LayoutManager.tsx case 'custom'
                                                        </div>
                                                    </div>
                                                )
                                            case 'directory':
                                                // Singleton directory tab - path is in tab.path after refactoring  
                                                const dirPath = tab.path || tab.metadata?.dirPath || selectedPath
                                                // Don't use key - useEffect in DirectoryView handles path changes
                                                return <DirectoryView path={dirPath} onContextMenu={props.onDirectoryContextMenu} />
                                            case 'logs':
                                                console.log('Rendering ServerLogsView from LayoutManager')
                                                return <ServerLogsView />
                                            case 'binary':
                                            case 'metadata':
                                            case 'preview':
                                                const unifiedPath = tab.type === 'metadata' ? selectedPath : tab.path
                                                // If autoOpen is enabled, default to preview. If disabled, default to metadata.
                                                // If intent is explicit (metadata/preview), respect it.
                                                const defaultMode = (tab.intent === 'metadata' || tab.intent === 'preview')
                                                    ? tab.intent
                                                    : (props.settings?.autoOpen ? 'preview' : 'metadata')
                                                return (
                                                    <React.Suspense fallback={<div className="muted">{t('loading')}</div>}>
                                                        <UnifiedView
                                                            path={unifiedPath}
                                                            onOpen={openFile}
                                                            defaultMode={defaultMode}
                                                        />
                                                    </React.Suspense>
                                                )
                                            case 'editor':
                                            default:
                                                return (
                                                    <Editor
                                                        path={tab.path}
                                                        tab={tab}
                                                        settings={settings || undefined}
                                                        onSaved={() => { /* no-op */ }}
                                                        reloadTrigger={reloadTriggers[tab.id] || 0}
                                                        onUnsavedChange={(path, hasUnsaved) => {
                                                            setUnsavedChanges(prev => ({ ...prev, [path]: hasUnsaved }))
                                                        }}
                                                        onMeta={(m: any) => {
                                                            if (m && m.path) setFileMetas(fm => ({ ...fm, [tab.id]: m }))
                                                        }}
                                                        intent={tab.intent}
                                                        onOpen={openFile}
                                                    />
                                                )
                                        }
                                    })()}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="welcome-message" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '10px', opacity: 0.2 }}><Icon name={getIcon('folder')} size={48} /></div>
                        <div style={{ opacity: 0.5 }}>{t('no_files')}</div>
                        {paneId !== 'root' && <button className="btn link" onClick={() => closePane(paneId)}>{t('close')} Pane</button>}
                    </div>
                )}
            </div>
        )
    }

    return renderLayout(layout)
}
