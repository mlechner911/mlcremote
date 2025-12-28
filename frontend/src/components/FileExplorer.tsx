import React from 'react'
import { DirEntry, listTree } from '../api'

type Props = {
  onSelect: (path: string, isDir: boolean) => void
  showHidden: boolean
  onToggleHidden?: (v: boolean) => void
  autoOpen?: boolean
  onView?: (path: string) => void
}

/**
 * FileExplorer component — lists files and directories under the server root
 * and supports navigation, drag-and-drop upload, and lightweight actions
 * such as Download and (when `autoOpen` is false) a View button.
 */
export default function FileExplorer({ onSelect, showHidden, onToggleHidden, autoOpen = true, onView }: Props): JSX.Element {
  const [path, setPath] = React.useState<string>('')
  const [entries, setEntries] = React.useState<DirEntry[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')
  const [dragOver, setDragOver] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState<boolean>(false)

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

  const doUpload = async (targetDir: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      for (let i = 0; i < files.length; i++) form.append('file', files[i], files[i].name)
      const q = `?path=${encodeURIComponent(targetDir)}`
      const res = await fetch(`/api/upload${q}`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('upload failed')
      // reload directory after upload
      await load(targetDir)
    } catch (e: any) {
      setError(e.message || 'upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent, targetDir: string) => {
    e.preventDefault()
    setDragOver(null)
    doUpload(targetDir, e.dataTransfer.files)
  }

  const onDragOver = (e: React.DragEvent, targetDir: string) => {
    e.preventDefault()
    setDragOver(targetDir)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(null)
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
      <div className="explorer-body" onDrop={(e) => onDrop(e, path || '')} onDragOver={(e) => onDragOver(e, path || '')} onDragLeave={onDragLeave}>
        {loading && <div className="muted">Loading...</div>}
        {error && <div className="error">{error}</div>}
        {uploading && <div className="muted">Uploading...</div>}
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
                  <button type="button" className="entry" onClick={() => { load(e.path); onSelect(e.path, true) }} onDrop={(ev) => onDrop(ev, e.path)} onDragOver={(ev) => onDragOver(ev, e.path)} onDragLeave={onDragLeave}>
                    <span className="icon">📁</span> {e.name}
                    {dragOver === e.path ? <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>Drop to upload</span> : null}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="entry" style={{ flex: 1, textAlign: 'left' }} onClick={() => {
                      if (autoOpen === false) {
                        // just select (do not open persistent tab)
                        onSelect(e.path, false)
                        return
                      }
                      onSelect(e.path, false)
                    }}>
                      <span className="icon">{iconForEntry(e)}</span> {e.name}
                    </button>
                    {!autoOpen ? (
                      <button className="btn" onClick={() => onView ? onView(e.path) : onSelect(e.path, false)} title="View file">👁️</button>
                    ) : null}
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
