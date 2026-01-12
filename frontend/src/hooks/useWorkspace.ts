import React from 'react'
import { statPath } from '../api'
import type { LayoutNode, PaneId, PaneState, Tab, ViewType } from '../types/layout'

export function useWorkspace(maxTabs = 8) {
    // -- Layout State --
    const [panes, setPanes] = React.useState<Record<PaneId, PaneState>>({
        'root': { tabs: [], activeTabId: '' }
    })
    const [layout, setLayout] = React.useState<LayoutNode>({ type: 'leaf', paneId: 'root' })
    const [activePaneId, setActivePaneId] = React.useState<PaneId>('root')

    const [fileMetas, setFileMetas] = React.useState<Record<string, any>>({})
    const [activeTabId, setActiveTabIdState] = React.useState<string>('')

    // Sync activeTabId helper
    React.useEffect(() => {
        const p = panes[activePaneId]
        setActiveTabIdState(p?.activeTabId || '')
    }, [panes, activePaneId])

    // Helper to get open tabs of active pane
    const openTabs = panes[activePaneId]?.tabs || []

    const setOpenTabs = (fn: (tabs: Tab[]) => Tab[]) => {
        setPanes(prev => {
            const p = prev[activePaneId]
            if (!p) return prev
            const newTabs = fn(p.tabs)
            return { ...prev, [activePaneId]: { ...p, tabs: newTabs } }
        })
    }

    const setActiveTab = (id: string) => {
        setPanes(prev => {
            const p = prev[activePaneId]
            if (!p) return prev
            return { ...prev, [activePaneId]: { ...p, activeTabId: id } }
        })
    }

    function createTab(path: string, type?: ViewType, label?: string): Tab {
        // Logic to determine type if not provided
        let actualType: ViewType = type || 'editor'
        let actualLabel = label || path.split('/').pop() || path

        // Enforce specific types/labels for known special paths
        if (path === 'metadata') {
            actualType = 'custom'
            actualLabel = 'Details'
        } else if (path === 'binary') {
            actualType = 'binary'
            actualLabel = 'Binary View'
        } else if (path === 'trash') {
            actualType = 'custom'
            actualLabel = 'Trash'
        }

        if (!type) {
            if (path.startsWith('shell-')) {
                actualType = 'terminal'
                actualLabel = 'Terminal'
            } else if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')) {
                // heuristic
            }
        }

        return {
            id: path, // For now, path is ID for most things. Terminals have unique paths anyway.
            path,
            label: actualLabel,
            type: actualType,
            icon: actualType === 'terminal' ? 'terminal' : undefined
        }
    }

    function openFile(path: string, type?: ViewType, label?: string) {
        setOpenTabs(currentTabs => {
            if (currentTabs.find(t => t.id === path)) return currentTabs
            return [...currentTabs, createTab(path, type, label)]
        })
        setActiveTab(path)

        // fetch and cache metadata only for real files
        if (!path.startsWith('shell-') && path !== 'metadata' && path !== 'binary' && path !== 'trash') {
            statPath(path).then(m => {
                setFileMetas(fm => ({ ...fm, [path]: m }))
            }).catch(() => {
                // ignore stat errors
            })
        }
    }

    const splitPane = (direction: 'horizontal' | 'vertical', targetTabId?: string) => {
        const newPaneId = `pane-${Date.now()}`
        const currentP = panes[activePaneId]

        let targetTab: Tab | undefined
        // If the context menu passed a specific tab ID (e.g. right-clicking an inactive tab), use that.
        if (targetTabId) {
            targetTab = currentP?.tabs.find(t => t.id === targetTabId)
        }
        // Fallback: use currently active tab if no specific target or target not found
        if (!targetTab) {
            const currentTabId = currentP?.activeTabId
            targetTab = currentP?.tabs.find(t => t.id === currentTabId)
        }

        setPanes(prev => ({
            ...prev,
            [newPaneId]: {
                // Initialize new pane with the cloned tab
                tabs: targetTab ? [targetTab] : [],
                activeTabId: targetTab ? targetTab.id : ''
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

                    // Migration Logic: Convert legacy 'files' string[] to 'tabs' Tab[]
                    if (state.panes) {
                        const migratedPanes: Record<PaneId, PaneState> = {}
                        for (const [pid, pPlain] of Object.entries(state.panes)) {
                            const p = pPlain as any
                            if (p.files && Array.isArray(p.files)) {
                                // Legacy path: convert strings to Tabs
                                const tabs = p.files.map((f: string) => createTab(f))
                                let active = p.activeFile || ''
                                // Verify active exists, else default to last
                                if (!tabs.find((t: Tab) => t.id === active)) {
                                    active = tabs.length > 0 ? tabs[tabs.length - 1].id : ''
                                }
                                migratedPanes[pid] = {
                                    tabs,
                                    activeTabId: active
                                }
                            } else if (p.tabs && Array.isArray(p.tabs)) {
                                // Modern path: trust but verify
                                // Re-run createTab logic to ensure types/icons are up to date if they were missing or stale?
                                // No, respect persisted state if valid Tab object.
                                // Just ensure dirty flag is reset.
                                const tabs = p.tabs.map((t: any) => ({
                                    ...t,
                                    dirty: false // never persist dirty state
                                }))
                                migratedPanes[pid] = { ...p, tabs }
                            } else {
                                migratedPanes[pid] = { tabs: [], activeTabId: '' }
                            }
                        }
                        setPanes(migratedPanes)
                    }

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
        openTabs, setOpenTabs, // Renamed from openFiles
        activeTabId, setActiveTab, // Renamed from activeFile, setActiveFile
        openFile,
        splitPane, closePane, handleLayoutResize,
        fileMetas, setFileMetas
    }
}
