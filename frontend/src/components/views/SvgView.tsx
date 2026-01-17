
import React from 'react'
import { ViewProps, FileHandler, DecideOpts } from '../../handlers/types'
import { authedFetch } from '../../utils/auth'
import { useTranslation } from 'react-i18next'

export function SvgPreview({ path, onDimensions }: ViewProps) {
    const { t } = useTranslation()
    const [src, setSrc] = React.useState<string>('')
    const [dims, setDims] = React.useState<{ w: number, h: number } | null>(null)
    const [error, setError] = React.useState<string>('')

    React.useEffect(() => {
        let active = true
        active && setSrc('')
        active && setError('')

        const load = async () => {
            try {
                const q = `?path=${encodeURIComponent(path)}`
                const r = await authedFetch(`/api/file${q}`)
                if (!r.ok) throw new Error('Failed to load SVG')
                const blob = await r.blob()
                // Force the type to image/svg+xml in case backend sent text/plain
                const svgBlob = new Blob([blob], { type: 'image/svg+xml' })
                if (active) {
                    setSrc(URL.createObjectURL(svgBlob))
                }
            } catch (e) {
                if (active) setError('Failed to load SVG preview')
            }
        }
        load()
        return () => { active = false }
    }, [path])

    return (
        <div style={{ marginTop: 8 }}>
            {error ? (
                <div className="muted">{error}</div>
            ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                    {src && (
                        <img
                            src={src}
                            alt="SVG Preview"
                            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', background: '#fff' }} // White bg for SVG often needed
                            onLoad={(e) => {
                                const i = e.currentTarget
                                if (i.naturalWidth && i.naturalHeight) {
                                    setDims({ w: i.naturalWidth, h: i.naturalHeight })
                                    onDimensions && onDimensions(i.naturalWidth, i.naturalHeight)
                                }
                            }}
                        />
                    )}
                </div>
            )}
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                {src && <a className="link" href={src} download={path.split(/[/\\]/).pop()}>{t('download')}</a>}
                {dims ? (
                    <span className="muted" style={{ marginLeft: 8 }}>{dims.w} × {dims.h}</span>
                ) : null}
            </div>
        </div>
    )
}

/**
 * Handler for SVG files.
 * Uses custom SvgPreview for "view" intent (Preview), but allows editing by falling through to TextHandler when intent is not "view".
 */
export const SvgHandler: FileHandler = {
    name: 'SVG',
    priority: 75, // Higher than ImageHandler (70)
    matches: (opts: DecideOpts) => {
        // Only match if the intent is 'view' (Preview mode)
        // If intent is 'edit' (default), we want to fall through to TextHandler to show code.
        return opts.intent === 'view' && !!(opts.path && opts.path.toLowerCase().endsWith('.svg'))
    },
    view: SvgPreview,
    isEditable: false // In preview mode, it's not editable.
}
