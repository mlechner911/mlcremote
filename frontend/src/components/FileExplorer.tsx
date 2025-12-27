import React from 'react'
import { DirEntry, listTree } from '../api'

type Props = {
  onSelect: (path: string) => void
  showHidden: boolean
  onToggleHidden?: (v: boolean) => void
}

export default function FileExplorer({ onSelect, showHidden, onToggleHidden }: Props): JSX.Element {
  const [path, setPath] = React.useState<string>('')
  const [entries, setEntries] = React.useState<DirEntry[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')

  const load = React.useCallback(async (p: string) => {
    setLoading(true)
    setError('')
    try {
      const list = await listTree(p, { showHidden })
      setEntries(list)
      setPath(p)
    } catch (e: any) {
      setError(e.message || 'failed to list')
    } finally {
      setLoading(false)
    }
  }, [showHidden])

  React.useEffect(() => { load('') }, [load])

  const up = (): void => {
    if (!path || path === '/') { load(''); return }
    const parts = path.split('/').filter(Boolean)
    parts.pop()
    const parent = `/${parts.join('/')}`
    load(parent || '')
  }

  return (
    <div className="explorer">
      <div className="explorer-header">
        <strong>Files</strong>
        <div className="explorer-controls">
          <label className="muted" style={{ fontSize: '0.9rem' }}>
            <input type="checkbox" checked={showHidden} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onToggleHidden?.(e.target.checked)} />{' '}
            Show hidden
          </label>
        </div>
        <div className="breadcrumbs">
          <button type="button" className="link" onClick={() => load('')}>root</button>
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
              <li key="up">
                <button type="button" className="entry" onClick={up}>..</button>
              </li>
            )}
            {entries.map(e => (
              <li key={e.path}>
                {e.isDir ? (
                  <button type="button" className="entry" onClick={() => load(e.path)}>
                    <span className="icon">📁</span> {e.name}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="entry" style={{ flex: 1, textAlign: 'left' }} onClick={() => onSelect(e.path)}>
                      <span className="icon">{iconForEntry(e)}</span> {e.name}
                    </button>
                    <a className="btn" href={`/api/file?path=${encodeURIComponent(e.path)}`} download={e.name} style={{ whiteSpace: 'nowrap' }}>Download</a>
                  </div>
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
