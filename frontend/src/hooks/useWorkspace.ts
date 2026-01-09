import React from 'react'
import { statPath } from '../api'
import type { LayoutNode, PaneId, PaneState } from '../types/layout'

export function useWorkspace(maxTabs = 8) {
    // -- Layout State --
    const [panes, setPanes] = React.useState<Record<PaneId, PaneState>>({
        'root': { id: 'root', files: [], activeFile: null }
    })
    const [layout, setLayout] = React.useState<LayoutNode>({ type: 'leaf', paneId: 'root' })
    const [activePaneId, setActivePaneId] = React.useState<PaneId>('root')

    const [evictedTabs, setEvictedTabs] = React.useState<string[]>([])
    const [fileMetas, setFileMetas] = React.useState<Record<string, any>>({})
    const [activeFile, setActiveFileState] = React.useState<string>('') // Derived-ish, but syncs with pane logic?

    // Sync activeFile helper
    React.useEffect(() => {
        const p = panes[activePaneId]
        setActiveFileState(p?.activeFile || '')
    }, [panes, activePaneId])

    // Helper to get open files of active pane
    const openFiles = panes[activePaneId]?.files || []

    const setOpenFiles = (fn: (files: string[]) => string[]) => {
        setPanes(prev => {
            const p = prev[activePaneId]
            if (!p) return prev
            const newFiles = fn(p.files)
            return { ...prev, [activePaneId]: { ...p, files: newFiles } }
        })
    }

    const setActiveFile = (file: string) => {
        setPanes(prev => {
            const p = prev[activePaneId]
            if (!p) return prev
            return { ...prev, [activePaneId]: { ...p, activeFile: file } }
        })
    }

    function openFile(path: string) {
        setOpenFiles(of => {
            if (of.includes(path)) return of
            const next = [...of, path]
            if (next.length <= maxTabs) return next
            // close the oldest opened (first) tab and record it in evictedTabs
            const evicted = next[0]
            try {
                setEvictedTabs(prev => {
                    if (prev.includes(evicted)) return prev
                    return [...prev, evicted]
                })
            } catch (_) { }
            return next.slice(1)
        })
        setActiveFile(path)
        // fetch and cache metadata
        statPath(path).then(m => {
            setFileMetas(fm => ({ ...fm, [path]: m }))
        }).catch(() => {
            // ignore stat errors
        })
    }

    const splitPane = (direction: 'horizontal' | 'vertical') => {
        const newPaneId = `pane-${Date.now()}`
        const currentP = panes[activePaneId]
        const currentFile = currentP?.activeFile

        setPanes(prev => ({
            ...prev,
            [newPaneId]: {
                id: newPaneId,
                files: currentFile ? [currentFile] : [],
                activeFile: currentFile || null
            }
        }))

        setLayout(prev => {
            const replace = (node: LayoutNode): LayoutNode => {
                if (node.type === 'leaf') {
                    if (node.paneId === activePaneId) {
                        return {
                            type: 'branch',
                            direction,
                            size: 50,
                            children: [
                                node,
                                { type: 'leaf', paneId: newPaneId }
                            ]
                        }
                    }
                    return node
                }
                return { ...node, children: [replace(node.children[0]), replace(node.children[1])] } as LayoutNode
            }
            return replace(prev)
        })
        setActivePaneId(newPaneId)
    }

    const closePane = (id: PaneId) => {
        if (id === 'root' && layout.type === 'leaf') return

        setLayout(prev => {
            const prune = (node: LayoutNode): LayoutNode | null => {
                if (node.type === 'leaf') {
                    return node.paneId === id ? null : node
                }
                const c0 = prune(node.children[0])
                const c1 = prune(node.children[1])
                if (!c0 && !c1) return null
                if (!c0) return c1
                if (!c1) return c0
                return { ...node, children: [c0, c1] } as LayoutNode
            }
            const res = prune(prev)
            return res || { type: 'leaf', paneId: 'root' }
        })

        setPanes(prev => {
            const next = { ...prev }
            delete next[id]
            return next
        })

        if (activePaneId === id) setActivePaneId('root')
    }

    const handleLayoutResize = (node: LayoutNode, newSize: number) => {
        setLayout(prev => {
            const update = (n: LayoutNode): LayoutNode => {
                if (n === node) return { ...n, size: newSize } as any
                if (n.type === 'branch') {
                    return { ...n, children: [update(n.children[0]), update(n.children[1])] } as any
                }
                return n
            }
            return update(prev)
        })
    }

    // Persistence Logic
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const pid = params.get('profileId')
        if (pid) {
            const state = { panes, layout, activePaneId }
            localStorage.setItem(`workspace_state_${pid}`, JSON.stringify(state))
        }
    }, [panes, layout, activePaneId])

    // Restoration Logic
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const pid = params.get('profileId')
        if (pid) {
            try {
                const saved = localStorage.getItem(`workspace_state_${pid}`)
                if (saved) {
                    const state = JSON.parse(saved)
                    if (state.panes) setPanes(state.panes)
                    if (state.layout) setLayout(state.layout)
                    if (state.activePaneId) setActivePaneId(state.activePaneId)
                }
            } catch (e) {
                console.error("Failed to restore workspace state", e)
            }
        }
    }, [])

    return {
        panes, setPanes,
        layout, setLayout,
        activePaneId, setActivePaneId,
        openFiles, setOpenFiles,
        activeFile, setActiveFile,
        openFile,
        splitPane, closePane, handleLayoutResize,
        fileMetas, setFileMetas,
        evictedTabs
    }
}
