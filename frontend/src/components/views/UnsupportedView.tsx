import React from 'react'
import { ViewProps, FileHandler } from '../../handlers/types'

/**
 * Fallback view for file types that cannot be displayed.
 */
export default function UnsupportedView({ path }: ViewProps) {
    return (
        <div style={{ padding: 12 }} className="muted">
            Unsupported file type: {path}
        </div>
    )
}

export const UnsupportedHandler: FileHandler = {
    name: 'Unsupported',
    priority: 0,
    matches: () => true, // Match everything as last resort
    view: UnsupportedView,
    isEditable: false
}
