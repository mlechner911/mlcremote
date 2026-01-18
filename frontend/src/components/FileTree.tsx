import React from 'react'
import { DirEntry, listTree } from '../api'
import { Icon, iconForExtension, iconForMimeOrFilename } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import { useTranslation } from 'react-i18next'

type FileTreeProps = {
    selectedPath?: string
    onSelect: (path: string, isDir: boolean) => void
    root?: string
    showHidden?: boolean
    onContextMenu?: (entry: DirEntry, x: number, y: number) => void
    reloadTrigger?: number
}



// Wrapper to handle state storage for cache lookups from the main tree
// But wait, the recursion needs access to the global cache state to render children.
// The simplest way strictly for React is to have the parent pass the cache, or have the item fetch its own state.
// Fetching its own state allows true lazy loading at the node level.

const FileTreeItem = ({ entry, depth, onToggle, onSelect, onOpen, selectedPath, showHidden, onContextMenu, refreshSignal }: {
    entry: DirEntry
    depth: number
    onToggle: (p: string) => void
    onSelect: (p: string, d: boolean) => void
    onOpen?: (p: string) => void
    selectedPath?: string
    showHidden?: boolean
    onContextMenu?: (entry: DirEntry, x: number, y: number) => void
    refreshSignal?: { path: string, ts: number }
}) => {
    const [children, setChildren] = React.useState<DirEntry[] | null>(null)
    const [expanded, setExpanded] = React.useState(false)
    const [loading, setLoading] = React.useState(false)

    // Clear children cache when showHidden changes so we reload
    React.useEffect(() => {
        if (expanded) {
            setChildren(null) // invalidate
            loadChildren()
        }
    }, [showHidden])

    React.useEffect(() => {
        if (refreshSignal && (refreshSignal.path === entry.path) && expanded) {
            loadChildren()
        }
    }, [refreshSignal])

    // Auto-expand if selected path is a descendant
    React.useEffect(() => {
        if (selectedPath && entry.isDir) {
            // Handle root specially or ensure path format consistency
            const myPath = entry.path === '/' ? '' : entry.path
            const checkPath = selectedPath
            if (checkPath.startsWith(myPath + '/') && !expanded) {
                setExpanded(true)
                if (!children) loadChildren()
            }
        }
    }, [selectedPath, entry.path, expanded, children])


    const loadChildren = async () => {
        setLoading(true)
        try {
            const { entries: list } = await listTree(entry.path, { showHidden })

            // Filter out system folders
            const filteredList = list.filter(e => e.name !== '$RECYCLE.BIN' && e.name !== 'System Volume Information')

            // Sort: Directories first, then files
            filteredList.sort((a, b) => {
                if (a.isDir === b.isDir) return a.name.localeCompare(b.name)
                return a.isDir ? -1 : 1
            })
            setChildren(filteredList)
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    const handleToggle = async (path: string) => {
        if (!expanded) {
            setExpanded(true)
            if (!children) {
                loadChildren()
            }
        } else {
            setExpanded(false)
        }
    }

    const isSelected = selectedPath === entry.path

    return (
        <div className="tree-item-container">
            <div
                className={`tree-node ${isSelected ? 'selected' : ''}`}
                style={{ paddingLeft: depth * 12 + 8 }}
                onClick={(e) => {
                    e.stopPropagation()
                    onSelect(entry.path, entry.isDir)
                    if (entry.isDir) handleToggle(entry.path)
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (!entry.isDir && onOpen) onOpen(entry.path)
                }}
                onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onContextMenu?.(entry, e.clientX, e.clientY)
                }}
            >
                <div className="tree-arrow">
                    {entry.isDir && <div className={expanded ? 'rotate-90' : ''}><Icon name={getIcon('chevron-right')} size={14} /></div>}
                </div>
                <div className="tree-icon">
                    <Icon name={entry.isDir ? getIcon('folder') : (iconForMimeOrFilename(undefined, entry.name) || iconForExtension(entry.name.split('.').pop() || '') || getIcon('view'))} />
                </div>
                <div className="tree-label">{entry.name}</div>
            </div>
            {expanded && (
                <div>
                    {loading && <div style={{ paddingLeft: (depth + 1) * 12 + 8, fontStyle: 'italic', opacity: 0.5 }}>Loading...</div>}
                    {children && children.map(c => (
                        <FileTreeItem
                            key={c.path}
                            entry={c}
                            depth={depth + 1}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            onOpen={onOpen}
                            selectedPath={selectedPath}
                            showHidden={showHidden}
                            onContextMenu={onContextMenu}
                            refreshSignal={refreshSignal}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default function FileTree({ selectedPath, onSelect, onOpen, root = '/', showHidden, onContextMenu, refreshSignal }: { selectedPath?: string, onSelect: (p: string, isDir: boolean) => void, onOpen?: (p: string) => void, root?: string, showHidden?: boolean, onContextMenu?: (entry: DirEntry, x: number, y: number) => void, refreshSignal?: { path: string, ts: number } }) {
    const { t } = useTranslation()
    const [entries, setEntries] = React.useState<DirEntry[]>([])
    const [loading, setLoading] = React.useState(false)

    const fetchRoot = () => {
        setLoading(true)
        listTree(root, { showHidden })
            .then(({ entries: list }) => {
                // Filter out system folders
                list = list.filter(e => e.name !== '$RECYCLE.BIN' && e.name !== 'System Volume Information')

                list.sort((a, b) => {
                    if (a.isDir === b.isDir) return a.name.localeCompare(b.name)
                    return a.isDir ? -1 : 1
                })
                setEntries(list)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }

    React.useEffect(() => {
        fetchRoot()
    }, [root, showHidden])

    React.useEffect(() => {
        // Root refresh
        if (refreshSignal && refreshSignal.path === root) {
            fetchRoot()
        }
    }, [refreshSignal])

    if (loading) return <div className="muted" style={{ padding: 10 }}>{t('loading')}...</div>

    return (
        <div className="file-tree" style={{ paddingBottom: 20 }}>
            {entries.map(e => (
                <FileTreeItem
                    key={e.path}
                    entry={e}
                    depth={0}
                    onToggle={() => { }}
                    onSelect={onSelect}
                    onOpen={onOpen}
                    selectedPath={selectedPath}
                    showHidden={showHidden}
                    onContextMenu={onContextMenu}
                    refreshSignal={refreshSignal}
                />
            ))}
        </div>
    )
}
