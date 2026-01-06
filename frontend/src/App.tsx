import React from 'react'
import type { Health } from './api'
import { statPath, saveSettings, getSettings } from './api'
import { useAuth } from './context/AuthContext'
import FileExplorer from './components/FileExplorer'
import SettingsPopup from './components/SettingsPopup'
import { useTranslation } from 'react-i18next'
import { Icon } from './generated/icons'
import { getIconForShell, getIconForDir, getIcon } from './generated/icon-helpers'
import TrashView from './components/TrashView'
import Editor from './components/Editor'
import BinaryView from './components/BinaryView'
const TerminalTab = React.lazy(() => import('./components/TerminalTab'))
// const TabBarComponent = React.lazy(() => import('./components/TabBar'))

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
  const { t, i18n } = useTranslation()

  const {
    health, isOnline, lastHealthAt, refreshHealth,
    login, setToken, logout,
    showLogin, setShowLogin,
    showTokenInput, setShowTokenInput,
    showAuthChooser, setShowAuthChooser
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
  const [logoVisible, setLogoVisible] = React.useState<boolean>(true)

  // -- Layout State --
  // We initialize with one root pane
  const [panes, setPanes] = React.useState<Record<PaneId, PaneState>>({
    'root': { id: 'root', files: [], activeFile: null }
  })
  const [layout, setLayout] = React.useState<LayoutNode>({ type: 'leaf', paneId: 'root' })
  const [activePaneId, setActivePaneId] = React.useState<PaneId>('root')

  // Helpers to get current active file/files for legacy compatibility
  const openFiles = panes[activePaneId]?.files || []
  const activeFile = panes[activePaneId]?.activeFile || ''

  // Derived setters for legacy compatibility (careful with these!)
  // We'll need to update usage sites to use specific pane logic. element
  const setOpenFiles = (fn: (files: string[]) => string[]) => {
    setPanes(prev => {
      const p = prev[activePaneId]
      if (!p) return prev
      const newFiles = fn(p.files)
      return { ...prev, [activePaneId]: { ...p, files: newFiles } }
    })
  }
  const setActiveFile = (file: string) => {
    setPanes(prev => {
      const p = prev[activePaneId]
      if (!p) return prev
      return { ...prev, [activePaneId]: { ...p, activeFile: file } }
    })
  }

  const [evictedTabs, setEvictedTabs] = React.useState<string[]>([])
  const [binaryPath, setBinaryPath] = React.useState<string | null>(null)
  const [autoOpen, setAutoOpenState] = React.useState<boolean>(true)
  const setAutoOpen = (v: boolean) => { setAutoOpenState(v); saveSettings({ autoOpen: v }).catch(console.error) }
  const maxTabs = 8
  // openFile ensures we don't exceed maxTabs by closing the oldest when necessary
  /**
   * Open a path in a persistent tab. If the maximum number of tabs is
   * exceeded the oldest tab is closed (simple LRU-like eviction).
   */
  function openFile(path: string) {
    setOpenFiles(of => {
      if (of.includes(path)) return of
      const next = [...of, path]
      if (next.length <= maxTabs) return next
      // close the oldest opened (first) tab and record it in evictedTabs
      const evicted = next[0]
      try {
        setEvictedTabs(prev => {
          if (prev.includes(evicted)) return prev
          return [...prev, evicted]
        })
      } catch (_) { }
      return next.slice(1)
    })
    setActiveFile(path)
    // fetch and cache metadata for this file (size, modTime, mime)
    statPath(path).then(m => {
      setFileMetas(fm => ({ ...fm, [path]: m }))
    }).catch(() => {
      // ignore stat errors
    })
  }
  const [shellCwds, setShellCwds] = React.useState<Record<string, string>>({})
  const [showHidden, setShowHiddenState] = React.useState<boolean>(false)
  const setShowHidden = (v: boolean) => { setShowHiddenState(v); saveSettings({ showHidden: v }).catch(console.error) }
  const [canChangeRoot, setCanChangeRoot] = React.useState<boolean>(false)
  const [showLogs, setShowLogs] = React.useState<boolean>(false)
  const [aboutOpen, setAboutOpen] = React.useState<boolean>(false)
  const [settingsOpen, setSettingsOpen] = React.useState<boolean>(false)
  const [hideMemoryUsage, setHideMemoryUsage] = React.useState<boolean>(false)
  const [serverInfoOpen, setServerInfoOpen] = React.useState<boolean>(false)
  const [settings, setSettings] = React.useState<{ allowDelete: boolean; defaultShell: string } | null>(null)
  const [sidebarWidth, setSidebarWidth] = React.useState<number>(300)
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark')
  const [maxEditorSize, setMaxEditorSize] = React.useState<number>(0) // 0 means not yet loaded or default
  const [now, setNow] = React.useState<Date>(new Date())
  const [messageBox, setMessageBox] = React.useState<{ title: string; message: string } | null>(null)

  // Cleaned up auth state and effects (moved to AuthContext)

  const [reloadTriggers, setReloadTriggers] = React.useState<Record<string, number>>({})
  const [unsavedChanges, setUnsavedChanges] = React.useState<Record<string, boolean>>({})
  const [fileMetas, setFileMetas] = React.useState<Record<string, any>>({})

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

  // fetch runtime settings once on mount
  // fetch runtime settings once on mount and apply user prefs
  React.useEffect(() => {
    getSettings()
      .then(s => {
        setSettings({ allowDelete: s.allowDelete, defaultShell: s.defaultShell })
        if (typeof s.allowDelete !== 'undefined') setCanChangeRoot(!!s.allowDelete) // Using allowDelete/ChangeRoot logic overlap? Actually allowChangeRoot was returned before.
        // Apply user prefs
        if (s.theme) setTheme(s.theme as any)
        if (typeof s.autoOpen !== 'undefined') setAutoOpenState(s.autoOpen)
        if (typeof s.showHidden !== 'undefined') setShowHiddenState(s.showHidden)
        if (typeof s.showLogs !== 'undefined') setShowLogs(s.showLogs)
        if (typeof s.hideMemoryUsage !== 'undefined') setHideMemoryUsage(s.hideMemoryUsage)
        if (s.maxEditorSize) {
          setMaxEditorSize(s.maxEditorSize)
          localStorage.setItem('mlc_max_editor_size', s.maxEditorSize.toString())
        }

        // Language Sync Logic: Desktop Launcher (URL param) overrides Server Settings
        const params = new URLSearchParams(window.location.search)
        const urlLang = params.get('lng') || params.get('lang')

        if (urlLang && urlLang !== s.language) {
          console.log(`[i18n] Syncing language from Desktop (${urlLang}) -> Server`)
          // Update server settings and apply
          saveSettings({ language: urlLang }).catch(console.error)
          if (i18n.language !== urlLang) i18n.changeLanguage(urlLang)
        } else if (s.language && i18n.language !== s.language) {
          // Fallback to server setting
          i18n.changeLanguage(s.language)
        }
      })
      .catch(() => setSettings({ allowDelete: false, defaultShell: 'bash' }))

    // Restore state if profileId is present
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('profileId')
    if (pid) {
      console.log("Restoring state for profile:", pid)
      try {
        const saved = localStorage.getItem(`workspace_state_${pid}`)
        if (saved) {
          const state = JSON.parse(saved)
          if (state.panes) setPanes(state.panes)
          if (state.layout) setLayout(state.layout)
          if (state.activePaneId) setActivePaneId(state.activePaneId)
        }
      } catch (e) {
        console.error("Failed to restore workspace state", e)
      }
    }
  }, [])

  // Persist state when it changes
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('profileId')
    if (pid) {
      const state = { panes, layout, activePaneId }
      localStorage.setItem(`workspace_state_${pid}`, JSON.stringify(state))
    }
  }, [panes, layout, activePaneId])

  // apply theme whenever it changes
  React.useEffect(() => {
    if (theme === 'light') document.documentElement.classList.add('theme-light')
    else document.documentElement.classList.remove('theme-light')
  }, [theme])

  // listen for online/offline events
  // Effects removed as they are now handled in AuthContext

  // -- Layout Helpers --

  const splitPane = (direction: 'horizontal' | 'vertical') => {
    const newPaneId = `pane-${Date.now()}`
    const currentP = panes[activePaneId]
    const currentFile = currentP?.activeFile

    setPanes(prev => ({
      ...prev,
      [newPaneId]: {
        id: newPaneId,
        files: currentFile ? [currentFile] : [],
        activeFile: currentFile || null
      }
    }))

    setLayout(prev => {
      const replace = (node: LayoutNode): LayoutNode => {
        if (node.type === 'leaf') {
          if (node.paneId === activePaneId) {
            return {
              type: 'branch',
              direction,
              size: 50,
              children: [
                node,
                { type: 'leaf', paneId: newPaneId }
              ]
            }
          }
          return node
        }
        return { ...node, children: [replace(node.children[0]), replace(node.children[1])] } as LayoutNode
      }
      return replace(prev)
    })
    setActivePaneId(newPaneId)
  }

  const closePane = (id: PaneId) => {
    // Find parent branch and replace with sibling
    // If root, do nothing (or clear files?)
    if (id === 'root' && layout.type === 'leaf') return // cannot close single root

    setLayout(prev => {
      const prune = (node: LayoutNode): LayoutNode | null => {
        if (node.type === 'leaf') {
          return node.paneId === id ? null : node
        }
        const c0 = prune(node.children[0])
        const c1 = prune(node.children[1])
        if (!c0 && !c1) return null // should not happen
        if (!c0) return c1 // promote sibling
        if (!c1) return c0 // promote sibling
        return { ...node, children: [c0, c1] } as LayoutNode
      }
      const res = prune(prev)
      return res || { type: 'leaf', paneId: 'root' } // fallback
    })

    setPanes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    // If we closed the active pane, reset activePaneId?
    // We need to calculate the new active pane. 
    // Simplified: set to 'root' or whatever fallback.
    if (activePaneId === id) setActivePaneId('root') // simplistic
  }

  const handleLayoutResize = (node: LayoutNode, newSize: number) => {
    setLayout(prev => {
      const update = (n: LayoutNode): LayoutNode => {
        if (n === node) return { ...n, size: newSize } as any
        if (n.type === 'branch') {
          return { ...n, children: [update(n.children[0]), update(n.children[1])] } as any
        }
        return n
      }
      return update(prev)
    })
  }

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
      if (path && !path.startsWith('shell-')) {
        const parts = path.split('/').filter(Boolean)
        parts.pop()
        const dir = parts.length ? `/${parts.join('/')}` : ''
        // if (dir !== explorerDir) setExplorerDir(dir) // optional sync
      }
      setSelectedPath(path)
      setFocusRequest(Date.now())
    }

    const onClose = (path: string) => {
      // close tab logic
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
                  titles={titles}
                  fullPaths={fullPaths}
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

  return (
    <div className="app">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="MLCRemote logo" style={{ height: 28, display: 'block' }} onLoad={() => setLogoVisible(true)} onError={() => setLogoVisible(false)} />
          {!logoVisible && <h1 style={{ margin: 0 }}>MLCRemote</h1>}
        </div>
        <div className="status">
          {/* Status indicators moved to StatusBar */}

          {/* cwd display removed (visible in Files sidebar) */}
          <button className="link icon-btn" onClick={async () => {
            // determine cwd: prefer selectedPath; if none, fall back to active file's directory
            let cwd = selectedPath || ''
            try {
              if (cwd) {
                const st = await statPath(cwd)
                if (!st.isDir && st.path) {
                  // if a file, use its directory
                  const parts = st.path.split('/').filter(Boolean)
                  parts.pop()
                  cwd = parts.length ? `/${parts.join('/')}` : ''
                }
              } else if (activeFile && !activeFile.startsWith('shell-')) {
                try {
                  const st2 = await statPath(activeFile)
                  if (st2.isDir) {
                    cwd = st2.path || activeFile
                  } else if (st2.path) {
                    const parts = st2.path.split('/').filter(Boolean)
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
          }} title={t('terminal')} aria-label={t('terminal')}><Icon name={getIcon('terminal')} title={t('terminal')} size={16} /></button>

          {/* Settings moved to popup (icon at the right). */}
          <button className="link icon-btn" aria-label="Toggle theme" onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            setTheme(next)
            defaultStore.set('theme', next, strSerializer as any)
            if (next === 'light') document.documentElement.classList.add('theme-light')
            else document.documentElement.classList.remove('theme-light')
          }}>
            {theme === 'dark' ? <Icon name={getIcon('moon')} title={t('theme')} size={16} /> : <Icon name={getIcon('sun')} title={t('theme')} size={16} />}
          </button>
          {/* Logs toggle moved into settings popup */}
          <button className="link icon-btn" title={t('about')} aria-label={t('about')} onClick={() => setAboutOpen(true)}><Icon name={getIcon('info')} title={t('about')} size={16} /></button>
          <button className="link icon-btn" title="Screenshot" aria-label="Screenshot" onClick={async () => {
            const root = document.querySelector('.app') as HTMLElement | null
            if (!root) return
            try {
              await captureElementToPng(root, 'mlcremote-screenshot.png')
            } catch (e) {
              console.error('Screenshot failed', e)
            }
          }}><Icon name={getIcon('screenshot')} title="Screenshot" size={16} /></button>
          <button className="link icon-btn" title="Trash" aria-label="Trash" onClick={() => {
            // open a single trash tab
            if (!openFiles.includes('trash')) {
              openFile('trash')
            }
            setActiveFile('trash')
          }}><Icon name="icon-trash" title="Trash" size={16} /></button>


          <button className="link icon-btn" title="Split Right" aria-label="Split Right" onClick={() => splitPane('vertical')}>
            {/* Split Horizontal Icon (Vertical Split) */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
              <path fillRule="evenodd" d="M14 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1zM2 2a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H2z" clipRule="evenodd" />
              <path d="M8 4v8H7V4h1z" />
            </svg>
          </button>
          <button className="link icon-btn" title="Split Down" aria-label="Split Down" onClick={() => splitPane('horizontal')}>
            {/* Split Vertical Icon (Horizontal Split) */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
              <path fillRule="evenodd" d="M14 3H2a1 1 0 00-1 1v8a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1zM2 2a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H2z" clipRule="evenodd" />
              <path d="M2 8h12v1H2V8z" />
            </svg>
          </button>

          {layout.type !== 'leaf' && (
            <button className="link icon-btn" title="Close Active Pane" aria-label="Close Active Pane" onClick={() => closePane(activePaneId)} style={{ marginLeft: 4 }}>
              <Icon name={getIcon('close')} size={16} />
            </button>
          )}
          <button className="link icon-btn" aria-label={t('settings')} title={t('settings')} onClick={() => setSettingsOpen(s => !s)}><Icon name={getIcon('settings')} title={t('settings')} size={16} /></button>
        </div>
        {settingsOpen && (
          <SettingsPopup
            autoOpen={autoOpen}
            showHidden={showHidden}
            onToggleAutoOpen={(v) => setAutoOpen(v)}
            onToggleShowHidden={(v) => setShowHidden(v)}
            showLogs={showLogs}
            onToggleLogs={(v) => { setShowLogs(v); saveSettings({ showLogs: v }).catch(console.error) }}
            hideMemoryUsage={hideMemoryUsage}
            onToggleHideMemoryUsage={(v) => { setHideMemoryUsage(v); saveSettings({ hideMemoryUsage: v }).catch(console.error) }}
            onClose={() => setSettingsOpen(false)}
            onLanguageChange={(l) => {
              if (l !== i18n.language) {
                i18n.changeLanguage(l)
                saveSettings({ language: l }).catch(console.error)
              }
            }}
            maxEditorSize={maxEditorSize}
            onMaxFileSizeChange={(sz) => {
              setMaxEditorSize(sz)
              saveSettings({ maxEditorSize: sz }).catch(console.error)
            }}
          />
        )}
      </header>
      <div className="app-body" style={{ alignItems: 'stretch' }}>
        <aside className="sidebar" style={{ width: sidebarWidth }}>
          <FileExplorer showHidden={showHidden} autoOpen={autoOpen} onToggleHidden={(v) => setShowHidden(v)} selectedPath={selectedPath} activeDir={explorerDir} onDirChange={handleExplorerDirChange} focusRequest={focusRequest} reloadSignal={reloadSignal} onSelect={(p, isDir) => {
            setSelectedPath(p)
            if (isDir) {
              // do not open a persistent tab for directories; just navigate
              setActiveFile(p)
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
                setActiveFile(p)
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
            setSelectedPath(p)
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
            {showAuthChooser && (
              <div className="login-overlay">
                <div className="login-box">
                  <h3>Not Authenticated</h3>
                  <p>You need to sign in or provide an access key to continue.</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn" onClick={() => { setShowAuthChooser(false); setShowLogin(true) }}>{t('open')} (password)</button>
                    <button className="btn" onClick={() => { setShowAuthChooser(false); setShowTokenInput(true) }}>I have an access key</button>
                  </div>
                </div>
              </div>
            )}

            {/* Password input modal (shown when user chooses to sign in) */}
            {showLogin && (
              <div className="login-overlay">
                <div className="login-box">
                  <h3>Sign in</h3>
                  <p>Please enter the server password to obtain an access token.</p>
                  <input id="mlc-login-pwd" type="password" placeholder="Password" />
                  <div style={{ marginTop: 8 }}>
                    <button className="btn" onClick={async () => {
                      const el = document.getElementById('mlc-login-pwd') as HTMLInputElement | null
                      if (!el) return
                      try {
                        await login(el.value)
                      } catch (e: any) {
                        alert('Login failed: ' + (e?.message || e))
                      }
                    }}>{t('open')}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Token input modal (shown when user chooses to provide an access key) */}
            {showTokenInput && (
              <div className="login-overlay">
                <div className="login-box">
                  <h3>Enter Access Token</h3>
                  <p>The server requires an access token. Paste it here to continue.</p>
                  <input id="mlc-token-input" type="text" placeholder="token" />
                  <div style={{ marginTop: 8 }}>
                    <button className="btn" onClick={async () => {
                      const el = document.getElementById('mlc-token-input') as HTMLInputElement | null
                      if (!el) return
                      try {
                        setToken(el.value.trim())
                      } catch (e: any) {
                        alert('Failed to store token: ' + (e?.message || e))
                      }
                    }}>Use token</button>
                  </div>
                </div>
              </div>
            )}
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
        <div className="about-backdrop" onClick={() => setAboutOpen(false)}>
          <div className="about-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>MLCRemote</h3>
              <button aria-label={t('close')} title={t('close')} onClick={() => setAboutOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Icon name="icon-close" size={16} /></button>
            </div>
            <div style={{ marginBottom: 8 }}>Copyright © {new Date().getFullYear()} Michael Lechner</div>
            <div style={{ marginBottom: 8 }}>Version: {health ? `${health.status}@${health.version}` : 'unknown'}</div>
            {health && (
              <div style={{ maxHeight: '40vh', overflow: 'auto', background: '#0b0b0b', color: 'white', padding: 12, borderRadius: 6 }}>
                <div><strong>Host:</strong> {health.host}</div>
                <div><strong>PID:</strong> {health.pid}</div>
                <div><strong>Version:</strong> {health.version}</div>
                <div><strong>App Memory:</strong> {formatBytes(health.go_alloc_bytes)} (alloc) / {formatBytes(health.go_sys_bytes)} (sys)</div>
                <div><strong>System Memory:</strong> {formatBytes((health.sys_mem_total_bytes || 0) - (health.sys_mem_free_bytes || 0))} / {formatBytes(health.sys_mem_total_bytes || 0)} used</div>
                <div><strong>CPU:</strong> {Math.round((health.cpu_percent || 0) * 10) / 10}%</div>
                <div style={{ marginTop: 8 }}><strong>Server time:</strong> {health.server_time}</div>
                <div style={{ marginTop: 4 }}><strong>Timezone:</strong> {health.timezone}</div>
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Last refresh: {lastHealthAt ? new Date(lastHealthAt).toLocaleString() : 'n/a'}</div>
              </div>
            )}
            {/* Close button moved to top-right X for consistency with Settings popup */}
          </div>
        </div>
      )}
    </div>
  )
}
