import React from 'react'
import { statPath } from '../api'
import { formatBytes } from '../utils/bytes'
import { useTranslation } from 'react-i18next'

export default function BinaryView({ path }: { path?: string }) {
  const { t } = useTranslation()
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
          setError(e?.message || t('failed_fetch_metadata'))
          setMeta(null)
        }
      })()
    return () => { mounted = false }
  }, [path, t])

  if (!path) return <div style={{ padding: 12 }} className="muted">{t('no_file_selected')}</div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{path.split('/').pop()}</div>
          <div className="muted" style={{ fontSize: 12 }}>{path}</div>
        </div>
        <div>
          <a className="link" href={`/api/file?path=${encodeURIComponent(path)}`} download={path.split('/').pop()}>{t('download')}</a>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        {error ? <div className="error">{error}</div> : null}
        {meta ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ width: 160, padding: 6 }} className="muted">{t('full_path')}</td><td style={{ padding: 6 }}>{meta.path || path}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>{t('mime')}</td><td style={{ padding: 6 }}>{meta.mime || 'unknown'}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>{t('size')}</td><td style={{ padding: 6 }}>{meta.size ? formatBytes(meta.size) : 'n/a'}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>{t('mode')}</td><td style={{ padding: 6 }}>{meta.mode || 'n/a'}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>{t('last_modified')}</td><td style={{ padding: 6 }}>{meta.modTime ? new Date(meta.modTime).toLocaleString() : 'n/a'}</td></tr>
              <tr><td className="muted" style={{ padding: 6 }}>{t('is_dir')}</td><td style={{ padding: 6 }}>{meta.isDir ? t('yes') : t('no')}</td></tr>
            </tbody>
          </table>
        ) : (
          <div className="muted">{t('loading_metadata')}</div>
        )}
      </div>
    </div>
  )
}
