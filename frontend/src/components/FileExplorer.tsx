import React from 'react'
import { DirEntry, listTree, deleteFile, makeUrl } from '../api'
import { authedFetch } from '../utils/auth'
import { Icon, iconForMimeOrFilename, iconForExtension } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import ContextMenu, { ContextMenuItem } from './ContextMenu'
import { useTranslation } from 'react-i18next'

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
  reloadSignal?: number
}

/**
 * FileExplorer component — lists files and directories under the server root
 * and supports navigation, drag-and-drop upload, and lightweight actions
 * such as Download and (when `autoOpen` is false) a View button.
 */
export default function FileExplorer({ onSelect, showHidden, onToggleHidden, autoOpen = true, onView, onBackendActive, onChangeRoot, canChangeRoot, selectedPath, activeDir, onDirChange, focusRequest, reloadSignal }: Props): React.ReactElement {
  const { t } = useTranslation()
  const [path, setPath] = React.useState<string>('')
  const [entries, setEntries] = React.useState<DirEntry[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')
  const [dragOver, setDragOver] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState<boolean>(false)

  // Context Menu State
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; item: DirEntry } | null>(null)

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
      setError(e.message || t('status_failed'))
    } finally {
      setLoading(false)
    }
  }, [showHidden, onBackendActive, onDirChange, t])

  const currentPathRef = React.useRef<string>('')

  // if parent asks us to show a specific directory, load it
  React.useEffect(() => {
    if (typeof activeDir === 'undefined') return
    // only load if different from current path
    if (activeDir === path) return
    load(activeDir)
  }, [activeDir, path, load])

  React.useEffect(() => { load('') }, [load])

  // reload when parent signals a change (explicit refresh requests from parent)
  React.useEffect(() => {
    load(path || '')
  }, [path, load, reloadSignal])

  const up = (): void => {
    if (!path || path === '/') { load(''); return }
    const parts = path.split('/').filter(Boolean)
    parts.pop()
    const parent = `/${parts.join('/')}`
    load(parent || '')
  }

  const doUpload = async (targetDir: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    console.log('Dropping files:', files.length, 'to', targetDir)

    // eslint-disable-next-line no-restricted-globals
    if (!confirm(t('upload_confirm', `Upload ${files.length} file(s) to ${targetDir}?`))) return

    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      for (let i = 0; i < files.length; i++) form.append('file', files[i], files[i].name)
      const q = `?path=${encodeURIComponent(targetDir)}`
      const res = await authedFetch(`/api/upload${q}`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(t('status_failed'))
      // reload directory after upload
      await load(targetDir)
    } catch (e: any) {
      setError(e.message || t('status_failed'))
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent, targetDir: string) => {
    e.preventDefault()
    console.log('onDrop triggered', targetDir)
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
  }, [focusRequest, selectedPath])

  const handleDelete = async (p: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(t('delete_confirm', { path: p }))) return
    try {
      await deleteFile(p)
      load(path)
    } catch (e: any) {
      alert(t('status_failed') + ': ' + e.message)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, item: DirEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, item })
  }

  return (
    <div className="explorer">
      <div className="explorer-header">
        <strong className='hidden'><Icon name={getIcon('dir')} /></strong>
        <div className="explorer-controls">
          <button className="link icon-btn" title={t('refresh')} onClick={() => load(path || '')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
          {/* Settings moved to global settings popup; kept here for accessibility if needed */}
          {canChangeRoot && typeof onChangeRoot === 'function' && (
            <button className="link icon-btn" aria-label={t('change_root')} title={t('change_root')} onClick={async () => {
              // ask parent app to change root (parent may open a picker)
              try {
                await Promise.resolve(onChangeRoot(''))
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
        {loading && <div className="muted">{t('loading')}</div>}
        {error && <div className="error">{error}</div>}
        {uploading && <div className="muted">{t('upload')}...</div>}
        {!loading && !error && (
          <ul className="entry-list" ref={listRef}>
            {path && path !== '/' && (
              <li key="up">
                <button type="button" className="entry" onClick={up}>..</button>
              </li>
            )}
            {entries.map(e => (
              <li key={e.path} onContextMenu={(ev) => handleContextMenu(ev, e)}>
                {e.isDir ? (
                  <button data-path={e.path} type="button" className={"entry" + (selectedPath === e.path ? ' selected' : '')} onClick={() => { load(e.path); onSelect(e.path, true) }} onDrop={(ev) => onDrop(ev, e.path)} onDragOver={(ev) => onDragOver(ev, e.path)} onDragLeave={onDragLeave}>
                    <span className="icon"><Icon name={iconForExtension('dir') || getIcon('dir')} /></span> {e.name}
                    {e.isSymlink && <span title="Symbolic Link" style={{ marginLeft: 4, opacity: 0.5 }}>🔗</span>}
                    {e.isBroken && <span title="Broken Link" style={{ marginLeft: 4 }}>❌</span>}
                    {e.isExternal && <span title="External Link" style={{ marginLeft: 4 }}>↗️</span>}

                    {dragOver === e.path ? <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>{t('drop_to_upload')}</span> : null}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <button data-path={e.path} type="button" className="entry" style={{ flex: 1, textAlign: 'left' }} onClick={() => {
                      if (autoOpen === false) {
                        // Metadata View Mode: Select file and open/focus 'metadata' tab
                        onSelect(e.path, false)
                        if (onView) onView('metadata')
                        return
                      }
                      onSelect(e.path, false)
                    }}>
                      <span className="icon"><Icon name={iconForMimeOrFilename(undefined, e.name) || iconForExtension(e.name.split('.').pop() || '') || getIcon('view') || 'icon-text'} /></span> {e.name}
                      {e.isSymlink && <span title="Symbolic Link" style={{ marginLeft: 4, opacity: 0.5 }}>🔗</span>}
                      {e.isBroken && <span title="Broken Link" style={{ marginLeft: 4 }}>❌</span>}
                      {e.isExternal && <span title="External Link" style={{ marginLeft: 4 }}>↗️</span>}

                    </button>
                    {!autoOpen ? (
                      <button className="btn" onClick={() => onView ? onView(e.path) : onSelect(e.path, false)} title={t('view_file')}><Icon name={getIcon('view')} /></button>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "OPEN TEST",
              icon: <Icon name={getIcon('view')} />,
              action: () => {
                if (contextMenu.item.isDir) {
                  load(contextMenu.item.path)
                  onSelect(contextMenu.item.path, true)
                } else {
                  if (autoOpen) {
                    onSelect(contextMenu.item.path, false)
                  } else {
                    if (onView) onView(contextMenu.item.path)
                    else onSelect(contextMenu.item.path, false)
                  }
                }
              }
            },
            {
              label: `${t('download')} ${contextMenu.item.isDir ? '(Dir)' : ''}`,
              icon: <Icon name={getIcon('download')} />,
              action: () => {
                const link = document.createElement('a')
                link.href = makeUrl(`/api/file?path=${encodeURIComponent(contextMenu.item.path)}${localStorage.getItem('mlcremote_token') ? `&token=${encodeURIComponent(localStorage.getItem('mlcremote_token') || '')}` : ''}`)
                link.download = contextMenu.item.name
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              },
              separator: true
            },
            {
              label: t('copy_full_path'),
              icon: <Icon name={getIcon('copy')} />,
              action: async () => {
                try {
                  await navigator.clipboard.writeText(contextMenu.item.path)
                } catch (e) {
                  console.error('Failed to copy', e)
                }
              }
            },
            {
              label: t('copy_relative_path'),
              icon: <Icon name={getIcon('link')} />,
              action: async () => {
                try {
                  // Remove leading slash to make it relative to root
                  const rel = contextMenu.item.path.startsWith('/') ? contextMenu.item.path.slice(1) : contextMenu.item.path
                  await navigator.clipboard.writeText(rel)
                } catch (e) {
                  console.error('Failed to copy', e)
                }
              }
            },
            {
              label: t('copy_name'),
              icon: <Icon name={getIcon('text')} />,
              action: async () => {
                try {
                  await navigator.clipboard.writeText(contextMenu.item.name)
                } catch (e) { console.error(e) }
              },
              separator: true
            },
            {
              label: t('delete'),
              icon: <Icon name={getIcon('trash')} />,
              danger: true,
              action: () => handleDelete(contextMenu.item.path)
            }
          ]}
        />
      )}
    </div>
  )
}