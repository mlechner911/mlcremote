
export type PaneId = string

export interface PaneState {
    id: PaneId
    files: string[]
    activeFile: string | null
}

export type LayoutNode =
    | { type: 'leaf'; paneId: PaneId }
    | { type: 'branch'; direction: 'horizontal' | 'vertical'; size: number; children: [LayoutNode, LayoutNode] }

export interface LayoutState {
    root: LayoutNode
    panes: Record<PaneId, PaneState>
    activePaneId: PaneId
}
