import React from 'react'
import { getHealth } from './api'
import FileExplorer from './components/FileExplorer'
import Editor from './components/Editor'
import TerminalTab from './components/TerminalTab'
const TabBarComponent = React.lazy(() => import('./components/TabBar'))
import LogOverlay from './components/LogOverlay'

export default function App() {
  const [health, setHealth] = React.useState('unknown')
  const [selectedPath, setSelectedPath] = React.useState<string>('')
  const [openFiles, setOpenFiles] = React.useState<string[]>([])
  const [activeFile, setActiveFile] = React.useState<string>('')
  const [showHidden, setShowHidden] = React.useState<boolean>(false)
  const [showLogs, setShowLogs] = React.useState<boolean>(false)
  const [aboutOpen, setAboutOpen] = React.useState<boolean>(false)
  const [settings, setSettings] = React.useState<{ allowDelete: boolean; defaultShell: string } | null>(null)
  const [sidebarWidth, setSidebarWidth] = React.useState<number>(300)
  const [theme, setTheme] = React.useState<'dark'|'light'>(() => (localStorage.getItem('theme') as 'dark'|'light') || 'dark')

  React.useEffect(() => {
    getHealth()
      .then(h => setHealth(`${h.status}@${h.version}`))
      .catch(() => setHealth('offline'))
    // fetch runtime settings
    fetch('/api/settings').then(r => r.json()).then(j => setSettings(j)).catch(() => setSettings({ allowDelete: false, defaultShell: 'bash' }))
    // apply theme
    if (theme === 'light') document.documentElement.classList.add('theme-light')
    else document.documentElement.classList.remove('theme-light')
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>MLCRemote</h1>
        <div className="status">
          <span className={health.startsWith('offline') ? 'badge badge-error' : 'badge badge-ok'}>
            {health}
          </span>
          <button className="link" onClick={() => {
            // create a new shell tab
            const shellName = `shell-${Date.now()}`
            setOpenFiles(of => [...of, shellName])
            setActiveFile(shellName)
          }}>New Shell</button>
          <button className="link icon-btn" aria-label="Toggle theme" onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            setTheme(next)
            localStorage.setItem('theme', next)
            if (next === 'light') document.documentElement.classList.add('theme-light')
            else document.documentElement.classList.remove('theme-light')
          }}>
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.8 1.8-1.8zm10.48 0l1.79-1.79 1.79 1.79-1.79 1.8-1.79-1.8zM12 4V1h-1v3h1zm0 19v-3h-1v3h1zM4 13H1v-1h3v1zm19 0h-3v-1h3v1z" fill="currentColor"/></svg>
            )}
          </button>
          <button className="link icon-btn" aria-label="Toggle logs" onClick={() => setShowLogs(s => !s)}>
            {showLogs ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 10a3 3 0 110-6 3 3 0 010 6z" fill="currentColor"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3l19 19-1.5 1.5L.5 4.5 2 3zM12 5c-3 0-5.8 1.6-8 4 1.8 2.1 4.1 3.6 8 3.6 3.9 0 6.2-1.5 8-3.6-2.2-2.4-5-4-8-4z" fill="currentColor"/></svg>
            )}
          </button>
          <button className="link" onClick={() => setAboutOpen(true)}>About</button>
        </div>
      </header>
      <div className="app-body" style={{ alignItems: 'stretch' }}>
        <aside className="sidebar" style={{ width: sidebarWidth }}>
          <FileExplorer showHidden={showHidden} onToggleHidden={(v) => setShowHidden(v)} onSelect={(p) => {
            setSelectedPath(p)
            setOpenFiles(of => of.includes(p) ? of : [...of, p])
            setActiveFile(p)
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
          {/* Tab bar for multiple open files */}
          <div>
            {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
          </div>
          {openFiles.length > 0 && (
            <div>
              {/* lazy TabBar import to keep bundle small */}
              <React.Suspense fallback={null}>
                <TabBarComponent openFiles={openFiles} active={activeFile} onActivate={(p)=>setActiveFile(p)} onClose={(p)=>{
                  setOpenFiles(of => of.filter(x => x !== p))
                  if (activeFile === p) setActiveFile(openFiles.filter(x => x !== p)[0] || '')
                }} />
              </React.Suspense>
            </div>
          )}
          {/* Render all open files but keep only active one visible so their state (e.g., terminal buffer) is preserved */}
          {openFiles.map(f => (
            <div key={f} style={{ display: f === activeFile ? 'block' : 'none', height: '100%' }}>
              {f.startsWith('shell-') ? (
                <TerminalTab key={f} shell={(settings && settings.defaultShell) || 'bash'} path={f} />
              ) : (
                <Editor path={f} settings={settings} onSaved={() => { /* no-op for now */ }} />
              )}
            </div>
          ))}
        </main>
      </div>
      <LogOverlay visible={showLogs} onClose={() => setShowLogs(false)} />

      {aboutOpen && (
        <div className="about-backdrop" onClick={() => setAboutOpen(false)}>
          <div className="about-modal" onClick={e => e.stopPropagation()}>
            <h3>MLCRemote</h3>
            <div style={{ marginBottom: 8 }}>Copyright © {new Date().getFullYear()} Michael Lechner</div>
            <div style={{ marginBottom: 8 }}>Version: {health}</div>
            <div style={{ marginTop: 12 }}><button className="btn" onClick={() => setAboutOpen(false)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
