import React from 'react'
import { statPath } from '../api'
import { formatBytes } from '../utils/bytes'

export default function BinaryView({ path }: { path?: string }) {
  const [meta, setMeta] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
      ; (async () => {
        if (!path) { setMeta(null); return }
        try {
          const m = await statPath(path)
          if (!mounted) return
          setMeta(m)
          setError(null)
        } catch (e: any) {
          if (!mounted) return
          setError(e?.message || 'failed to fetch metadata')
          setMeta(null)
        }
      })()
    return () => { mounted = false }
  }, [path])

  if (!path) return <div style={{ padding: 12 }} className="muted">No file selected</div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{path.split('/').pop()}</div>
          <div className="muted" style={{ fontSize: 12 }}>{path}</div>
        </div>
        <div>
          <a className="link" href={`/api/file?path=${encodeURIComponent(path)}`} download={path.split('/').pop()}>Download</a>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        {error ? <div className="error">{error}</div> : null}
        {meta ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ width: 160, padding: 6 }} className="muted">Full path</td><td style={{ padding: 6 }}>{meta.path || path}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>MIME</td><td style={{ padding: 6 }}>{meta.mime || 'unknown'}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>Size</td><td style={{ padding: 6 }}>{meta.size ? formatBytes(meta.size) : 'n/a'}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>Mode</td><td style={{ padding: 6 }}>{meta.mode || 'n/a'}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>Last Modified</td><td style={{ padding: 6 }}>{meta.modTime ? new Date(meta.modTime).toLocaleString() : 'n/a'}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>Is Dir</td><td style={{ padding: 6 }}>{meta.isDir ? 'yes' : 'no'}</td></tr>
            </tbody>
          </table>
        ) : (
          <div className="muted">Loading metadata…</div>
        )}
      </div>
    </div>
  )
}
