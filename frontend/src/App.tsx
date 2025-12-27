import React from 'react'
import { getHealth } from './api'
import FileExplorer from './components/FileExplorer'
import Editor from './components/Editor'
const TabBarComponent = React.lazy(() => import('./components/TabBar'))
import LogOverlay from './components/LogOverlay'

export default function App() {
  const [health, setHealth] = React.useState('unknown')
  const [selectedPath, setSelectedPath] = React.useState<string>('')
  const [openFiles, setOpenFiles] = React.useState<string[]>([])
  const [activeFile, setActiveFile] = React.useState<string>('')

  React.useEffect(() => {
    getHealth()
      .then(h => setHealth(`${h.status}@${h.version}`))
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Light Dev</h1>
        <div className="status">
          <span className={health.startsWith('offline') ? 'badge badge-error' : 'badge badge-ok'}>
            {health}
          </span>
          <a className="link" href="/docs" target="_blank" rel="noreferrer">API Docs</a>
        </div>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <FileExplorer onSelect={(p) => {
            setSelectedPath(p)
            setOpenFiles(of => of.includes(p) ? of : [...of, p])
            setActiveFile(p)
          }} />
        </aside>
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
          <Editor path={activeFile || selectedPath} onSaved={() => { /* no-op for now */ }} />
        </main>
      </div>
      <LogOverlay />
    </div>
  )
}
