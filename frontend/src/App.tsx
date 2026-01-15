import React from 'react'
import { statPath, type Health, saveSettings, makeUrl, DirEntry, getToken, uploadFile } from './api'
import { useAuth } from './context/AuthContext'
import { useAppSettings } from './hooks/useAppSettings'
import { useWorkspace } from './hooks/useWorkspace'
import AppHeader from './components/AppHeader'
import AuthOverlay from './components/AuthOverlay'
import AboutPopup from './components/AboutPopup'
import FileExplorer from './components/FileExplorer'
import { ActivityBar, SidebarPanel } from './components/ModernSidebar'
import SettingsPopup from './components/SettingsPopup'
import ContextMenu, { ContextMenuItem } from './components/ContextMenu'
import { Intent } from './types/layout'
import { useTranslation } from 'react-i18next'
import { Icon } from './generated/icons'
import { getIconForShell, getIconForDir, getIcon } from './generated/icon-helpers'
import TrashView from './components/TrashView'
import Editor from './components/Editor'
import BinaryView from './components/BinaryView'
import FileDetailsView from './components/FileDetailsView'
import ServerLogsView from './components/ServerLogsView'
const TerminalTab = React.lazy(() => import('./components/TerminalTab'))
import TabBarComponent from './components/TabBar'


import LogOverlay from './components/LogOverlay'
import './modern.css'
import { formatBytes } from './utils/bytes'
import { captureElementToPng } from './utils/capture'
import { defaultStore, boolSerializer, strSerializer } from './utils/storage'

/**
 * Top-level application component. Manages UI state for the file explorer,
 * editor tabs, terminal tabs and global settings such as theme and sidebar
 * width. Heavy-lifted responsibilities are split into child components.
 */
import MessageBox from './components/MessageBox'
import StatusBar from './components/StatusBar'
import { getHandler } from './handlers/registry'
import StatusBar from './components/StatusBar'
import { getHandler } from './handlers/registry'
import { getHealth, getSettings, listTree, Settings, TaskDef } from './api'
import { Tab, ViewType } from './types/layout'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { LayoutNode, PaneId, PaneState } from './types/layout'

export default function App() {
  const { t, i18n } = useTranslation()
  const [quickTasks, setQuickTasks] = React.useState<TaskDef[]>(() => {
    // Try to read initial tasks from window.name (injected by desktop wrapper)
    try {
      if (!window.name || !window.name.startsWith('{')) return []
      const data = JSON.parse(window.name)
      if (data && Array.isArray(data.tasks)) return data.tasks
    } catch (e) {
    }
    return []
  })

  const {
    health, isOnline, lastHealthAt, refreshHealth
  } = useAuth()



  // reloadSignal is used to force-refresh the file explorer.
  // We can update it when health updates (successful auth).
  const [reloadSignal, setReloadSignal] = React.useState<number>(0)
  const prevHealthRef = React.useRef<Health | null>(null)
  React.useEffect(() => {
    // Only trigger reload when we transition from no-health to health (e.g. login/connect)
    if (!prevHealthRef.current && health) {
      setReloadSignal(Date.now())
    }
    prevHealthRef.current = health
  }, [health])

  const [selectedPath, setSelectedPath] = React.useState<string>('')
  const [explorerDir, setExplorerDir] = React.useState<string>('')
  const handleExplorerDirChange = React.useCallback((d: string) => setExplorerDir(d), [])
  const [focusRequest, setFocusRequest] = React.useState<number>(0)


  // -- Layout State --

  /* Hook Integration */
  const {
    settings, loadedSettings,
    theme, setTheme,
    autoOpen, setAutoOpen,
    showHidden, setShowHidden,
    showLogs, toggleLogs: setShowLogs,
    showServerLogs, toggleServerLogs,
    hideMemoryUsage, toggleHideMemoryUsage,
    canChangeRoot,
    maxEditorSize, updateMaxEditorSize,
    uiMode, setUiMode
  } = useAppSettings()

  const {
    panes, setPanes,
    layout, setLayout,
    activePaneId, setActivePaneId,
    openTabs, setOpenTabs,
    activeTabId, setActiveTab,
    openFile,
    splitPane, closePane, handleLayoutResize,
    fileMetas, setFileMetas,

  } = useWorkspace()

  /* Sidebar Toggle Logic */
  const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(() => {
    // Check URL param for initial state
    const p = new URLSearchParams(window.location.search)
    return !p.get('collapsed')
  })

  const toggleSidebar = (expand: boolean) => {
    setIsSidebarExpanded(expand)
  }

  const [logoVisible, setLogoVisible] = React.useState<boolean>(true)
  const [settingsOpen, setSettingsOpen] = React.useState<boolean>(false)
  const [refreshSignal, setRefreshSignal] = React.useState<{ path: string, ts: number } | undefined>(undefined)
  const [aboutOpen, setAboutOpen] = React.useState<boolean>(false)
  const [contextMenu, setContextMenu] = React.useState<{ x: number, y: number, entry: DirEntry } | null>(null)
  const [shellCwds, setShellCwds] = React.useState<Record<string, string>>({})
  const [commandSignals, setCommandSignals] = React.useState<Record<string, { cmd: string, ts: number }>>({})

  // These were local state, now derived or managed by hook. 
  const [now, setNow] = React.useState<Date>(new Date())
  const [messageBox, setMessageBox] = React.useState<{ title: string; message: string; onConfirm?: () => void; confirmLabel?: string; cancelLabel?: string } | null>(null)

  const handleContextMenu = (entry: DirEntry, x: number, y: number) => {
    setContextMenu({ x, y, entry })
  }

  const [paneContextMenu, setPaneContextMenu] = React.useState<{ x: number; y: number } | null>(null)

  const isControlled = React.useMemo(() => {
    const p = new URLSearchParams(window.location.search)
    return !!p.get('controlled') || !!p.get('theme')
  }, [])

  // -- Effects --

  // Listen for messages from parent (Desktop wrapper)
  React.useEffect(() => {
    // Notify parent that we are ready to receive data
    window.parent.postMessage({ type: 'app-ready' }, '*')

    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return
      if (e.data.type === 'set-theme') {
        const t = e.data.theme
        if (t === 'light' || t === 'dark') {
          setTheme(t)
          defaultStore.set('theme', t, strSerializer as any)
          if (t === 'light') document.documentElement.classList.add('theme-light')
          else document.documentElement.classList.remove('theme-light')
        }
      }
      if (e.data.type === 'screenshot') {
        const root = document.querySelector('.app') as HTMLElement
        const name = e.data.filename || 'mlcremote-screenshot.png'
        if (root) captureElementToPng(root, name)
      }
      if (e.data.type === 'run-task') {
        const cmd = e.data.command
        const name = e.data.name || 'Task'
        console.log("[MLCRemote] Received run-task command:", name)
        if (cmd) {
          // Stable ID based on task name to allow reuse
          const shellName = `task-${name.replace(/[^a-zA-Z0-9-]/g, '-')}`

          setShellCwds(s => ({ ...s, [shellName]: '/' }))
          // Always set a new signal with current timestamp to trigger effect
          setCommandSignals(s => ({ ...s, [shellName]: { cmd, ts: Date.now() } }))

          // This will focus if exists, or open new if not
          // Pass icon and color as extra metadata
          const extra = {
            icon: e.data.icon,
            iconColor: e.data.color
          }
          openFile(shellName, 'terminal', name, undefined, extra)
        }
      }
      if (e.data.type === 'set-tasks') {
        if (Array.isArray(e.data.tasks)) {
          setQuickTasks(e.data.tasks)
        }
      }
      if (e.data.type === 'open-logs') {
        openFile('server-logs', 'logs', 'Server Logs')
        setActiveTab('server-logs')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])


  const [reloadTriggers, setReloadTriggers] = React.useState<Record<string, number>>({})
  const [unsavedChanges, setUnsavedChanges] = React.useState<Record<string, boolean>>({})


  // Stable handler
  const handleUnsavedChange = React.useCallback((path: string, hasUnsaved: boolean) => {
    setUnsavedChanges(changes => ({ ...changes, [path]: hasUnsaved }))
  }, [])

  // checkHealthStatus wrapper for compatibility
  const checkHealthStatus = React.useCallback(async () => {
    await refreshHealth()
  }, [refreshHealth])

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const [binaryPath, setBinaryPath] = React.useState<string | null>(null)

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
    // direction 'horizontal' means side-by-side panels, so vertical divider -> group-horizontal
    // direction 'vertical' means stacked panels, so horizontal divider -> group-vertical

    return (
      <PanelGroup
        direction={direction}
        autoSaveId={`layout-split-${level}-${node.direction}`}
      >
        {/* We need to wrap children in Fragments or Panels depending on structure. 
            Since renderLayout returns a Panel or PanelGroup, we can nest them directly?
            Actually, PanelGroup expects direct Panel children mostly. 
            But nested PanelGroups are allowed inside Panels.
        */}

        {/* First Child */}
        {node.children[0].type === 'leaf' ? (
          renderLayout(node.children[0], level + 1)
        ) : (
          <Panel minSize={10}>
            {renderLayout(node.children[0], level + 1)}
            {/* Resize Handle for Sidebar */}
            {isSidebarExpanded && (
              <PanelResizeHandle className="ResizeHandleOuter group-horizontal sidebar-handle">
                <div className="ResizeHandleInner" />
              </PanelResizeHandle>
            )}
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

      // Defensive fix: Ensure metadata tab always says "Details"
      if (tab.id === 'metadata') {
        label = t('details', 'Details')
      }

      if (tab.type === 'terminal' && !tab.id.startsWith('task-')) {
        const cwd = shellCwds[tab.id]
        if (cwd) {
          const parts = cwd.split('/').filter(Boolean)
          if (parts.length > 0) {
            label = parts[parts.length - 1]
            if (parts.length > 1 && label.includes('.')) {
              // heuristic: if it looks like a file, maybe show parent dir? 
              // or just show the dir name. The old logic had some complex checks.
              // Old logic:
              /*
                 if (last.includes('.') && parts.length > 1) {
                     name = parts[parts.length - 2]
                 }
              */
              // We'll trust the simpler 'last part' for now or match old logic if crucial.
              // Let's match old logic for consistency.
              label = parts[parts.length - 1]
            }
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

    // Local handlers for this pane
    const onActivate = (id: string) => {
      setActivePaneId(paneId) // focus pane
      setPanes((prev: Record<string, PaneState>) => {
        const p = prev[paneId]
        if (!p) return prev
        return { ...prev, [paneId]: { ...p, activeTabId: id } }
      })

      // side effects (explorer dir sync)
      // find the tab
      const tab = pState.tabs.find(t => t.id === id)
      if (tab && tab.type === 'editor' && !tab.path.includes('metadata')) {
        const parts = tab.path.split('/').filter(Boolean)
        parts.pop()
        // const dir = parts.length ? `/${parts.join('/')}` : ''
        // if (dir !== explorerDir) setExplorerDir(dir) // optional sync
      }
      if (tab && tab.id !== 'metadata' && tab.type === 'editor') setSelectedPath(tab.path)
      setFocusRequest(Date.now())
    }

    const onClose = (id: string) => {
      // close tab logic
      const p = panes[paneId]
      if (!p) return

      const doClose = () => {
        // logic: if this is the last tab in the pane, AND we are not root, close the pane
        if (p.tabs.length === 1 && p.tabs[0].id === id && paneId !== 'root') {
          closePane(paneId)
          return
        }

        setPanes((prev: Record<string, PaneState>) => {
          const p2 = prev[paneId]
          if (!p2) return prev
          const nextTabs = p2.tabs.filter(x => x.id !== id)
          // if closing active
          let nextActive = p2.activeTabId
          if (p2.activeTabId === id) {
            nextActive = nextTabs[0]?.id || ''
          }
          return { ...prev, [paneId]: { ...p2, tabs: nextTabs, activeTabId: nextActive } }
        })
      }

      const hasUnsaved = unsavedChanges[id]
      if (hasUnsaved) {
        setMessageBox({
          title: t('unsaved_changes_title', 'Unsaved Changes'),
          message: t('confirm_close_unsaved', 'You have unsaved changes. Close anyway?'),
          confirmLabel: t('close_discard', 'Close & Discard'),
          onConfirm: () => {
            setMessageBox(null)
            // Force clear unsaved status
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
        {/* Active Indicator Border */}
        {isActivePane && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent)', zIndex: 10 }} />}

        {pTabs.length > 0 ? (
          <>
            {/* TabBar Container: flex-shrink: 0 is CRITICAL to prevent the tab bar from being 
                crushed to 0 height when content expands (like large images). 
                minWidth: 0 allows the flex container to shrink below content size if needed (for scrolling). */}
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
            {/* Content Container: minHeight: 0 and overflow: hidden are required for nested flex scrolling to work correctly. */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
              {pTabs.map(tab => (
                <div key={tab.id} style={{ display: tab.id === pActiveId ? 'block' : 'none', height: '100%' }}>
                  {(() => {
                    switch (tab.type) {
                      case 'terminal':
                        return (
                          <React.Suspense fallback={<div className="muted">{t('loading')}</div>}>
                            <TerminalTab
                              shell={(() => {
                                const urlShell = new URLSearchParams(window.location.search).get('shell')
                                return urlShell || (settings && settings.defaultShell) || 'bash'
                              })()}
                              path={shellCwds[tab.id] || ''}
                              label={tab.label}                           // Pass the label!
                              initialCommand={commandSignals[tab.id]?.cmd}
                              commandSignal={commandSignals[tab.id]}
                              onExit={() => onClose(tab.id)}
                            />
                          </React.Suspense>
                        )
                      case 'custom':
                        if (tab.id === 'trash') return <TrashView />
                        if (tab.id === 'metadata') return <FileDetailsView path={selectedPath} />
                        return null
                      case 'logs':
                        return <ServerLogsView />
                      case 'binary':
                        return (
                          <React.Suspense fallback={<div className="muted">Loading…</div>}>
                            <BinaryView path={binaryPath || undefined} />
                          </React.Suspense>
                        )
                      case 'editor':
                      default:
                        return (
                          <Editor path={tab.path} settings={settings || undefined} onSaved={() => { /* no-op */ }} reloadTrigger={reloadTriggers[tab.id] || 0} onUnsavedChange={handleUnsavedChange} onMeta={(m: any) => {
                            if (m && m.path) setFileMetas(fm => ({ ...fm, [tab.id]: m }))
                          }} intent={tab.intent} onOpen={openFile} />
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

  if (!loadedSettings) return null // or loading spinner


  return (
    <div className={`app ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      {paneContextMenu && (
        <ContextMenu
          x={paneContextMenu.x}
          y={paneContextMenu.y}
          onClose={() => setPaneContextMenu(null)}
          items={[
            { label: t('split_right', 'Split Right'), action: () => splitPane('vertical') },
            { label: t('split_down', 'Split Down'), action: () => splitPane('horizontal') },
          ]}
        />
      )}

      <div className="app-body" style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden', alignItems: 'stretch' }}>

        {/* Activity Bar - Always Visible */}
        <div style={{ width: 48, flexShrink: 0, zIndex: 1000, height: '100%', borderRight: '1px solid var(--border)' }}>
          <ActivityBar
            isExpanded={isSidebarExpanded}
            onToggleSidebar={toggleSidebar}
            quickTasks={quickTasks}
            onRunTask={(task: any) => {
              // Reuse existing message simulation to run task
              window.postMessage({ type: 'run-task', ...task }, '*')
            }}
            onOpenTerminal={() => {
              const shellName = `shell-${Date.now()}`
              setShellCwds(s => ({ ...s, [shellName]: selectedPath || '/' }))
              openFile(shellName, 'terminal', 'Terminal')
            }}
            onOpenTrash={() => {
              openFile('trash', 'custom', 'Trash')
              setActiveTab('trash')
            }}
            showServerLogs={showServerLogs}
            onOpenLogs={() => {
              openFile('server-logs', 'logs', 'Server Logs')
              setActiveTab('server-logs')
            }}
            onToggleSettings={() => setSettingsOpen(s => !s)}
            onActivityChange={() => { }} // Required by strict interface but unused in App
          />
        </div>

        {/* Top-level PanelGroup for Sidebar Panel + Main Content */}
        <PanelGroup direction="horizontal" autoSaveId="local-persistence-top" style={{ flex: 1, minWidth: 0 }}>
          {/* Sidebar Panel - Collapsible */}
          {isSidebarExpanded && (
            <Panel defaultSize={20} minSize={10} maxSize={40} collapsible={true} order={1} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <aside className="sidebar" style={{ width: '100%', height: '100%', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <SidebarPanel
                  showHidden={showHidden}
                  selectedPath={selectedPath}
                  root={explorerDir || '/'}
                  onSelect={(p, isDir) => {
                    /* Reusing existing selection logic */
                    setSelectedPath(p)
                    if (isDir) {
                      openFile('metadata', 'custom', 'Details')
                      return
                    }
                    (async () => {
                      try {
                        const st = await statPath(p)
                        const h = getHandler({ path: p, meta: st })

                        if (!autoOpen) {
                          const existing = openTabs.find(t => t.id === p)
                          if (existing) {
                            setActiveTab(p)
                          } else if (activeTabId !== 'metadata') {
                            // Fallback to details view if not auto-opening
                            openFile('metadata', 'custom', 'Details')
                          }
                          checkHealthStatus()
                          return
                        }

                        if (h.name === 'Binary' || h.name === 'Unsupported') {
                          openFile('binary', 'binary', 'Binary View')
                          setBinaryPath(p)
                          setActiveTab('binary')
                          return
                        }

                        openFile(p)
                      } catch (e: any) {
                        setMessageBox({ title: 'Broken Link', message: `Cannot open file: ${e.message || 'stat failed'}` })
                        return
                      }
                    })()
                    checkHealthStatus()
                  }}
                  onOpen={(p) => {
                    openFile(p)
                  }}
                  onContextMenu={handleContextMenu}
                  refreshSignal={refreshSignal}
                  onRefresh={() => setRefreshSignal({ path: '/', ts: Date.now() })}
                />
              </aside>
            </Panel>
          )}

          {isSidebarExpanded && (
            <PanelResizeHandle className="ResizeHandleOuter group-horizontal">
              <div className="ResizeHandleInner"></div>
            </PanelResizeHandle>
          )}

          {/* Main Content Panel */}
          <Panel order={2} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Unified authentication chooser/modal */}
              <AuthOverlay />
              {messageBox && (
                <MessageBox
                  title={messageBox.title}
                  message={messageBox.message}
                  onClose={() => setMessageBox(null)}
                  onConfirm={messageBox.onConfirm}
                  confirmLabel={messageBox.confirmLabel}
                  cancelLabel={messageBox.cancelLabel}
                />
              )}

              {settingsOpen && (
                <SettingsPopup
                  autoOpen={autoOpen}
                  showHidden={showHidden}
                  onToggleAutoOpen={setAutoOpen}
                  onToggleShowHidden={setShowHidden}
                  showLogs={showLogs}
                  onToggleLogs={setShowLogs}
                  showServerLogs={showServerLogs || false}
                  onToggleServerLogs={toggleServerLogs}
                  hideMemoryUsage={hideMemoryUsage}
                  onToggleHideMemoryUsage={toggleHideMemoryUsage}
                  onClose={() => setSettingsOpen(false)}
                  onLanguageChange={(l) => {
                    if (l !== i18n.language) {
                      i18n.changeLanguage(l)
                      saveSettings({ language: l }).catch(console.error)
                    }
                  }}
                  maxEditorSize={maxEditorSize}
                  onMaxFileSizeChange={updateMaxEditorSize}
                  uiMode={uiMode}
                  onToggleUiMode={setUiMode}
                />
              )}

              {/* Recursive Panel Layout */}
              {renderLayout(layout)}


            </div>
          </Panel>
        </PanelGroup>
      </div>
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: t('properties', 'Properties'),
              icon: <Icon name={getIcon('info')} />,
              action: () => {
                setSelectedPath(contextMenu.entry.path)
                openFile('metadata', 'custom', 'Details')
              }
            },
            ...(contextMenu.entry.isDir ? [
              {
                label: t('upload_file', 'Upload File'),
                icon: <Icon name="icon-upload" />,
                action: () => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.onchange = async (e: any) => {
                    const file = e.target.files[0]
                    if (!file) return
                    try {
                      await uploadFile(contextMenu.entry.path, file)
                      const newPath = (contextMenu.entry.path === '/' ? '' : contextMenu.entry.path) + '/' + file.name
                      setSelectedPath(newPath)
                      openFile('metadata', 'custom', 'Details')
                      setRefreshSignal({ path: contextMenu.entry.path, ts: Date.now() })
                    } catch (err) {
                      console.error(err)
                      alert(t('upload_failed', 'Upload failed'))
                    }
                  }
                  input.click()
                }
              }
            ] : [
              {
                label: t('open', 'Open'),
                icon: <Icon name={getIcon('terminal')} />,
                action: () => {
                  setSelectedPath(contextMenu.entry.path)
                  openFile(contextMenu.entry.path, undefined, undefined, 'edit')
                }
              },
              {
                label: t('preview', 'Open Preview'),
                icon: <Icon name={getIcon('view')} />,
                action: () => {
                  setSelectedPath(contextMenu.entry.path)
                  openFile(contextMenu.entry.path, undefined, undefined, 'view')
                }
              },
              {
                label: t('download', 'Download'),
                icon: <Icon name="icon-download" />,
                action: () => {
                  const token = getToken()
                  const url = makeUrl(`/api/file?path=${encodeURIComponent(contextMenu.entry.path)}&token=${token}&download=true`)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = contextMenu.entry.name
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                }
              }
            ])
          ]}
        />
      )}

      <StatusBar
        health={health}
        isOnline={isOnline}
        hideMemoryUsage={hideMemoryUsage}
        lastHealthAt={lastHealthAt}
      />

      <LogOverlay visible={showLogs} onClose={() => setShowLogs(false)} />

      {aboutOpen && (
        <AboutPopup
          onClose={() => setAboutOpen(false)}
          health={health}
          lastHealthAt={lastHealthAt}
        />
      )}
    </div>
  )
}
