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
  const [showLogs, setShowLogs] = React.useState<boolean>(true)
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
        <h1>Light Dev</h1>
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
          <button className="link" onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            setTheme(next)
            localStorage.setItem('theme', next)
            if (next === 'light') document.documentElement.classList.add('theme-light')
            else document.documentElement.classList.remove('theme-light')
          }}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</button>
          <button className="link" onClick={() => setShowLogs(s => !s)}>{showLogs ? 'Hide Logs' : 'Show Logs'}</button>
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
          {activeFile && activeFile.startsWith('shell-') ? (
            <TerminalTab shell={(settings && settings.defaultShell) || 'bash'} path={activeFile} />
          ) : (
            <Editor path={activeFile || selectedPath} settings={settings} onSaved={() => { /* no-op for now */ }} />
          )}
        </main>
      </div>
      <LogOverlay visible={showLogs} onClose={() => setShowLogs(false)} />

      {aboutOpen && (
        <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setAboutOpen(false)}>
          <div style={{ background: '#0b1220', padding: 20, borderRadius: 8, color: '#cbd5e1', minWidth: 320, zIndex: 10000 }} onClick={e => e.stopPropagation()}>
            <h3>Light Dev</h3>
            <div style={{ marginBottom: 8 }}>Copyright © {new Date().getFullYear()} Michael Lechner</div>
            <div style={{ marginBottom: 8 }}>Version: {health}</div>
            <div style={{ marginTop: 12 }}><button className="btn" onClick={() => setAboutOpen(false)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
