import React from 'react'
import { getToken } from '../../utils/auth'
import { makeUrl } from '../../api'
import { useTranslation } from 'react-i18next'

import { ViewProps, FileHandler, DecideOpts } from '../../handlers/types'

/**
 * Renders an image file with basic dimensions display.
 */
export default function ImageView({ path, onDimensions }: ViewProps) {
  const { t } = useTranslation()
  const token = getToken()
  const src = makeUrl(`/api/file?path=${encodeURIComponent(path)}${token ? `&token=${encodeURIComponent(token)}` : ''}`)
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null)
  const imgRef = React.useRef<HTMLImageElement | null>(null)

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
        <img ref={imgRef} src={src} alt={path.split(/[/\\]/).pop()} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} onLoad={() => {
          try {
            const i = imgRef.current
            if (i && i.naturalWidth && i.naturalHeight) {
              setNatural({ w: i.naturalWidth, h: i.naturalHeight })
              try { onDimensions && onDimensions(i.naturalWidth, i.naturalHeight) } catch (_) { }
            }
          } catch (_) { }
        }} />
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <a className="link" href={src} download={path.split(/[/\\]/).pop()}>{t('download')}</a>
        {natural ? (
          <span className="muted" style={{ marginLeft: 8 }}>{natural.w} × {natural.h}</span>
        ) : null}
      </div>
    </div>
  )
}

export const ImageHandler: FileHandler = {
  name: 'Image',
  priority: 70,
  matches: (opts: DecideOpts) => {
    if (opts.probe && opts.probe.mime && opts.probe.mime.startsWith('image/')) return true
    if (opts.path) {
      const lower = opts.path.toLowerCase()
      return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.svg') || lower.endsWith('.webp')
    }
    return false
  },
  view: ImageView,
  isEditable: false
}
