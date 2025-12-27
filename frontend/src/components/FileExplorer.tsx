import React from 'react'
import { DirEntry, listTree } from '../api'

function joinPath(base: string, name: string) {
  if (!base || base === '/') return `/${name}`
  return `${base}/${name}`.replaceAll('//', '/')
}

type Props = {
  onSelect: (path: string) => void
}

export default function FileExplorer({ onSelect }: Props) {
  const [path, setPath] = React.useState<string>('')
  const [entries, setEntries] = React.useState<DirEntry[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')

  const load = React.useCallback(async (p: string) => {
    setLoading(true)
    setError('')
    try {
      const list = await listTree(p)
      setEntries(list)
      setPath(p)
    } catch (e: any) {
      setError(e.message || 'failed to list')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load('') }, [load])

  const up = () => {
    if (!path || path === '/') return load('')
    const parts = path.split('/').filter(Boolean)
    parts.pop()
    const parent = `/${parts.join('/')}`
    load(parent || '')
  }

  return (
    <div className="explorer">
      <div className="explorer-header">
        <strong>Files</strong>
        <div className="breadcrumbs">
          <button className="link" onClick={() => load('')}>root</button>
          {path && path.split('/').filter(Boolean).map((seg, idx, arr) => {
            const p = `/${arr.slice(0, idx + 1).join('/')}`
            return (
              <span key={p}>
                {' / '}<button className="link" onClick={() => load(p)}>{seg}</button>
              </span>
            )
          })}
        </div>
      </div>
      <div className="explorer-body">
        {loading && <div className="muted">Loading...</div>}
        {error && <div className="error">{error}</div>}
        {!loading && !error && (
          <ul className="entry-list">
            {path && path !== '/' && (
              <li>
                <button className="entry" onClick={up}>..</button>
              </li>
            )}
            {entries.map(e => (
              <li key={e.path}>
                {e.isDir ? (
                  <button className="entry" onClick={() => load(e.path)}>
                    <span className="icon">📁</span> {e.name}
                  </button>
                ) : (
                  <button className="entry" onClick={() => onSelect(e.path)}>
                    <span className="icon">{iconForEntry(e)}</span> {e.name}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function iconForEntry(e: { name: string; path: string; isDir: boolean }) {
  const ext = e.name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'json') return '🟦'
  if (ext === 'yml' || ext === 'yaml') return '🟪'
  if (ext === 'md' || ext === 'markdown') return '📘'
  if (ext === 'go') return '🐹'
  if (ext === 'sh' || ext === 'bash') return '🐚'
  if (ext === 'txt') return '📄'
  return '📄'
}
