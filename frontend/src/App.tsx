import React from 'react'
import { statPath, type Health, saveSettings, makeUrl, DirEntry, getToken, uploadFile, renameFile, deleteFile } from './api'
import { useAuth } from './context/AuthContext'
import { useAppSettings } from './hooks/useAppSettings'
import { useWorkspace } from './hooks/useWorkspace'
// import AppHeader from './components/AppHeader'
import AuthOverlay from './components/AuthOverlay'
import AboutPopup from './components/AboutPopup'
// import FileExplorer from './components/FileExplorer'
import { ActivityBar, SidebarPanel } from './components/ModernSidebar'
import SettingsPopup from './components/SettingsPopup'
import ContextMenu, { ContextMenuItem } from './components/ContextMenu'
// import { Intent } from './types/layout'
import { useTranslation } from 'react-i18next'
import { Icon } from './generated/icons'
import { getIconForShell, getIconForDir, getIcon } from './generated/icon-helpers'
import TrashView from './components/views/TrashView'
// import Editor from './components/Editor'
// import BinaryView from './components/views/BinaryView'
// import FileDetailsView from './components/views/FileDetailsView'
// import ServerLogsView from './components/views/ServerLogsView'
const TerminalTab = React.lazy(() => import('./components/views/TerminalTab'))
const OnboardingTour = React.lazy(() => import('./components/OnboardingTour'))
// import TabBarComponent from './components/TabBar'
import LayoutManager from './components/LayoutManager'


import LogOverlay from './components/LogOverlay'
import './modern.css'
// import { formatBytes } from './utils/bytes'
import { captureElementToPng } from './utils/capture'
import { defaultStore, boolSerializer, strSerializer } from './utils/storage'

/**
 * Top-level application component. Manages UI state for the file explorer,
 * editor tabs, terminal tabs and global settings such as theme and sidebar
 * width. Heavy-lifted responsibilities are split into child components.
 */
// import MessageBox from './components/MessageBox'
import StatusBar from './components/StatusBar'
import { getHandler } from './handlers/registry'
import { getHealth, getSettings, listTree, Settings, TaskDef } from './api'
import { Tab, ViewType } from './types/layout'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
// import type { LayoutNode, PaneId, PaneState } from './types/layout'
import { DialogProvider, useDialog } from './context/DialogContext'

function AppInner() {
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
  // These were local state, now derived or managed by hook. 
  const [now, setNow] = React.useState<Date>(new Date())

  const { showDialog } = useDialog()

  const handleContextMenu = (entry: DirEntry, x: number, y: number) => {
    setContextMenu({ x, y, entry })
  }

  const [paneContextMenu, setPaneContextMenu] = React.useState<{ x: number; y: number } | null>(null)

  const isControlled = React.useMemo(() => {
    const p = new URLSearchParams(window.location.search)
    return !!p.get('controlled') || !!p.get('theme')
  }, [])

  // -- Effects --

  type oureventtypes = 'set-theme' | 'screenshot' | 'run-task' | 'app-ready' | 'set-tasks' | 'open-logs' | 'refresh-path'

  // Listen for messages from parent (Desktop wrapper)
  React.useEffect(() => {
    // Notify parent that we are ready to receive data
    window.parent.postMessage({ type: 'app-ready' }, '*')

    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return
      let eventtype: oureventtypes = e.data.type as oureventtypes
      if (eventtype === 'set-theme') {
        const t = e.data.theme
        if (t === 'light' || t === 'dark') {
          setTheme(t)
          defaultStore.set('theme', t, strSerializer as any)
          if (t === 'light') document.documentElement.classList.add('theme-light')
          else document.documentElement.classList.remove('theme-light')
        }
      }
      if (eventtype === 'screenshot') {
        const root = document.querySelector('.app') as HTMLElement
        const name = e.data.filename || 'mlcremote-screenshot.png'
        if (root) captureElementToPng(root, name)
      }
      if (eventtype === 'run-task') {
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
          // we pass icon and color as extra metadata
          const extra = {
            icon: e.data.icon,
            iconColor: e.data.color
          }
          openFile(shellName, 'terminal', name, undefined, extra)
        }
      }
      if (eventtype === 'set-tasks') {
        if (Array.isArray(e.data.tasks)) {
          setQuickTasks(e.data.tasks)
        }
      }
      if (eventtype === 'open-logs') {
        openFile('server-logs', 'logs', 'Server Logs')
        setActiveTab('server-logs')
      }
      if (eventtype === 'refresh-path') {
        const path = e.data.path || '/'
        console.log("[MLCRemote] Refreshing path:", path)
        setRefreshSignal({ path, ts: Date.now() })
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Notify parent of selected path changes for clipboard targets
  React.useEffect(() => {
    window.parent.postMessage({ type: 'path-change', path: selectedPath }, '*')
  }, [selectedPath])


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
        <div className="modern-sidebar" style={{ width: 48, flexShrink: 0, zIndex: 1000, height: '100%', borderRight: '1px solid var(--border)' }}>
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
                        showDialog({ title: 'Broken Link', message: `Cannot open file: ${e.message || 'stat failed'}` })
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
                  onLogout={useAuth().logout}
                />
              )}

              {/* Recursive Panel Layout */}
              <LayoutManager
                layout={layout}
                panes={panes}
                activePaneId={activePaneId}
                isSidebarExpanded={isSidebarExpanded}
                selectedPath={selectedPath}
                setActivePaneId={setActivePaneId}
                setPanes={setPanes}
                closePane={closePane}
                splitPane={splitPane}
                shellCwds={shellCwds}
                commandSignals={commandSignals}
                reloadTriggers={reloadTriggers}
                unsavedChanges={unsavedChanges}
                setUnsavedChanges={setUnsavedChanges}
                setPaneContextMenu={setPaneContextMenu}
                settings={settings}
                openFile={openFile}
                setActiveTab={setActiveTab}
                setFileMetas={setFileMetas}
                binaryPath={binaryPath}
                onTabSelect={setSelectedPath}
              />


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
              },
              {
                label: t('copy_to_local', 'Copy to Local Clipboard'),
                icon: <Icon name="icon-copy" />,
                action: () => {
                  window.parent.postMessage({
                    type: 'copy-to-local',
                    paths: [contextMenu.entry.path],
                    count: 1,
                    names: [contextMenu.entry.name],
                    totalSize: contextMenu.entry.size || 0
                  }, '*')
                }
              },
              {
                label: t('paste_from_local', 'Paste from Local Clipboard'),
                icon: <Icon name="icon-paste" />,
                action: () => {
                  window.parent.postMessage({
                    type: 'paste-from-local',
                    path: contextMenu.entry.path,
                  }, '*')
                }
              }
            ] : [
              {
                label: t('copy_to_local', 'Copy to Local Clipboard'),
                icon: <Icon name="icon-copy" />,
                action: () => {
                  window.parent.postMessage({
                    type: 'copy-to-local',
                    paths: [contextMenu.entry.path],
                    count: 1,
                    names: [contextMenu.entry.name],
                    totalSize: contextMenu.entry.size || 0
                  }, '*')
                }
              },
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
            ]),
            {
              label: t('rename'),
              icon: <Icon name={getIcon('edit')} />,
              action: async () => {
                const item = contextMenu.entry

                showDialog({
                  title: t('rename'),
                  message: t('rename_prompt', { name: item.name }),
                  inputType: 'text',
                  defaultValue: item.name,
                  confirmLabel: t('rename'),
                  onConfirm: async (newName) => {
                    if (!newName || newName === item.name) return

                    try {
                      const parts = item.path.split('/')
                      parts.pop()
                      if (newName.includes('/')) {
                        alert(t('error') + ': Invalid filename') // TODO: Toast
                        return
                      }
                      const newPath = [...parts, newName].join('/')
                      await renameFile(item.path, newPath)
                      // Refresh parent directory
                      const parentPath = parts.join('/') || '/'
                      setRefreshSignal({ path: parentPath, ts: Date.now() })
                    } catch (e: any) {
                      // Reuse message box for error? Or separate Alert?
                      // For now alert, but we should use a Toast or Error Dialog
                      alert(t('status_failed') + ': ' + e.message)
                    }
                  }
                })
              }
            },
            {
              label: t('delete'),
              icon: <Icon name={getIcon('trash')} />,
              danger: true,
              action: async () => {
                const item = contextMenu.entry
                showDialog({
                  title: t('delete'),
                  message: t('delete_confirm', { path: item.path }),
                  confirmLabel: t('delete'),
                  cancelLabel: t('cancel'),
                  onConfirm: async () => {
                    try {
                      await deleteFile(item.path)
                      const parts = item.path.split('/')
                      parts.pop()
                      const parentPath = parts.join('/') || '/'
                      setRefreshSignal({ path: parentPath, ts: Date.now() })
                    } catch (e: any) {
                      showDialog({ title: 'Error', message: t('status_failed') + ': ' + e.message })
                    }
                  }
                })
              }
            }
          ]}
        />
      )}

      <div className="status-bar-container">
        <StatusBar
          health={health}
          isOnline={isOnline}
          hideMemoryUsage={hideMemoryUsage}
          lastHealthAt={lastHealthAt}
        />
      </div>

      <LogOverlay visible={showLogs} onClose={() => setShowLogs(false)} />
      <React.Suspense fallback={null}>
        <OnboardingTour />
      </React.Suspense>

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

export default function App() {
  return (
    <DialogProvider>
      <AppInner />
    </DialogProvider>
  )
}
