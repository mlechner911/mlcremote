import React from 'react'
import { ViewProps, FileHandler, DecideOpts } from '../../handlers/types'

/**
 * Displays the contents of a directory as a simple list.
 */
export default function DirectoryView({ path, origContent }: ViewProps) {
    return (
        <div style={{ padding: 12 }}>
            <div style={{ fontWeight: 600 }}>Directory: {path}</div>
            <div className="muted" style={{ marginTop: 6 }}>{origContent ? origContent.split('\n').length : '0'} entries</div>
            <pre style={{ marginTop: 8, maxHeight: 240, overflow: 'auto', padding: 8, background: 'var(--panel)' }}>{origContent}</pre>
        </div>
    )
}

export const DirectoryHandler: FileHandler = {
    name: 'Directory',
    priority: 90,
    matches: (opts: DecideOpts) => !!(opts.meta && opts.meta.isDir),
    view: DirectoryView,
    isEditable: false
}
