import React from 'react'
import { ArchiveEntry, listArchive } from '../api'
import { formatBytes } from '../utils/bytes'
import { useTranslation } from 'react-i18next'
import { Icon, iconForExtension } from '../generated/icons'
import { getIconForDir } from '../generated/icon-helpers'
import { ViewProps } from '../handlers/types'
import { extFromPath } from '../filetypes'

export default function ArchiveViewer({ path }: ViewProps) {
    const { t } = useTranslation()
    const [entries, setEntries] = React.useState<ArchiveEntry[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState('')

    React.useEffect(() => {
        if (!path) return
        setLoading(true)
        setEntries([])
        setError('')
        listArchive(path)
            .then(setEntries)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [path])

    if (loading) return <div className="muted" style={{ padding: 20 }}>{t('loading', 'Loading...')}</div>
    if (error) return <div className="muted" style={{ padding: 20, color: 'var(--danger)' }}>{t('error', 'Error')}: {error}</div>

    return (
        <div style={{ padding: 10, height: '100%', overflow: 'auto' }}>
            <div className="muted" style={{ marginBottom: 10, fontSize: 12 }}>
                {t('archive_content_preview', 'Archive Content Preview (Read Only)')} - {entries.length} {t('items', 'items')}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                        <th style={{ padding: 8 }}>{t('name', 'Name')}</th>
                        <th style={{ padding: 8, width: 100 }}>{t('size', 'Size')}</th>
                        <th style={{ padding: 8, width: 180 }}>{t('modified', 'Modified')}</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((e, i) => {
                        const ext = extFromPath(e.name)
                        const iconName = e.isDir ? getIconForDir() : (iconForExtension(ext) || 'icon-file')
                        return (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Icon name={iconName} size={14} />
                                    <span style={{ wordBreak: 'break-all' }}>{e.name}</span>
                                </td>
                                <td style={{ padding: 6, opacity: 0.8 }}>{e.isDir ? '-' : formatBytes(e.size)}</td>
                                <td style={{ padding: 6, opacity: 0.8, fontSize: 12 }}>{new Date(e.modTime).toLocaleString()}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
