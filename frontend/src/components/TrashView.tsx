import React from 'react'
import { Icon, iconForMimeOrFilename, iconForExtension } from '../generated/icons'
import { formatBytes } from '../bytes'

type TrashEntry = { originalPath: string; trashPath: string; deletedAt: string }

export default function TrashView() {
  const [entry, setEntry] = React.useState<TrashEntry | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)

  const fetchRecent = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/trash/recent')
      if (!r.ok) throw new Error('fetch failed')
      const arr = await r.json()
      if (Array.isArray(arr) && arr.length > 0) setEntry(arr[0])
      else setEntry(null)
    } catch (e) {
      console.warn('Failed to fetch trash', e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchRecent()
    const id = setInterval(fetchRecent, 10000)
    return () => clearInterval(id)
  }, [fetchRecent])

  if (loading && !entry) return <div className="muted">Loading trash…</div>
  if (!entry) return <div className="muted">Trash is empty</div>

  const name = entry.originalPath.split('/').pop() || entry.originalPath
  const iconName = iconForMimeOrFilename(undefined, name) || iconForExtension(name.split('.').pop() || '') || 'icon-trash'

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Icon name={iconName} size={20} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div className="muted" style={{ fontSize: 12 }}>{new Date(entry.deletedAt).toLocaleString()}</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="muted">Original path: {entry.originalPath}</div>
        <div className="muted">Trash path: {entry.trashPath}</div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn" disabled>Undo (coming)</button>
        <a className="btn" style={{ marginLeft: 8 }} href={`/api/file?path=${encodeURIComponent(entry.trashPath)}`} download={name}>Download</a>
      </div>
    </div>
  )
}
