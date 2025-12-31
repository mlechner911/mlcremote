import React from 'react'
import { getToken } from '../auth'

export default function ImageView({ path }: { path: string }) {
  const token = getToken()
  const src = `/api/file?path=${encodeURIComponent(path)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null)
  const imgRef = React.useRef<HTMLImageElement | null>(null)

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
        <img ref={imgRef} src={src} alt={path.split('/').pop()} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} onLoad={() => {
          try {
            const i = imgRef.current
            if (i && i.naturalWidth && i.naturalHeight) setNatural({ w: i.naturalWidth, h: i.naturalHeight })
          } catch (_) {}
        }} />
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <a className="link" href={src} download={path.split('/').pop()}>Download</a>
        {natural ? (
          <span className="muted" style={{ marginLeft: 8 }}>{natural.w} × {natural.h}</span>
        ) : null}
      </div>
    </div>
  )
}
