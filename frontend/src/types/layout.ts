
export type PaneId = string

export type ViewType = 'editor' | 'preview' | 'terminal' | 'binary' | 'diff'
    | 'custom' | 'logs' | 'directory' | 'metadata' | 'trash';
export type Intent = 'view' | 'edit' | 'metadata' | 'preview';

export interface Tab {
    id: string;          // Unique ID (usually path, but unique for terminals)
    path: string;        // File path or logical identifier
    label: string;       // Display name
    type: ViewType;
    icon?: string;       // Optional icon override
    iconColor?: string;  // Optional icon color override
    dirty?: boolean;     // Unsaved changes flag
    metadata?: any;      // Extra data (e.g. scroll position, cursor)
    intent?: Intent;
    /** If true, only one instance of this view type can be open at a time */
    singleton?: boolean;
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
