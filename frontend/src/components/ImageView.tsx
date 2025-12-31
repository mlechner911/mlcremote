import React from 'react'
import { getToken } from '../auth'

export default function ImageView({ path }: { path: string }) {
  const token = getToken()
  const src = `/api/file?path=${encodeURIComponent(path)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <img src={src} alt={path.split('/').pop()} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} />
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <a className="link" href={src} download={path.split('/').pop()}>Download</a>
      </div>
    </div>
  )
}
