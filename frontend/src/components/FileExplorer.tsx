import React from 'react'
import { DirEntry, listTree } from '../api'
import { Icon, iconForMimeOrFilename, iconForExtension } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'

type Props = {
  onSelect: (path: string, isDir: boolean) => void
  showHidden: boolean
  onToggleHidden?: (v: boolean) => void
  autoOpen?: boolean
  onView?: (path: string) => void
  onBackendActive?: () => void
  onChangeRoot?: (newRoot: string) => void
  canChangeRoot?: boolean
  selectedPath?: string
  activeDir?: string
  onDirChange?: (dir: string) => void
  focusRequest?: number
}

/**
 * FileExplorer component — lists files and directories under the server root
 * and supports navigation, drag-and-drop upload, and lightweight actions
 * such as Download and (when `autoOpen` is false) a View button.
 */
export default function FileExplorer({ onSelect, showHidden, onToggleHidden, autoOpen = true, onView, onBackendActive, onChangeRoot, canChangeRoot, selectedPath, activeDir, onDirChange, focusRequest }: Props): React.ReactElement {
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
      // notify parent which directory is currently displayed, but only when it actually changes
      try {
        // use a ref to avoid calling onDirChange repeatedly
        if (currentPathRef.current !== p) {
          onDirChange?.(p)
          currentPathRef.current = p
        }
      } catch (e) { /* ignore */ }
      // notify that backend is active
      onBackendActive?.()
      // after DOM updates, try to focus the selected item if it exists in this directory
      try {
        const sel = selectedPathRef.current
        if (sel) {
          requestAnimationFrame(() => {
            const ul = listRef.current
            if (!ul) return
            try {
              const btn = ul.querySelector(`[data-path="${CSS.escape(sel)}"]`) as HTMLElement | null
              if (btn) {
                btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
                btn.focus()
              }
            } catch (e) {
              // ignore selector errors
            }
          })
        }
      } catch (e) {
        // ignore
      }
    } catch (e: any) {
      setError(e.message || 'failed to list')
    } finally {
      setLoading(false)
    }
  }, [showHidden, onBackendActive, onDirChange])

  const currentPathRef = React.useRef<string>('')

  // if parent asks us to show a specific directory, load it
  React.useEffect(() => {
    if (typeof activeDir === 'undefined') return
    // only load if different from current path
    if (activeDir === path) return
    load(activeDir)
  }, [activeDir, path, load])

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

  const listRef = React.useRef<HTMLUListElement | null>(null)
  const selectedPathRef = React.useRef<string>('')

  React.useEffect(() => { selectedPathRef.current = selectedPath || '' }, [selectedPath])

  // Scroll selected item into view when selectedPath or current directory changes
  React.useEffect(() => {
    if (!selectedPath) return
    // find the DOM node for the selected item
    try {
      const ul = listRef.current
      if (!ul) return
      const item = ul.querySelector(`li[key="${CSS.escape(selectedPath)}"]`)
      // fallback: search by data-path attribute on buttons
      const item2 = ul.querySelector(`[data-path="${selectedPath}"]`)
      const el = (item as HTMLElement) || (item2 as HTMLElement)
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
        const btn = el.querySelector('button.entry') as HTMLElement | null
        if (btn) btn.focus()
      }
    } catch (e) {
      // ignore DOM errors
    }
  }, [selectedPath, path])

  // If parent requests focus explicitly (even if selectedPath didn't change), honor it
  React.useEffect(() => {
    if (!focusRequest) return
    try {
      const sel = selectedPath || ''
      if (!sel) return
      const ul = listRef.current
      if (!ul) return
      const esc = CSS.escape(sel)
      const btn = ul.querySelector(`[data-path="${esc}"]`) as HTMLElement | null
      if (btn) {
        btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
        btn.focus()
      }
    } catch (e) {
      // ignore
    }
  }, [focusRequest])

  return (
    <div className="explorer">
      <div className="explorer-header">
      <strong className='hidden'><Icon name={getIcon('dir')} /></strong>
        <div className="explorer-controls">
          {/* Settings moved to global settings popup; kept here for accessibility if needed */}
          {canChangeRoot && typeof onChangeRoot === 'function' && (
            <button className="link icon-btn" aria-label="Change root" title="Change root" onClick={async () => {
              // ask parent app to change root (parent may open a picker)
              try {
                const res = await Promise.resolve(onChangeRoot(''))
                // parent handles selection flow; nothing more to do here
              } catch (e) {
                // ignore
              }
            }}><Icon name={getIcon('dir')} /></button>
          )}
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
          <ul className="entry-list" ref={listRef}>
            {path && path !== '/' && (
              <li key="up">
                <button type="button" className="entry" onClick={up}>..</button>
              </li>
            )}
            {entries.map(e => (
              <li key={e.path}>
                  {e.isDir ? (
                    <button data-path={e.path} type="button" className={"entry" + (selectedPath === e.path ? ' selected' : '')} onClick={() => { load(e.path); onSelect(e.path, true) }} onDrop={(ev) => onDrop(ev, e.path)} onDragOver={(ev) => onDragOver(ev, e.path)} onDragLeave={onDragLeave}>
                    <span className="icon"><Icon name={iconForExtension('dir') || getIcon('dir')} /></span> {e.name}
                    {dragOver === e.path ? <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>Drop to upload</span> : null}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <button data-path={e.path} type="button" className="entry" style={{ flex: 1, textAlign: 'left' }} onClick={() => {
                      if (autoOpen === false) {
                        // just select (do not open persistent tab)
                        onSelect(e.path, false)
                        return
                      }
                      onSelect(e.path, false)
                    }}>
                      <span className="icon"><Icon name={iconForMimeOrFilename(undefined, e.name) || iconForExtension(e.name.split('.').pop()||'') || getIcon('view') || 'icon-text'} /></span> {e.name}
                    </button>
                    {!autoOpen ? (
                      <button className="btn" onClick={() => onView ? onView(e.path) : onSelect(e.path, false)} title="View file"><Icon name={getIcon('view')} /></button>
                    ) : null}
                    <a className="btn" href={`/api/file?path=${encodeURIComponent(e.path)}`} download={e.name} style={{ whiteSpace: 'nowrap' }} title="Download" aria-label={`Download ${e.name}`}><Icon name={getIcon('download')} /></a>
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
/* moved
function iconForEntry(e: { name: string; path: string; isDir: boolean }) {
  const ext = e.name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'json') return '🟦'
  if (ext === 'yml' || ext === 'yaml') return '🟪'
  if (ext === 'md' || ext === 'markdown') return '📘'
  if (ext === 'go') return '🐹'
  if (ext === 'sh' || ext === 'bash') return 'terminal'
  if (ext === 'txt') return '📄'
  return '📄'
}
*/