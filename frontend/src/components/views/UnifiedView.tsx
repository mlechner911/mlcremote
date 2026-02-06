import React, { useEffect, useState } from 'react'
import { triggerDownload } from '../../utils/download'
import { statPath, readFile } from '../../api'
import { formatBytes } from '../../utils/bytes'
import { useTranslation } from 'react-i18next'
import { ViewProps, FileHandler } from '../../handlers/types'
import { getHandler } from '../../handlers/registry'
import BinaryView, { BinaryHandler } from './BinaryView'
import { Icon, iconForMimeOrFilename, iconForExtension } from '../../generated/icons'
import { getIcon } from '../../generated/icon-helpers'

// Max size to load for text/markdown previews (e.g. 512KB)
const MAX_PREVIEW_SIZE = 512 * 1024

interface UnifiedViewProps extends ViewProps {
    onOpen?: (path: string, type?: any, label?: string, intent?: any) => void
    defaultMode?: 'preview' | 'metadata'
}

/**
 * A unified singleton view that acts as a "Smart Preview".
 * It determines the file type and renders the appropriate viewer
 * (Image, Archive, PDF, Markdown, Text, or generic Binary/Properties).
 */
export default function UnifiedView({ path, onOpen, defaultMode = 'preview' }: UnifiedViewProps) {
    const { t } = useTranslation()
    const [viewMode, setViewMode] = useState<'preview' | 'metadata'>(defaultMode)

    // Reset view mode when path changes, respecting the default preference
    useEffect(() => {
        setViewMode(defaultMode)
    }, [path, defaultMode])

    const [handler, setHandler] = useState<FileHandler | null>(null)
    const [content, setContent] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [meta, setMeta] = useState<any>(null)

    useEffect(() => {
        let mounted = true
        if (!path) {
            setLoading(false)
            return
        }

        const load = async () => {
            setLoading(true)
            setError(null)
            setHandler(null)
            setContent('')
            setMeta(null)

            try {
                // 1. Get stats
                const st = await statPath(path)
                if (!mounted) return
                setMeta(st)

                // 2. Resolve Handler with 'view' intent (Preview mode)
                const h = getHandler({ path, meta: st, intent: 'view' })
                if (!mounted) return
                setHandler(h)

                // 3. If text-based handler (Text or Markdown), fetch content
                if (viewMode === 'preview' && (h.name === 'Text' || h.name === 'Markdown')) {
                    if (st.size > MAX_PREVIEW_SIZE) {
                        setContent('') // Too big to preview
                        // We can show a warning in the UI
                    } else if (st.size === 0) {
                        setContent('')
                    } else {
                        try {
                            const text = await readFile(path)
                            if (mounted) setContent(text)
                        } catch (e) {
                            console.warn('Failed to read content for preview', e)
                            if (mounted) setError(t('failed_read_content'))
                        }
                    }
                }

            } catch (e: any) {
                if (mounted) setError(e.message || 'Failed to analyze file')
            } finally {
                if (mounted) setLoading(false)
            }
        }

        load()
        return () => { mounted = false }
    }, [path, viewMode, t]) // Keep viewMode dependency to re-fetch content if switching to preview


    if (!path) {
        return <div className="muted" style={{ padding: 20 }}>{t('no_file_selected')}</div>
    }

    if (loading) {
        return <div className="muted" style={{ padding: 20 }}>{t('loading_preview')}</div>
    }

    if (error) {
        return <div className="error" style={{ padding: 20 }}>{error}</div>
    }

    // Fallback to BinaryHandler if no handler resolved
    const ActiveHandler = handler || BinaryHandler
    const View = ActiveHandler.view

    const isTextBased = ActiveHandler.name === 'Text' || ActiveHandler.name === 'Markdown'
    const isTooBig = isTextBased && meta && meta.size > MAX_PREVIEW_SIZE
    const canEdit = ActiveHandler.name === 'Text' || ActiveHandler.name === 'Markdown' || ActiveHandler.name === 'SVG'

    // Resolve file icon
    const name = path.split('/').pop() || ''
    const fileIcon = iconForMimeOrFilename(undefined, name) || iconForExtension(name.split('.').pop() || '') || getIcon('file')

    // Unified Toolbar
    const Toolbar = () => (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-toolbar)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name={fileIcon} />
                <span>{viewMode === 'preview' ? t('preview_mode') : t('properties')}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                {/* Toggle Mode */}
                {viewMode === 'metadata' ? (
                    <button
                        className="btn btn-sm"
                        onClick={() => setViewMode('preview')}
                        title={t('show_preview')}
                    >
                        <span style={{ marginRight: 6 }}><Icon name={getIcon('view')} /></span>
                        {t('preview')}
                    </button>
                ) : (
                    <button
                        className="btn btn-sm"
                        onClick={() => setViewMode('metadata')}
                        title={t('properties')}
                    >
                        <span style={{ marginRight: 6 }}><Icon name={getIcon('info')} /></span>
                        {t('properties')}
                    </button>
                )}

                {/* Edit Button */}
                {canEdit && (
                    <button
                        className="btn btn-sm"
                        onClick={() => onOpen && onOpen(path, 'editor', undefined, 'edit')}
                        title={t('open_in_editor')}
                    >
                        <span style={{ marginRight: 6 }}><Icon name={getIcon('edit')} /></span>
                        {t('edit')}
                    </button>
                )}

                {/* Download Button */}
                <a
                    className="btn btn-sm"
                    href="#"
                    onClick={(e) => { e.preventDefault(); triggerDownload(path) }}
                    title={t('download')}
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                >
                    <span style={{ marginRight: 6 }}><Icon name={getIcon('download')} /></span>
                    {t('download')}
                </a>
            </div>
        </div>
    )

    // Render Metadata View (BinaryView) if in metadata mode
    if (viewMode === 'metadata') {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Toolbar />
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <BinaryView path={path} />
                </div>
            </div>
        )
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Toolbar />

            <div style={{ flex: 1, overflow: 'auto' }}>
                {isTooBig ? (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                        <div className="muted">{t('file_too_large_preview')}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{formatBytes(meta.size)}</div>
                        <button className="btn" style={{ marginTop: 10 }} onClick={() => onOpen && onOpen(path, 'editor')}>
                            {t('open_anyway')}
                        </button>
                    </div>
                ) : (
                    <View path={path} content={content} ext={path.split('.').pop()} />
                )}
            </div>

            {/* Optional: Footer with Metadata Summary if not explicitly generic Binary view (which has its own table) */}
            {ActiveHandler.name !== 'Binary' && ActiveHandler.name !== 'Unsupported' && (
                <div style={{
                    borderTop: '1px solid var(--border-subtle)',
                    padding: '8px 12px',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between'
                }}>
                    <span>{path}</span>
                    <span>{meta ? formatBytes(meta.size) : ''}</span>
                    <span>{ActiveHandler.name}</span>
                </div>
            )}
        </div>
    )
}

