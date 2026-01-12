
export type PaneId = string

export type ViewType = 'editor' | 'preview' | 'terminal' | 'binary' | 'diff' | 'custom';

export interface Tab {
    id: string;          // Unique ID (usually path, but unique for terminals)
    path: string;        // File path or logical identifier
    label: string;       // Display name
    type: ViewType;
    icon?: string;       // Optional icon override
    dirty?: boolean;     // Unsaved changes flag
    metadata?: any;      // Extra data (e.g. scroll position, cursor)
}

export type PaneState = {
    tabs: Tab[];         // Replaces 'files'
    activeTabId: string; // Replaces 'activeFile'
}

export type LayoutNode =
    | { type: 'leaf'; paneId: PaneId }
    | {
        type: 'branch';
        direction: 'horizontal' | 'vertical';
        size: number;
        children: [LayoutNode, LayoutNode]
    }

export interface LayoutState {
    root: LayoutNode
    panes: Record<PaneId, PaneState>
    activePaneId: PaneId
}
