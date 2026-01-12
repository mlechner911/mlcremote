import React from 'react'

export interface DecideOpts {
    path?: string | null
    meta?: any | null
    probe?: { mime?: string | null; isText?: boolean; ext?: string } | null
}

export interface ViewProps {
    path: string
    content?: string
    setContent?: (v: string) => void
    origContent?: string
    // For specialized views
    ext?: string
    alias?: string
    textareaId?: string
    onDimensions?: (w: number, h: number) => void
    readOnly?: boolean
}

export interface FileHandler {
    name: string
    priority: number
    matches(opts: DecideOpts): boolean
    view: React.ComponentType<ViewProps>
    // If true, the standard generic "save" button in Editor.tsx is enabled.
    // If false, the view takes care of saving itself or is read-only.
    isEditable: boolean
}
