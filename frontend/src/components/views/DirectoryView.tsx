import React, { useEffect, useState } from 'react'
import { listTree, DirEntry } from '../../api'
import { Icon, iconForExtension } from '../../generated/icons'
import { getIcon, getIconForDir } from '../../generated/icon-helpers'
import { useTranslation } from 'react-i18next'
import FileDetailsView from './FileDetailsView'
import { extFromPath } from '../../utils/filetypes'

interface DirectoryViewProps {
    path: string
    onContextMenu?: (e: React.MouseEvent, entry: DirEntry) => void
}

type SortField = 'name' | 'size' | 'modTime' | 'mode'
type SortOrder = 'asc' | 'desc'

export default function DirectoryView({ path, onContextMenu }: DirectoryViewProps) {
    const { t } = useTranslation()
    const [entries, setEntries] = useState<DirEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

    useEffect(() => {
        loadDirectory()
    }, [path])

    const loadDirectory = async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await listTree(path)
            console.log('[DirectoryView] API returned:', result.entries?.length || 0, 'entries')
            setEntries(result.entries || [])
            console.log('[DirectoryView] State updated with entries')
        } catch (e: any) {
            console.error('Failed to load directory:', e)
            setError(e.message || 'Failed to load directory')
        } finally {
            setLoading(false)
            console.log('[DirectoryView] Loading complete, loading=false')
        }
    }

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const sortedEntries = React.useMemo(() => {
        const sorted = [...entries].sort((a, b) => {
            let aVal: any, bVal: any

            switch (sortField) {
                case 'name':
                    aVal = a.name.toLowerCase()
                    bVal = b.name.toLowerCase()
                    break
                case 'size':
                    aVal = a.size || 0
                    bVal = b.size || 0
                    break
                case 'modTime':
                    aVal = new Date(a.modTime || 0).getTime()
                    bVal = new Date(b.modTime || 0).getTime()
                    break
                case 'mode':
                    aVal = a.mode || ''
                    bVal = b.mode || ''
                    break
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
            return 0
        })

        // Directories first, then files
        return sorted.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1
            if (!a.isDir && b.isDir) return 1
            return 0
        })
    }, [entries, sortField, sortOrder])

    const formatSize = (bytes?: number) => {
        if (!bytes) return '-'
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }

    const formatDate = (date?: string) => {
        if (!date) return '-'
        const d = new Date(date)
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
    }

    const getFileIcon = (entry: DirEntry): string => {
        if (entry.isDir) return getIconForDir()

        // Use the generated helper that maps extensions from icons.yml
        const ext = extFromPath(entry.name)
        return iconForExtension(ext) || 'text'  // Default to text icon if no match
    }

    // Fallback to old Details view if there's an error or it's a symlink
    if (error) {
        return <FileDetailsView path={path} />
    }

    if (loading) {
        return (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div>{t('loading', 'Loading...')}</div>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="folder" size={20} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{path.split('/').pop() || '/'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entries.length} {t('items', 'items')}</div>
                </div>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <tr>
                            <th style={{ padding: '8px 12px', textAlign: 'left', width: 40 }}></th>
                            <th
                                style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('name')}
                            >
                                {t('name', 'Name')} {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                style={{ padding: '8px 12px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', width: 100 }}
                                onClick={() => handleSort('size')}
                            >
                                {t('size', 'Size')} {sortField === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: 120 }}
                                onClick={() => handleSort('mode')}
                            >
                                {t('permissions', 'Permissions')} {sortField === 'mode' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: 180 }}
                                onClick={() => handleSort('modTime')}
                            >
                                {t('last_modified', 'Modified')} {sortField === 'modTime' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEntries.map((entry, idx) => (
                            <tr
                                key={entry.path}
                                style={{
                                    background: idx % 2 === 0 ? 'transparent' : 'var(--bg-hover)',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--bg-hover)'}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    if (onContextMenu) {
                                        onContextMenu(e, entry)
                                    }
                                }}
                            >
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                    <Icon name={getFileIcon(entry)} size={16} />
                                </td>
                                <td style={{ padding: '8px 12px', fontWeight: entry.isDir ? 600 : 400 }}>
                                    {entry.name}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                    {entry.isDir ? '-' : formatSize(entry.size)}
                                </td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                                    {entry.mode || '-'}
                                </td>
                                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                    {formatDate(entry.modTime)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {entries.length === 0 && (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 10 }}>📁</div>
                        <div>{t('empty_directory', 'Empty directory')}</div>
                    </div>
                )}
            </div>
        </div>
    )
}
