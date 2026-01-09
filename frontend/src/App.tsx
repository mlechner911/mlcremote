import React from 'react'
import { statPath, type Health } from './api'
import { useAuth } from './context/AuthContext'
import { useAppSettings } from './hooks/useAppSettings'
import { useWorkspace } from './hooks/useWorkspace'
import AppHeader from './components/AppHeader'
import AuthOverlay from './components/AuthOverlay'
import AboutPopup from './components/AboutPopup'
import FileExplorer from './components/FileExplorer'
import SettingsPopup from './components/SettingsPopup'
import { useTranslation } from 'react-i18next'
import { Icon } from './generated/icons'
import { getIconForShell, getIconForDir, getIcon } from './generated/icon-helpers'
import TrashView from './components/TrashView'
import Editor from './components/Editor'
import BinaryView from './components/BinaryView'
import FileDetailsView from './components/FileDetailsView'
const TerminalTab = React.lazy(() => import('./components/TerminalTab'))
import TabBarComponent from './components/TabBar'


import LogOverlay from './components/LogOverlay'
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
import SplitPane from './components/SplitPane'
import type { LayoutNode, PaneId, PaneState } from './types/layout'

export default function App() {
  const { t } = useTranslation()

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
    hideMemoryUsage, toggleHideMemoryUsage,
    canChangeRoot,
    maxEditorSize, updateMaxEditorSize,
    i18n
  } = useAppSettings()

  const {
    panes, setPanes,
    layout, setLayout,
    activePaneId, setActivePaneId,
    openFiles, setOpenFiles,
    activeFile, setActiveFile,
    openFile,
    splitPane, closePane, handleLayoutResize,
    fileMetas, setFileMetas,
    evictedTabs
  } = useWorkspace()

  /* Local UI State */
  const [sidebarWidth, setSidebarWidth] = React.useState<number>(300)
  const [logoVisible, setLogoVisible] = React.useState<boolean>(true)
  const [settingsOpen, setSettingsOpen] = React.useState<boolean>(false)
  const [aboutOpen, setAboutOpen] = React.useState<boolean>(false)
  const [shellCwds, setShellCwds] = React.useState<Record<string, string>>({})

  // These were local state, now derived or managed by hook. 
  // We keep `now` for clock if needed (where is it used?) - it was for StatusBar maybe?
  const [now, setNow] = React.useState<Date>(new Date())
  const [messageBox, setMessageBox] = React.useState<{ title: string; message: string } | null>(null)

  const isControlled = React.useMemo(() => {
    const p = new URLSearchParams(window.location.search)
    return !!p.get('controlled') || !!p.get('theme')
  }, [])

  // Listen for messages from parent (Desktop Overlay)
  React.useEffect(() => {
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
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Cleaned up auth state and effects (moved to AuthContext)

  const [reloadTriggers, setReloadTriggers] = React.useState<Record<string, number>>({})
  const [unsavedChanges, setUnsavedChanges] = React.useState<Record<string, boolean>>({})
  // fileMetas moved to useWorkspace

  // Stable handler for child editors to report unsaved status. Using
  // `useCallback` keeps the reference stable so we can pass the same
  // function to multiple `Editor` instances without recreating it on
  // every render (avoids React warnings about changing callback
  // references).
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



  // Recursive renderer
  const renderLayout = (node: LayoutNode): React.ReactNode => {
    if (node.type === 'leaf') {
      return renderPane(node.paneId)
    }
    return (
      <SplitPane
        direction={node.direction}
        initialSize={node.size}
        onResize={(sz) => handleLayoutResize(node, sz)}
      >
        {renderLayout(node.children[0])}
        {renderLayout(node.children[1])}
      </SplitPane>
    )
  }

  // The content of a single pane (TabBar + Editors)
  const renderPane = (paneId: string) => {
    const pState = panes[paneId]
    if (!pState) return <div className="muted">Pane not found</div>
    const pFiles = pState.files
    const pActive = pState.activeFile || ''

    // Local handlers for this pane
    const onActivate = (path: string) => {
      setActivePaneId(paneId) // focus pane
      setPanes(prev => {
        const p = prev[paneId]
        if (!p) return prev
        // if path is directory, just navigating? logic was:
        if (path && !path.startsWith('shell-') && !path.includes('.')) {
          // hacky detection for dir? no, tab activation is always file.
          // wait, FileExplorer calls setActiveFile for dirs too?
          // The original logic:
          /*
          if (isDir) { setActiveFile(p); return }
          */
          // For tab activation, it's always a "file" (maybe shell).
        }
        return { ...prev, [paneId]: { ...p, activeFile: path } }
      })

      // side effects (explorer dir sync)
      if (path && !path.startsWith('shell-') && path !== 'metadata') {
        const parts = path.split('/').filter(Boolean)
        parts.pop()
        const dir = parts.length ? `/${parts.join('/')}` : ''
        // if (dir !== explorerDir) setExplorerDir(dir) // optional sync
      }
      if (path !== 'metadata') setSelectedPath(path)
      setFocusRequest(Date.now())
    }

    const onClose = (path: string) => {
      // close tab logic
      const p = panes[paneId]
      if (!p) return

      // logic: if this is the last tab in the pane, AND we are not root, close the pane
      if (p.files.length === 1 && p.files[0] === path && paneId !== 'root') {
        closePane(paneId)
        return
      }

      setPanes(prev => {
        const p = prev[paneId]
        if (!p) return prev
        const nextFiles = p.files.filter(x => x !== path)
        // if closing active
        let nextActive = p.activeFile
        if (p.activeFile === path) {
          nextActive = nextFiles[0] || null
        }
        return { ...prev, [paneId]: { ...p, files: nextFiles, activeFile: nextActive } }
      })
    }

    // Titles / Types logic repeated for this pane
    const titles: Record<string, string> = {}
    for (const f of pFiles) {
      if (f.startsWith('shell-')) {
        const cwd = shellCwds[f] || ''
        const parts = (cwd || '/').split('/').filter(Boolean)
        let name = '/'
        if (parts.length) {
          const last = parts[parts.length - 1]
          if (last.includes('.') && parts.length > 1) {
            name = parts[parts.length - 2]
          } else {
            name = last
          }
        }
        titles[f] = name
      } else if (f === 'metadata') {
        titles[f] = t('file_details', 'File Details')
      } else {
        const baseName = f.split('/').pop() || f
        titles[f] = unsavedChanges[f] ? `*${baseName}` : baseName
      }
    }
    const types: Record<string, 'file' | 'dir' | 'shell'> = {}
    const fullPaths: Record<string, string> = {}
    for (const f of pFiles) {
      if (f.startsWith('shell-')) {
        types[f] = 'shell'
        fullPaths[f] = shellCwds[f] || '/'
      } else {
        types[f] = 'file'
        fullPaths[f] = f
      }
    }

    const isActivePane = paneId === activePaneId

    return (
      <div className="pane-content"
        style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
        onClick={() => { if (!isActivePane) setActivePaneId(paneId) }}
      >
        {/* Active Indicator Border */}
        {isActivePane && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent)', zIndex: 10 }} />}

        {pFiles.length > 0 ? (
          <>
            <div onContextMenu={(e) => {
              e.preventDefault()
              // Todo: Pane context menu (Split Right/Down)
            }}>
              <React.Suspense fallback={null}>
                <TabBarComponent
                  openFiles={pFiles}
                  active={pActive}
                  titles={{ ...titles, metadata: t('details', 'Details') }}
                  fullPaths={{ ...fullPaths, metadata: selectedPath || '' }}
                  types={types}
                  onRestoreEvicted={() => { }} // simplified
                  onActivate={onActivate}
                  onClose={onClose}
                  onCloseOthers={(p) => {
                    setPanes(prev => {
                      const st = prev[paneId]
                      if (!st) return prev
                      // Close all except p
                      const newFiles = st.files.filter(f => f === p)
                      // If p was not active, make it active (it's the only one left)
                      return { ...prev, [paneId]: { ...st, files: newFiles, activeFile: p } }
                    })
                  }}
                  onCloseLeft={(p) => {
                    setPanes(prev => {
                      const st = prev[paneId]
                      if (!st) return prev
                      const idx = st.files.indexOf(p)
                      if (idx <= 0) return prev // nothing to the left or p not found
                      const newFiles = st.files.slice(idx)
                      // Check if active file is still present
                      let newActive = st.activeFile
                      if (!newFiles.includes(newActive || '')) {
                        newActive = p
                      }
                      return { ...prev, [paneId]: { ...st, files: newFiles, activeFile: newActive } }
                    })
                  }}
                />
              </React.Suspense>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {pFiles.map(f => (
                <div key={f} style={{ display: f === pActive ? 'block' : 'none', height: '100%' }}>
                  {f.startsWith('shell-') ? (
                    <React.Suspense fallback={<div className="muted">{t('loading')}</div>}>
                      <TerminalTab key={f} shell={(settings && settings.defaultShell) || 'bash'} path={shellCwds[f] || ''} onExit={() => onClose(f)} />
                    </React.Suspense>
                  ) : f === 'trash' ? (
                    <TrashView />
                  ) : f === 'metadata' ? (
                    <FileDetailsView path={selectedPath} />
                  ) : f === 'binary' ? (
                    <React.Suspense fallback={<div className="muted">Loading…</div>}>
                      <BinaryView path={binaryPath || undefined} />
                    </React.Suspense>
                  ) : (
                    <Editor path={f} settings={settings || undefined} onSaved={() => { /* no-op */ }} reloadTrigger={reloadTriggers[f] || 0} onUnsavedChange={handleUnsavedChange} onMeta={(m: any) => {
                      if (m && m.path) setFileMetas(fm => ({ ...fm, [f]: m }))
                    }} />
                  )}
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
    <div className="app">
      <AppHeader
        logoVisible={logoVisible}
        setLogoVisible={setLogoVisible}

        isControlled={isControlled}
        theme={theme}
        onToggleTheme={() => {
          const next = theme === 'dark' ? 'light' : 'dark'
          setTheme(next)
          defaultStore.set('theme', next, strSerializer as any)
        }}

        onOpenTerminal={async () => {
          // determine cwd: prefer selectedPath; if none, fall back to active file's directory
          let cwd = selectedPath || ''
          try {
            if (cwd) {
              const st = await statPath(cwd)
              if (!st.isDir && st.absPath) {
                // if a file, use its directory
                const parts = st.absPath.split('/').filter(Boolean)
                parts.pop()
                cwd = parts.length ? `/${parts.join('/')}` : ''
              }
            } else if (activeFile && !activeFile.startsWith('shell-')) {
              try {
                const st2 = await statPath(activeFile)
                if (st2.isDir) {
                  cwd = st2.absPath || activeFile
                } else if (st2.absPath) {
                  const parts = st2.absPath.split('/').filter(Boolean)
                  parts.pop()
                  cwd = parts.length ? `/${parts.join('/')}` : ''
                }
              } catch (e) {
                // if stat fails, derive directory from activeFile string as a fallback
                const parts = activeFile.split('/').filter(Boolean)
                parts.pop()
                cwd = parts.length ? `/${parts.join('/')}` : ''
              }
            }
          } catch (e) {
            // ignore stat errors and fall back to selected/derived path
          }
          const shellName = `shell-${Date.now()}`
          // normalize: ensure stored cwd is a directory (if it looks like a file, use parent)
          let norm = cwd || ''
          if (norm && norm.split('/').pop()?.includes('.')) {
            const parts = norm.split('/').filter(Boolean)
            parts.pop()
            norm = parts.length ? `/${parts.join('/')}` : '/'
          }
          setShellCwds(s => ({ ...s, [shellName]: norm }))
          openFile(shellName)
        }}

        onOpenTrash={() => {
          if (!openFiles.includes('trash')) openFile('trash')
          setActiveFile('trash')
        }}
        onScreenshot={async () => {
          const root = document.querySelector('.app') as HTMLElement | null
          if (!root) return
          try {
            await captureElementToPng(root, 'mlcremote-screenshot.png')
          } catch (e) {
            console.error('Screenshot failed', e)
          }
        }}

        onSplitPane={splitPane}
        onCloseActivePane={() => closePane(activePaneId)}
        canCloseActivePane={layout.type !== 'leaf'}

        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        aboutOpen={aboutOpen}
        setAboutOpen={setAboutOpen}

        autoOpen={autoOpen}
        setAutoOpen={setAutoOpen}
        showHidden={showHidden}
        setShowHidden={setShowHidden}
        showLogs={showLogs}
        toggleLogs={setShowLogs}
        hideMemoryUsage={hideMemoryUsage}
        toggleHideMemoryUsage={toggleHideMemoryUsage}
        maxEditorSize={maxEditorSize}
        updateMaxEditorSize={updateMaxEditorSize}
        i18n={i18n}
      />
      <div className="app-body" style={{ alignItems: 'stretch' }}>
        <aside className="sidebar" style={{ width: sidebarWidth }}>
          <FileExplorer showHidden={showHidden} autoOpen={autoOpen} onToggleHidden={(v) => setShowHidden(v)} selectedPath={selectedPath} activeDir={explorerDir} onDirChange={handleExplorerDirChange} focusRequest={focusRequest} reloadSignal={reloadSignal} onSelect={(p, isDir) => {
            setSelectedPath(p)
            if (isDir) {
              // Auto-open metadata view for directories
              openFile('metadata')
              return
            }
            // file: open editor tab (respect autoOpen)
            // file: decide if it should open as a shared binary view or normal editor
            (async () => {
              try {
                const st = await statPath(p)
                const h = getHandler({ path: p, meta: st })

                // If it's the Binary or Unsupported handler, open the shared binary tab
                if (h.name === 'Binary' || h.name === 'Unsupported') {
                  if (!openFiles.includes('binary')) openFile('binary')
                  setBinaryPath(p)
                  setActiveFile('binary')
                  return
                }
              } catch (e: any) {
                // if stat fails, do not attempt to open the file (it might be a broken link)
                setMessageBox({ title: 'Broken Link', message: `Cannot open file: ${e.message || 'stat failed'}` })
                return
              }
              // otherwise open as normal file tab
              if (autoOpen) {
                openFile(p)
              } else {
                if (openFiles.includes(p)) setActiveFile(p)
              }
            })()
            // check health status since backend interaction succeeded
            checkHealthStatus()
          }} onView={(p) => {
            // if the file is already open, activate it; otherwise open it as a new persistent tab
            if (openFiles.includes(p)) {
              setActiveFile(p)
            } else {
              openFile(p)
            }
            if (p !== 'metadata') setSelectedPath(p)
            // check health status since backend interaction succeeded
            checkHealthStatus()
          }} onBackendActive={checkHealthStatus} onChangeRoot={async () => {
            // Prompt-only flow: we cannot browse remote server; ask for a path and validate it via the server
            if (!canChangeRoot) {
              // eslint-disable-next-line no-alert
              alert('Changing root is not permitted by the server settings')
              return
            }
            // eslint-disable-next-line no-alert
            const p = window.prompt('Enter the server directory path to use as new root (e.g. /home/user/project):', selectedPath || '/')
            if (!p) return
            const chosen = p.trim()
            try {
              const st = await statPath(chosen)
              if (!st.isDir) {
                // eslint-disable-next-line no-alert
                alert('Selected path is not a directory')
                return
              }
              // set as selected path and persist
              setSelectedPath(chosen)
              try { defaultStore.set('lastRoot', chosen, strSerializer) } catch { }
              // trigger a reload of explorer by forcing a small setting write (FileExplorer will re-read)
              try { const cur = defaultStore.getOrDefault('showHidden', boolSerializer, false); defaultStore.set('showHidden', cur, boolSerializer) } catch { }
            } catch (e: any) {
              // eslint-disable-next-line no-alert
              alert('Cannot access selected path: ' + (e?.message || e))
            }
          }} />
        </aside>
        <div className="resizer" onMouseDown={(e) => {
          const startX = e.clientX
          const startW = sidebarWidth
          function onMove(ev: MouseEvent) {
            const dx = ev.clientX - startX
            setSidebarWidth(Math.max(160, Math.min(800, startW + dx)))
          }
          function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}>
          <div className="bar" />
        </div>
        <main className="main">
          <div className="main-content">
            {/* Unified authentication chooser/modal */}
            {/* Authentication Overlay */}
            <AuthOverlay />
            {/* New Generic MessageBox */}
            {messageBox && (
              <MessageBox title={messageBox.title} message={messageBox.message} onClose={() => setMessageBox(null)} />
            )}

            {/* Recursive Layout Renderer */}
            {renderLayout(layout)}

          </div>
        </main>
      </div>
      <StatusBar health={health} isOnline={isOnline} hideMemoryUsage={hideMemoryUsage} lastHealthAt={lastHealthAt} />
      <LogOverlay visible={showLogs} onClose={() => setShowLogs(false)} />

      {/* Server time and timezone are shown inside the main About popup now. */}

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
