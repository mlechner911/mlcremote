import React from 'react'
import { triggerDownload } from './utils/download'
import { statPath, saveSettings, makeUrl, DirEntry, getToken, uploadFile, renameFile, deleteFile, subscribeToEvents } from './api'
import { HealthInfo, Settings } from './api/generated.schemas'
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
// import TrashView from './components/views/TrashView'
// import Editor from './components/Editor'
// import BinaryView from './components/views/BinaryView'
// import FileDetailsView from './components/views/FileDetailsView'
// import ServerLogsView from './components/views/ServerLogsView'
const OnboardingTour = React.lazy(() => import('./components/OnboardingTour'))
// import TabBarComponent from './components/TabBar'
import LayoutManager from './components/LayoutManager'



import './modern.css'
// import { formatBytes } from './utils/bytes'
import { captureElementToPng } from './utils/capture'
import { defaultStore, boolSerializer, strSerializer } from './utils/storage'
import { SPECIAL_TAB_IDS } from './constants/specialTabs'

/**
 * Top-level application component. Manages UI state for the file explorer,
 * editor tabs, terminal tabs and global settings such as theme and sidebar
 * width. Heavy-lifted responsibilities are split into child components.
 */
// import MessageBox from './components/MessageBox'
import StatusBar from './components/StatusBar'
import { getHandler } from './handlers/registry'
import { listTree, TaskDef } from './api'
//import { Tab, ViewType } from './types/layout'
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
  const [selectedPath, setSelectedPath] = React.useState<string>('')
  const [explorerDir, setExplorerDir] = React.useState<string>('')
  const [focusRequest, setFocusRequest] = React.useState<number>(0)

  const prevHealthRef = React.useRef<HealthInfo | null>(null)
  React.useEffect(() => {
    // Only trigger reload when we transition from no-health to health (e.g. login/connect)
    if (!prevHealthRef.current && health) {
      setReloadSignal(Date.now())
      // Default to home directory if no root is set
      if ((!explorerDir || explorerDir === '/') && (health as any).home_dir) {
        const home = (health as any).home_dir
        console.log('[App] Defaulting root to home:', home)
        setExplorerDir(home)
        setSelectedPath(home)
      }
    }
    prevHealthRef.current = health
  }, [health, explorerDir])

  /* Hook Integration */
  const {
    settings, loadedSettings,
    theme, setTheme, themeMode,
    autoOpen, setAutoOpen,
    showHidden, setShowHidden,
    hideMemoryUsage, toggleHideMemoryUsage,
    //  canChangeRoot,
    maxEditorSize, updateMaxEditorSize,
    uiMode, setUiMode,
    updateSettings
  } = useAppSettings()

  /* HOOKS at top level to ensure no conditional hook calls */
  const {
    panes, setPanes,
    layout,
    activePaneId, setActivePaneId,
    openTabs,
    activeTabId, setActiveTab,
    openFile,
    renameTab,
    splitPane, closePane,
    fileMetas, setFileMetas,
  } = useWorkspace()

  // Throttled refresh trigger
  const [refreshSignal, setRefreshSignal] = React.useState<{ path: string, ts: number } | undefined>(undefined)

  const [activeTabResult, setActiveTabResult] = React.useState('files') // files, search, git, etc.

  // Create a ref for activeTab so we can access it in effects/callbacks if needed without stale closures
  // though strictly not needed for the simple switcher below.
  const activeTabRef = React.useRef(activeTabResult)
  React.useEffect(() => { activeTabRef.current = activeTabResult }, [activeTabResult])

  // Subscribe to filesystem events
  React.useEffect(() => {
    // Basic throttle map to prevent UI overload
    // path -> last timestamp
    const throttleMap = new Map<string, number>()

    const unsub = subscribeToEvents((e) => {
      // Throttle frontend updates (limit to 1 per 500ms per path)
      const now = Date.now()
      const last = throttleMap.get(e.path) || 0
      if (now - last < 500) return
      throttleMap.set(e.path, now)

      if (e.type === 'dir_change' || e.type === 'file_change') {
        // ... existing logic ...
        console.log('[App] Received fs event:', e)
        const parts = e.path.split('/')
        // refresh parent dir for files, or the dir itself
        let targetPath = e.path
        if (e.type === 'file_change') {
          parts.pop() // remove filename
          targetPath = parts.join('/') || '/'
        }

        // Update signal
        setRefreshSignal({ path: targetPath, ts: Date.now() })
      } else if (e.type === 'cwd_update') {
        // Legacy handling
        console.log('[App] Received cwd_update:', e.path)

        // Smart sync: only change root if path is not visible in current tree
        let isDescendant = false
        if (explorerDir === '/' || explorerDir === '') {
          isDescendant = true
        } else {
          if (e.path === explorerDir || e.path.startsWith(explorerDir + '/')) {
            isDescendant = true
          }
        }

        if (isDescendant) {
          setSelectedPath(e.path)
        } else {
          setExplorerDir(e.path)
        }

        if (activeTabId && (activeTabId.startsWith('shell-') || activeTabId.startsWith('task-'))) {
          const label = e.path === '/' ? '/' : e.path.split('/').pop() || e.path
          renameTab(activeTabId, label)
        }
      } else if (e.type === 'remote_command') {
        console.log('[App] Received remote_command:', e.path, e.payload)
        const cmd = e.path // We mapped valid command name to Path in backend
        const args = e.payload || {}

        if (cmd === 'set_cwd') {
          const path = args.path || (args._positional && args._positional[0])
          if (path) {
            // Check if path is within current explorerDir to preserve tree view
            let isDescendant = false
            if (explorerDir === '/' || explorerDir === '') {
              isDescendant = true
            } else {
              // Ensure we don't partial match /FOO vs /FOOBAR
              if (path === explorerDir || path.startsWith(explorerDir + '/')) {
                isDescendant = true
              }
            }

            if (isDescendant) {
              setSelectedPath(path)
            } else {
              setExplorerDir(path)
            }

            if (activeTabId && (activeTabId.startsWith('shell-') || activeTabId.startsWith('task-'))) {
              const label = path === '/' ? '/' : path.split('/').pop() || path
              renameTab(activeTabId, label)
            }
          }
        } else if (cmd === 'show_message') {
          const level = args.level
          const variant = (['info', 'error', 'warning', 'success'].includes(level) ? level : 'info') as 'info' | 'error' | 'warning' | 'success'

          showDialog({
            title: (level || 'Info').toUpperCase(),
            message: args.message || (args._positional && args._positional.join(' ')) || 'No message content',
            confirmLabel: 'OK',
            variant: variant,
            onConfirm: () => { }
          })
        } else if (cmd === 'open_file') {
          const path = args.path || (args._positional && args._positional[0])
          if (path) {
            // mode: 'edit' | 'preview' | 'view'
            const mode = args.mode || 'edit'
            // Map mode to ViewType if needed, or just pass to openFile
            let viewType: 'editor' | 'preview' | 'custom' = 'editor'
            if (mode === 'preview') viewType = 'preview'

            if (mode === 'view') {
              // Special case for viewing without editing?
              // For now standard openFile behavior handling 'custom' or 'binary' is implicit
            }
            openFile(path, viewType)
          }
        }
      }
    })
    return unsub
  }, [activeTabId, renameTab])



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
  const [aboutOpen, setAboutOpen] = React.useState<boolean>(false)
  const [contextMenu, setContextMenu] = React.useState<{ x: number, y: number, entry: DirEntry } | null>(null)
  const [shellCwds, setShellCwds] = React.useState<Record<string, string>>({})
  const [commandSignals, setCommandSignals] = React.useState<Record<string, { cmd: string, ts: number }>>({})

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

  // Notify parent of theme changes: Disabled for simplification
  // React.useEffect(() => {
  //   if (isControlled) {
  //     window.parent.postMessage({ type: 'theme-change', theme, mode: themeMode }, '*')
  //   }
  // }, [theme, themeMode, isControlled])


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
        console.log("[MLCRemote] Received open-logs message")
        openFile(SPECIAL_TAB_IDS.SERVER_LOGS)  // Type and label auto-determined by createTab
        setActiveTab(SPECIAL_TAB_IDS.SERVER_LOGS)
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

  // checkHealthStatus wrapper for compatibility
  const checkHealthStatus = React.useCallback(async () => {
    await refreshHealth()
  }, [refreshHealth])

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])




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
              // If selectedPath is a file, use its directory; otherwise use the path as-is
              let terminalPath = selectedPath || '/'
              const meta = fileMetas[selectedPath]
              if (meta && !meta.isDir) {
                // Extract parent directory from file path
                const parts = selectedPath.split('/')
                parts.pop() // Remove filename
                terminalPath = parts.join('/') || '/'
              }
              setShellCwds(s => ({ ...s, [shellName]: terminalPath }))
              openFile(shellName, 'terminal', 'Terminal')
            }}
            onOpenTrash={() => {
              openFile(SPECIAL_TAB_IDS.TRASH, 'custom', 'Trash')
              setActiveTab(SPECIAL_TAB_IDS.TRASH)
            }}
            onOpenLogs={() => {
              openFile(SPECIAL_TAB_IDS.SERVER_LOGS, 'logs', 'Server Logs')
              setActiveTab(SPECIAL_TAB_IDS.SERVER_LOGS)
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
                      // Open directory view - openFile will handle singleton behavior
                      openFile(p, 'directory', p.split('/').pop() || 'Directory', undefined, { icon: 'folder', metadata: { dirPath: p } })
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
                          } else if (activeTabId !== SPECIAL_TAB_IDS.METADATA) {
                            // Fallback to details view if not auto-opening
                            openFile(SPECIAL_TAB_IDS.METADATA)
                          }
                          checkHealthStatus()
                          return
                        }

                        // Probe with 'view' intent for consistency
                        const hWithIntent = getHandler({ path: p, meta: st, intent: 'view' })

                        // Detect binary/unsupported files and open with binary type (singleton)
                        // Also handle visual types (SVG, Image, etc) via preview
                        if (!hWithIntent.isEditable || h.name === 'Binary' || h.name === 'Unsupported') {
                          openFile(p, h.name === 'Binary' ? 'binary' : 'preview')
                          return
                        }

                        openFile(p, 'editor')
                      } catch (e: any) {
                        showDialog({ title: 'Broken Link', message: `Cannot open file: ${e.message || 'stat failed'}` })
                        return
                      }
                    })()
                    checkHealthStatus()
                  }}
                  onOpen={async (p) => {
                    // Detect file type to ensure binary files open as singleton
                    try {
                      const st = await statPath(p)
                      // Probe with 'view' intent to see if we have a specialized viewer
                      const h = getHandler({ path: p, meta: st, intent: 'view' })

                      // If the viewer says it's NOT editable (e.g. Image, Binary, PDF, Markdown preview),
                      // or explicitly if it's one of our smart types, use the Unified Preview.
                      // Otherwise (Text/Code), open the Editor.
                      const viewType = !h.isEditable ? 'preview' : 'editor'
                      openFile(p, viewType)
                    } catch (e) {
                      // Fallback to default if stat fails
                      openFile(p)
                    }
                  }}
                  onContextMenu={handleContextMenu}
                  refreshSignal={refreshSignal}
                  onRefresh={() => setRefreshSignal({ path: '/', ts: Date.now() })}
                  onChangeRoot={(currentRoot) => {
                    showDialog({
                      title: t('change_root', 'Change Root'),
                      message: t('enter_new_root_path', 'Enter absolute path for new root directory:'),
                      inputType: 'text',
                      defaultValue: currentRoot,
                      confirmLabel: t('change', 'Change'),
                      onConfirm: async (newPath) => {
                        if (!newPath) return
                        try {
                          const st = await statPath(newPath)
                          if (!st || !st.isDir) {
                            throw new Error(t('not_a_directory', 'Path is not a directory'))
                          }
                          setExplorerDir(newPath)
                          setSelectedPath(newPath)
                          setRefreshSignal({ path: newPath, ts: Date.now() })
                          // Also update settings to persist if needed, or just session state?
                          // For session: setExplorerDir is enough.
                        } catch (e: any) {
                          showDialog({ title: t('error'), message: e.message || t('invalid_path'), variant: 'error' })
                        }
                      }
                    })
                  }}
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
                  isControlled={isControlled}
                  autoOpen={autoOpen}
                  showHidden={showHidden}
                  onToggleAutoOpen={setAutoOpen}
                  onToggleShowHidden={setShowHidden}
                  hideMemoryUsage={hideMemoryUsage}
                  onToggleHideMemoryUsage={toggleHideMemoryUsage}
                  onClose={() => setSettingsOpen(false)}
                  onLanguageChange={(l) => {
                    if (l !== i18n.language) {
                      i18n.changeLanguage(l)
                      updateSettings({ language: l })
                    }
                  }}
                  maxEditorSize={maxEditorSize}
                  onMaxFileSizeChange={updateMaxEditorSize}
                  theme={themeMode}
                  onToggleTheme={setTheme}
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

                onTabSelect={setSelectedPath}
                onDirectoryContextMenu={(e, entry) => {
                  // Reuse the same context menu logic as file explorer
                  setContextMenu({ x: e.clientX, y: e.clientY, entry })
                }}
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
                // Pass 'metadata' intent to force defaultMode='metadata' in UnifiedView
                openFile(SPECIAL_TAB_IDS.METADATA, undefined, undefined, 'metadata')
              }
            },
            ...(contextMenu.entry.isDir ? [
              {
                label: t('open_terminal_here', 'Open Terminal Here'),
                icon: <Icon name={getIcon('terminal')} />,
                action: () => {
                  const path = contextMenu.entry.path
                  const id = `shell-${Date.now()}?cwd=${encodeURIComponent(path)}`
                  // Force type 'terminal' and explicitly use directory path as label
                  openFile(id, 'terminal', path)
                }
              },
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
                      openFile(SPECIAL_TAB_IDS.METADATA)
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
                  triggerDownload(contextMenu.entry.path)
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
