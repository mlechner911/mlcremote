import React from 'react'
import type { Health } from './api'
import { getHealth, statPath, login, captureTokenFromURL, authCheck } from './api'
import FileExplorer from './components/FileExplorer'
import SettingsPopup from './components/SettingsPopup'
import { Icon } from './generated/icons'
import { getIconForShell, getIconForDir, getIcon } from './generated/icon-helpers'
import TrashView from './components/TrashView'
import Editor from './components/Editor'
const TerminalTab = React.lazy(() => import('./components/TerminalTab'))
// const TabBarComponent = React.lazy(() => import('./components/TabBar'))

import  TabBarComponent   from './components/TabBar'
import LogOverlay from './components/LogOverlay'
import { formatBytes } from './bytes'
import { captureElementToPng } from './utils/capture'
import { defaultStore, boolSerializer, strSerializer } from './utils/storage'

/**
 * Top-level application component. Manages UI state for the file explorer,
 * editor tabs, terminal tabs and global settings such as theme and sidebar
 * width. Heavy-lifted responsibilities are split into child components.
 */
export default function App() {

  const [health, setHealth] = React.useState<null | Health>(null)
  const [lastHealthAt, setLastHealthAt] = React.useState<number | null>(null)
  const [selectedPath, setSelectedPath] = React.useState<string>('')
  const [explorerDir, setExplorerDir] = React.useState<string>('')
  const handleExplorerDirChange = React.useCallback((d: string) => setExplorerDir(d), [])
  const [focusRequest, setFocusRequest] = React.useState<number>(0)
  const [logoVisible, setLogoVisible] = React.useState<boolean>(true)
  const [openFiles, setOpenFiles] = React.useState<string[]>([])
  const [evictedTabs, setEvictedTabs] = React.useState<string[]>([])
  const [activeFile, setActiveFile] = React.useState<string>('')
  const [autoOpen, setAutoOpenState] = React.useState<boolean>(() => defaultStore.getOrDefault<boolean>('autoOpen', boolSerializer, true))
  const setAutoOpen = (v: boolean) => { setAutoOpenState(v); defaultStore.set('autoOpen', v, boolSerializer) }
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
      try { setEvictedTabs(prev => {
        if (prev.includes(evicted)) return prev
        return [...prev, evicted]
      }) } catch (_) {}
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
  const [shellCwds, setShellCwds] = React.useState<Record<string,string>>({})
  const [showHidden, setShowHiddenState] = React.useState<boolean>(() => defaultStore.getOrDefault<boolean>('showHidden', boolSerializer, false))
  const setShowHidden = (v: boolean) => { setShowHiddenState(v); defaultStore.set('showHidden', v, boolSerializer) }
  const [canChangeRoot, setCanChangeRoot] = React.useState<boolean>(false)
  const [showLogs, setShowLogs] = React.useState<boolean>(() => defaultStore.getOrDefault<boolean>('showLogs', boolSerializer, false))
  const [aboutOpen, setAboutOpen] = React.useState<boolean>(false)
  const [settingsOpen, setSettingsOpen] = React.useState<boolean>(false)
  const [hideServerName, setHideServerName] = React.useState<boolean>(() => defaultStore.getOrDefault<boolean>('hideServerName', boolSerializer, false))
  const [hideMemoryUsage, setHideMemoryUsage] = React.useState<boolean>(() => defaultStore.getOrDefault<boolean>('hideMemoryUsage', boolSerializer, false))
  const [serverInfoOpen, setServerInfoOpen] = React.useState<boolean>(false)
  const [settings, setSettings] = React.useState<{ allowDelete: boolean; defaultShell: string } | null>(null)
  const [sidebarWidth, setSidebarWidth] = React.useState<number>(300)
  const [theme, setTheme] = React.useState<'dark'|'light'>(() => defaultStore.getOrDefault<'dark'|'light'>('theme', strSerializer as any, 'dark'))
  const [now, setNow] = React.useState<Date>(new Date())
  const [isOnline, setIsOnline] = React.useState<boolean>(navigator.onLine)
  const [reloadTriggers, setReloadTriggers] = React.useState<Record<string, number>>({})
  const [reloadSignal, setReloadSignal] = React.useState<number>(() => {
    try { return captureTokenFromURL() ? Date.now() : 0 } catch { return 0 }
  })
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

  // function to check health and update status immediately
  const checkHealthStatus = React.useCallback(async () => {
    if (!isOnline) return
    try {
      const h = await getHealth()
      setHealth(h)
      setLastHealthAt(Date.now())
    } catch {
      setHealth(null)
    }
  }, [isOnline])

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // health polling (mount-only)
  React.useEffect(() => {
    let mounted = true
    async function fetchHealth() {
      if (!isOnline) return
      try {
        const h = await getHealth()
        if (!mounted) return
        setHealth(h)
        setLastHealthAt(Date.now())
        // verify token validity
        const ok = await authCheck()
        if (!ok) {
          // clear token and prompt for auth based on health
          localStorage.removeItem('mlcremote_token')
          if (h.password_auth) setShowLogin(true)
          else if (h.auth_required) setShowTokenPrompt(true)
        }
      } catch {
        if (!mounted) return
        setHealth(null)
      }
    }
    fetchHealth()
    const id = setInterval(fetchHealth, 60 * 1000)
    return () => { mounted = false; clearInterval(id) }
  }, [isOnline])

  // legacy per-flow login flag (kept for the actual input flows)
  const [showLogin, setShowLogin] = React.useState(false)
  const [showLoginInput, setShowLoginInput] = React.useState(false)

  // Unified 'Not Authenticated' chooser. When server requires auth and
  // we have no token this chooser gives the user the option to login
  // with a password or to provide an access key.
  const [showAuthChooser, setShowAuthChooser] = React.useState(false)
  React.useEffect(() => {
    if (!health) { setShowAuthChooser(false); return }
    const needsPassword = !!health.password_auth
    const needsTokenOnly = !!health.auth_required && !health.password_auth
    const token = localStorage.getItem('mlcremote_token')
    if ((needsPassword || needsTokenOnly) && !token) setShowAuthChooser(true)
    else setShowAuthChooser(false)
  }, [health])

  // global handler: when authedFetch observes a 401 it dispatches
  // `mlcremote:auth-failed`. Show unified chooser so user can pick the method.
  React.useEffect(() => {
    const h = (_ev: Event) => setShowAuthChooser(true)
    window.addEventListener('mlcremote:auth-failed', h as EventListener)
    return () => window.removeEventListener('mlcremote:auth-failed', h as EventListener)
  }, [])

  // If a token was provided and we triggered a reloadSignal, hide auth prompts
  React.useEffect(() => {
    try {
      const t = localStorage.getItem('mlcremote_token')
      if (t) {
        setShowAuthChooser(false)
        setShowLoginInput(false)
        setShowTokenPrompt(false)
      }
    } catch (_) {}
  }, [reloadSignal])

  // token prompt for cases where server requires supplying a token directly
  const [showTokenPrompt, setShowTokenPrompt] = React.useState(false)
  React.useEffect(() => {
    if (!health) return
    // when auth_required is true and password login isn't enabled, ask user for token
    const needsToken = !!health.auth_required && !health.password_auth
    const token = localStorage.getItem('mlcremote_token')
    if (needsToken && !token) setShowTokenPrompt(true)
    else setShowTokenPrompt(false)
  }, [health])

  // fetch runtime settings once on mount
  React.useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(j => {
        setSettings(j)
        if (j && typeof j.allowChangeRoot !== 'undefined') setCanChangeRoot(!!j.allowChangeRoot)
      })
      .catch(() => setSettings({ allowDelete: false, defaultShell: 'bash' }))
    // load persisted prefs handled by LocalStore initializers
  }, [])

  // apply theme whenever it changes
  React.useEffect(() => {
    if (theme === 'light') document.documentElement.classList.add('theme-light')
    else document.documentElement.classList.remove('theme-light')
  }, [theme])

  // listen for online/offline events
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // immediately fetch health when coming online
      getHealth().then(async h => {
        setHealth(h)
        setLastHealthAt(Date.now())
        const ok = await authCheck()
        if (!ok) {
          localStorage.removeItem('mlcremote_token')
          if (h.password_auth) setShowLogin(true)
          else if (h.auth_required) setShowTokenPrompt(true)
        }
      }).catch(() => {
        setHealth(null)
      })
    }
    const handleOffline = () => {
      setIsOnline(false)
      setHealth(null)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="MLCRemote logo" style={{ height: 28, display: 'block' }} onLoad={() => setLogoVisible(true)} onError={() => setLogoVisible(false)} />
          {!logoVisible && <h1 style={{ margin: 0 }}>MLCRemote</h1>}
        </div>
        <div className="status">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 6, background: health && health.host ? '#10b981' : (isOnline ? '#f59e0b' : '#ef4444'), display: 'inline-block' }} />
            { !isOnline && (<span className={(health ? 'badge badge-ok' : (isOnline ? 'badge badge-error' : 'badge badge-error'))}>
              {isOnline ? '' /*'online'*/ : 'offline'}
                        </span>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {!hideServerName && (
                <button className="link icon-btn" style={{ marginLeft: 8, fontSize: 12, padding: 0 }} onClick={() => setAboutOpen(true)}>{health && health.host ? health.host : (isOnline ? 'connecting...' : 'browser offline')}</button>
              )}
              {health && health.server_time && (
                null
              )}
            </div>
          </span>
          {/* memory gauge */}
          {!hideMemoryUsage && health && health.sys_mem_total_bytes ? (
            (() => {
              const total = health.sys_mem_total_bytes || 1
              const free = health.sys_mem_free_bytes || 0
              const used = total - free
              const pct = Math.round((used / total) * 100)
              return (
                <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 120, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? '#e11d48' : '#10b981', borderRadius: 6, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }} />
                  </div>
                  <div className="muted" style={{ fontSize: 12 }} title={`Memory usage: ${formatBytes(used)} / ${formatBytes(total)} (${pct}%)`}>{pct}%</div>
                </div>
              )
            })()
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="muted" style={{ fontSize: 12 }}>{new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' }).format(now)}</div>
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
            }} title="Open shell" aria-label="Open shell"><Icon name={getIcon('terminal')} title="Open shell" size={16} /></button>
          </div>
          {/* Settings moved to popup (icon at the right). */}
          <button className="link icon-btn" aria-label="Toggle theme" onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            setTheme(next)
            defaultStore.set('theme', next, strSerializer as any)
            if (next === 'light') document.documentElement.classList.add('theme-light')
            else document.documentElement.classList.remove('theme-light')
          }}>
            {theme === 'dark' ? <Icon name={getIcon('moon')} title="Dark theme" size={16} /> : <Icon name={getIcon('sun')} title="Light theme" size={16} />}
          </button>
          {/* Logs toggle moved into settings popup */}
            <button className="link icon-btn" title="About" aria-label="About" onClick={() => setAboutOpen(true)}><Icon name={getIcon('info')} title="About" size={16} /></button>
            <button className="link icon-btn " title="Screenshot" aria-label="Screenshot" onClick={async () => {
              const root = document.querySelector('.app') as HTMLElement | null
              if (!root) return
              try {
                await captureElementToPng(root, 'mlcremote-screenshot.png')
              } catch (e) {
                console.error('Screenshot failed', e)
              }
            }}><Icon name={getIcon('screenshot')} title="Screenshot" size={16} /></button>
            <button className="link icon-btn" aria-label="Open settings" title="Settings" onClick={() => setSettingsOpen(s => !s)}><Icon name={getIcon('settings')} title="Settings" size={16} /></button>
            <button className="link icon-btn" title="Trash" aria-label="Trash" onClick={() => {
              // open a single trash tab
              if (!openFiles.includes('trash')) {
                openFile('trash')
              }
              setActiveFile('trash')
            }}><Icon name="icon-trash" title="Trash" size={16} /></button>
        </div>
          {settingsOpen && (
            <SettingsPopup
              autoOpen={autoOpen}
              showHidden={showHidden}
              onToggleAutoOpen={(v) => setAutoOpen(v)}
              onToggleShowHidden={(v) => setShowHidden(v)}
              showLogs={showLogs}
              onToggleLogs={(v) => { setShowLogs(v); defaultStore.set('showLogs', v, boolSerializer) }}
              hideServerName={hideServerName}
              onToggleHideServerName={(v) => { setHideServerName(v); defaultStore.set('hideServerName', v, boolSerializer) }}
              hideMemoryUsage={hideMemoryUsage}
              onToggleHideMemoryUsage={(v) => { setHideMemoryUsage(v); defaultStore.set('hideMemoryUsage', v, boolSerializer) }}
              onClose={() => setSettingsOpen(false)}
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
            if (autoOpen) {
              openFile(p)
            } else {
              // autoOpen disabled: selecting will mark but not open a persistent tab
              setActiveFile(p)
            }
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
              try { defaultStore.set('lastRoot', chosen, strSerializer) } catch {}
              // trigger a reload of explorer by forcing a small setting write (FileExplorer will re-read)
              try { const cur = defaultStore.getOrDefault('showHidden', boolSerializer, false); defaultStore.set('showHidden', cur, boolSerializer) } catch {}
            } catch (e:any) {
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
                  <button className="btn" onClick={() => { setShowAuthChooser(false); setShowLoginInput(true) }}>Sign in (password)</button>
                  <button className="btn" onClick={() => { setShowAuthChooser(false); setShowTokenPrompt(true) }}>I have an access key</button>
                </div>
              </div>
            </div>
          )}

          {/* Password input modal (shown when user chooses to sign in) */}
          {showLoginInput && (
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
                      const t = await login(el.value)
                      console.log('login token', t)
                      setShowLoginInput(false)
                      setReloadSignal(Date.now())
                    } catch (e:any) {
                      alert('Login failed: ' + (e?.message || e))
                    }
                  }}>Sign in</button>
                </div>
              </div>
            </div>
          )}

          {/* Token input modal (shown when user chooses to provide an access key) */}
          {showTokenPrompt && (
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
                      localStorage.setItem('mlcremote_token', el.value.trim())
                      setShowTokenPrompt(false)
                      setReloadSignal(Date.now())
                    } catch (e:any) {
                      alert('Failed to store token: ' + (e?.message || e))
                    }
                  }}>Use token</button>
                </div>
              </div>
            </div>
          )}
          {/* Tab bar for multiple open files */}
          <div>
            {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
          </div>
          {openFiles.length > 0 && (
            <div>
              {/* lazy TabBar import to keep bundle small */}
              <React.Suspense fallback={null}>
                {
                  (() => {
                    const titles: Record<string,string> = {}
                    for (const f of openFiles) {
                      if (f.startsWith('shell-')) {
                        const cwd = shellCwds[f] || ''
                        // show basename of cwd (or / if root) for shell tabs
                        const parts = (cwd || '/').split('/').filter(Boolean)
                        let name = '/'
                        if (parts.length) {
                          const last = parts[parts.length - 1]
                          // heuristic: if the last segment looks like a filename (contains a dot), use the parent directory
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
                    const types: Record<string,'file'|'dir'|'shell'> = {}
                    const fullPaths: Record<string,string> = {}
                    for (const f of openFiles) {
                      if (f.startsWith('shell-')) {
                        types[f] = 'shell'
                        fullPaths[f] = shellCwds[f] || '/'
                      } else {
                        types[f] = 'file'
                        fullPaths[f] = f
                      }
                    }

                    return (
                      <TabBarComponent openFiles={openFiles} active={activeFile} titles={titles} fullPaths={fullPaths} types={types} evictedTabs={evictedTabs} onRestoreEvicted={(p) => {
                        // restore the evicted tab by prepending it to openFiles (may evict another)
                        setOpenFiles(of => {
                          if (of.includes(p)) return of
                          const next = [p, ...of]
                          if (next.length <= maxTabs) return next
                          const ev = next[0]
                          // ensure we record evicted tab
                          setEvictedTabs(prev => prev.filter(x => x !== p).concat(ev))
                          return next.slice(1)
                        })
                      } }
                      onActivate={(p) => {
                        // ensure explorer shows this file's directory
                        if (p && !p.startsWith('shell-')) {
                          const parts = p.split('/').filter(Boolean)
                          parts.pop()
                          const dir = parts.length ? `/${parts.join('/')}` : ''
                          if (dir !== explorerDir) setExplorerDir(dir)
                        }
                        setSelectedPath(p)
                        // request explorer to focus the selected entry even if directory unchanged
                        setFocusRequest(Date.now())
                        setActiveFile(p)
                      }} onClose={(p)=>{
                        setOpenFiles(of => of.filter(x => x !== p))
                        if (activeFile === p) setActiveFile(openFiles.filter(x => x !== p)[0] || '')
                      }} onCloseOthers={(p) => {
                        setOpenFiles(of => of.filter(x => x === p || x === activeFile))
                      }} onCloseLeft={(p) => {
                        setOpenFiles(of => {
                          const idx = of.indexOf(p)
                          if (idx <= 0) return of
                          return of.slice(idx)
                        })
                      }} />
                    )
                  })()
                }

              </React.Suspense>
            </div>
          )}
          {/* Render all open files but keep only active one visible so their state (e.g., terminal buffer) is preserved */}
              {openFiles.map(f => (
            <div key={f} style={{ display: f === activeFile ? 'block' : 'none', height: '100%' }}>
              {f.startsWith('shell-') ? (
                <React.Suspense fallback={<div className="muted">Loading terminal…</div>}>
                  <TerminalTab key={f} shell={(settings && settings.defaultShell) || 'bash'} path={shellCwds[f] || ''} onExit={() => {
                    // close shell tab when terminal signals exit
                    setOpenFiles(of => of.filter(x => x !== f))
                    if (activeFile === f) setActiveFile(openFiles.filter(x => x !== f)[0] || '')
                    setShellCwds(s => { const ns = { ...s }; delete ns[f]; return ns })
                  }} />
                </React.Suspense>
              ) : f === 'trash' ? (
                <TrashView />
              ) : (
                <Editor path={f} settings={settings || undefined} onSaved={() => { /* no-op for now */ }} reloadTrigger={reloadTriggers[f] || 0} onUnsavedChange={handleUnsavedChange} onMeta={(m:any) => {
                  if (m && m.path) setFileMetas(fm => ({ ...fm, [f]: m }))
                }} />
              )}
            </div>
          ))}
          {openFiles.length === 0 && (
            <div className="welcome-message" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: '18px',
              textAlign: 'center',
              padding: '20px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}><Icon name={getIcon('folder')} size={48} /></div>
              <div>Welcome to MLCRemote</div>
              <div style={{ fontSize: '14px', marginTop: '10px' }}>
                Select a file from the explorer to start editing
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
      <LogOverlay visible={showLogs} onClose={() => setShowLogs(false)} />

      {/* Server time and timezone are shown inside the main About popup now. */}

      {aboutOpen && (
        <div className="about-backdrop" onClick={() => setAboutOpen(false)}>
          <div className="about-modal" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>MLCRemote</h3>
                <button aria-label="Close about" title="Close" onClick={() => setAboutOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Icon name="icon-close" size={16} /></button>
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
