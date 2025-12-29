import React from 'react'
import type { Health } from './api'
import { getHealth, statPath } from './api'
import FileExplorer from './components/FileExplorer'
import Editor from './components/Editor'
import TerminalTab from './components/TerminalTab'
const TabBarComponent = React.lazy(() => import('./components/TabBar'))
import LogOverlay from './components/LogOverlay'
import { formatBytes } from './format'

/**
 * Top-level application component. Manages UI state for the file explorer,
 * editor tabs, terminal tabs and global settings such as theme and sidebar
 * width. Heavy-lifted responsibilities are split into child components.
 */
export default function App() {

  const [health, setHealth] = React.useState<null | Health>(null)
  const [lastHealthAt, setLastHealthAt] = React.useState<number | null>(null)
  const [selectedPath, setSelectedPath] = React.useState<string>('')
  const [openFiles, setOpenFiles] = React.useState<string[]>([])
  const [activeFile, setActiveFile] = React.useState<string>('')
  const [autoOpen, setAutoOpen] = React.useState<boolean>(true)
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
      // close the oldest opened (first) tab
      return next.slice(1)
    })
    setActiveFile(path)
  }
  const [shellCwds, setShellCwds] = React.useState<Record<string,string>>({})
  const [showHidden, setShowHidden] = React.useState<boolean>(false)
  const [showLogs, setShowLogs] = React.useState<boolean>(false)
  const [aboutOpen, setAboutOpen] = React.useState<boolean>(false)
  const [serverInfoOpen, setServerInfoOpen] = React.useState<boolean>(false)
  const [settings, setSettings] = React.useState<{ allowDelete: boolean; defaultShell: string } | null>(null)
  const [sidebarWidth, setSidebarWidth] = React.useState<number>(300)
  const [theme, setTheme] = React.useState<'dark'|'light'>(() => (localStorage.getItem('theme') as 'dark'|'light') || 'dark')
  const [now, setNow] = React.useState<Date>(new Date())
  const [isOnline, setIsOnline] = React.useState<boolean>(navigator.onLine)
  const [reloadTriggers, setReloadTriggers] = React.useState<Record<string, number>>({})

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
      } catch {
        if (!mounted) return
        setHealth(null)
      }
    }
    fetchHealth()
    const id = setInterval(fetchHealth, 60 * 1000)
    return () => { mounted = false; clearInterval(id) }
  }, [isOnline])

  // fetch runtime settings once on mount
  React.useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(j => setSettings(j))
      .catch(() => setSettings({ allowDelete: false, defaultShell: 'bash' }))
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
      getHealth().then(h => {
        setHealth(h)
        setLastHealthAt(Date.now())
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
        <h1>MLCRemote</h1>
        <div className="status">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 6, background: health && health.host ? '#10b981' : (isOnline ? '#f59e0b' : '#ef4444'), display: 'inline-block' }} />
            <span className={(health ? 'badge badge-ok' : (isOnline ? 'badge badge-error' : 'badge badge-error'))}>
              {health ? `${health.status}@${health.version}` : (isOnline ? 'connecting...' : 'offline')}
            </span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <button className="link" style={{ marginLeft: 8, fontSize: 12, padding: 0 }} onClick={() => setAboutOpen(true)}>{health && health.host ? health.host : (isOnline ? 'connecting...' : 'browser offline')}</button>
              {health && health.server_time && (
                <button className="link" style={{ marginLeft: 0, fontSize: 12, padding: '0 6px' }} onClick={() => setServerInfoOpen(true)}>i</button>
              )}
            </div>
          </span>
          {/* memory gauge */}
          {health && health.sys_mem_total_bytes ? (
            (() => {
              const total = health.sys_mem_total_bytes || 1
              const free = health.sys_mem_free_bytes || 0
              const used = total - free
              const pct = Math.round((used / total) * 100)
              return (
                <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 120, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? '#e11d48' : '#10b981', borderRadius: 6 }} />
                  </div>
                  <div className="muted" style={{ fontSize: 12 }} title={`Memory usage: ${formatBytes(used)} / ${formatBytes(total)} (${pct}%)`}>{pct}%</div>
                </div>
              )
            })()
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="muted" style={{ fontSize: 12 }}>{new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' }).format(now)}</div>
            <div className="muted" style={{ fontSize: 12 }}>cwd: {selectedPath || '/'}</div>
            <button className="link" onClick={async () => {
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
              openFile(shellName)
              setShellCwds(s => ({ ...s, [shellName]: cwd || '' }))
            }}>New Shell</button>
          </div>
          <label style={{ marginLeft: 8, fontSize: 12 }} className="muted"><input type="checkbox" checked={autoOpen} onChange={e => setAutoOpen(e.target.checked)} /> Auto open</label>
          <button className="link icon-btn" aria-label="Toggle theme" onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            setTheme(next)
            localStorage.setItem('theme', next)
            if (next === 'light') document.documentElement.classList.add('theme-light')
            else document.documentElement.classList.remove('theme-light')
          }}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <button className="link icon-btn" aria-label="Toggle logs" onClick={() => setShowLogs(s => !s)}>
            {showLogs ? '👁️' : '🙈'}
          </button>
          <button className="link" onClick={() => setAboutOpen(true)}>About</button>
        </div>
      </header>
      <div className="app-body" style={{ alignItems: 'stretch' }}>
        <aside className="sidebar" style={{ width: sidebarWidth }}>
          <FileExplorer showHidden={showHidden} autoOpen={autoOpen} onToggleHidden={(v) => setShowHidden(v)} onSelect={(p, isDir) => {
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
          }} onBackendActive={checkHealthStatus} />
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
                        titles[f] = cwd || f
                      } else {
                        titles[f] = f.split('/').pop() || f
                      }
                    }
                    const types: Record<string,'file'|'dir'|'shell'> = {}
                    for (const f of openFiles) {
                      if (f.startsWith('shell-')) types[f] = 'shell'
                      else types[f] = 'file'
                    }
                    return (
                      <TabBarComponent openFiles={openFiles} active={activeFile} titles={titles} types={types} onActivate={(p) => {
                        setActiveFile(p)
                        // Trigger reload check for file tabs
                        if (!p.startsWith('shell-')) {
                          setReloadTriggers(triggers => ({
                            ...triggers,
                            [p]: (triggers[p] || 0) + 1
                          }))
                        }
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
                <TerminalTab key={f} shell={(settings && settings.defaultShell) || 'bash'} path={shellCwds[f] || ''} onExit={() => {
                  // close shell tab when terminal signals exit
                  setOpenFiles(of => of.filter(x => x !== f))
                  if (activeFile === f) setActiveFile(openFiles.filter(x => x !== f)[0] || '')
                  setShellCwds(s => { const ns = { ...s }; delete ns[f]; return ns })
                }} />
              ) : (
                <Editor path={f} settings={settings} onSaved={() => { /* no-op for now */ }} reloadTrigger={reloadTriggers[f] || 0} />
              )}
            </div>
          ))}
          </div>
        </main>
      </div>
      <LogOverlay visible={showLogs} onClose={() => setShowLogs(false)} />

      {serverInfoOpen && health && (
        <div className="about-backdrop" onClick={() => setServerInfoOpen(false)}>
          <div className="about-modal" onClick={e => e.stopPropagation()}>
            <h4>Server Info</h4>
            <div style={{ marginBottom: 8 }}>Server time: {health.server_time}</div>
            <div style={{ marginBottom: 8 }}>Timezone: {health.timezone}</div>
            <div><button className="btn" onClick={() => setServerInfoOpen(false)}>Close</button></div>
          </div>
        </div>
      )}

      {aboutOpen && (
        <div className="about-backdrop" onClick={() => setAboutOpen(false)}>
          <div className="about-modal" onClick={e => e.stopPropagation()}>
            <h3>MLCRemote</h3>
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
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Last refresh: {lastHealthAt ? new Date(lastHealthAt).toLocaleString() : 'n/a'}</div>
              </div>
            )}
            <div style={{ marginTop: 12 }}><button className="btn" onClick={() => setAboutOpen(false)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
