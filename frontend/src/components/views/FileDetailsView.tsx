import React from 'react'
import { statPath, makeUrl } from '../../api'
import { formatBytes } from '../../utils/bytes'
import { useTranslation } from 'react-i18next'
import { Icon, iconForMimeOrFilename, iconForExtension } from '../../generated/icons'
import { getIcon } from '../../generated/icon-helpers'

// FileDetailsView props
interface Props {
    path?: string
}

/**
 * Shows detailed metadata and properties for a specific file or directory.
 */
export default function FileDetailsView({ path }: Props) {
    const { t } = useTranslation()
    const [meta, setMeta] = React.useState<any>(null)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        let mounted = true
            ; (async () => {
                if (!path) { setMeta(null); return }
                try {
                    // fetch metadata
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

    if (!path) return <div style={{ padding: 24, textAlign: 'center' }} className="muted">{t('no_file_selected')}</div>

    return (
        <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                <div style={{ fontSize: 48, opacity: 0.8, color: (meta?.isRestricted || meta?.isReadOnly) ? 'var(--danger)' : 'inherit' }}>
                    <Icon name={meta?.isRestricted ? getIcon('lock') : (meta?.isDir ? getIcon('folder') : (iconForExtension(path.split('.').pop() || '') || 'icon-file'))} size={48} />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ margin: 0, wordBreak: 'break-all', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        {path.split(/[/\\]/).pop()}
                        {meta?.isRestricted && <span className="badge badge-error" style={{ fontSize: 12, verticalAlign: 'middle' }}>{t('restricted', 'Restricted')}</span>}
                        {meta?.isReadOnly && !meta?.isRestricted && <span className="badge badge-error" style={{ fontSize: 12, verticalAlign: 'middle' }}>{t('read_only', 'Read Only')}</span>}
                    </h2>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    {meta && !meta.isDir && (
                        <a className="btn primary" href={makeUrl(`/api/file?path=${encodeURIComponent(path)}`)} download={path.split('/').pop()}>
                            <span style={{ marginRight: 6, display: 'inline-flex' }}><Icon name="icon-download" size={16} /></span>
                            {t('download')}
                        </a>
                    )}
                </div>
            </div>

            <div className="panel" style={{ padding: 16, borderRadius: 8, background: 'var(--bg-subtle)' }}>
                <h3 style={{ marginTop: 0, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>{t('properties', 'Properties')}</h3>
                {error ? <div className="error">{error}</div> : null}
                {meta ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <tbody>
                            <tr>
                                <td style={{ width: 120, padding: '8px 0', color: 'var(--text-muted)' }}>{t('path', 'Path')}</td>
                                <td style={{ padding: '8px 0', wordBreak: 'break-all' }}>{meta.absPath || path}</td>
                            </tr>
                            <tr>
                                <td style={{ width: 120, padding: '8px 0', color: 'var(--text-muted)' }}>{t('type')}</td>
                                <td style={{ padding: '8px 0' }}>{meta.isDir ? t('directory', 'Directory') : (meta.mime || 'unknown')}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>{t('size')}</td>
                                <td style={{ padding: '8px 0' }}>{meta.size ? formatBytes(meta.size) : '0 B'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>{t('mode')}</td>
                                <td style={{ padding: '8px 0' }}><span style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '2px 4px', borderRadius: 4 }}>{meta.mode || 'n/a'}</span></td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>{t('last_modified')}</td>
                                <td style={{ padding: '8px 0' }}>{meta.modTime ? new Date(meta.modTime).toLocaleString() : 'n/a'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>{t('is_dir')}</td>
                                <td style={{ padding: '8px 0' }}>{meta.isDir ? t('yes') : t('no')}</td>
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <div className="muted">{t('loading')}...</div>
                )}
            </div>
        </div>
    )
}
