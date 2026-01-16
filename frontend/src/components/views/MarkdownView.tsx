import React, { Suspense } from 'react'
import { ViewProps, FileHandler, DecideOpts } from '../../handlers/types'

const MarkdownContent = React.lazy(() => import('./MarkdownContent'))

/**
 * A wrapper view for Markdown files that handles lazy loading of the renderer.
 */
export default function MarkdownView(props: ViewProps) {
    return (
        <Suspense fallback={<div className="muted">Loading preview...</div>}>
            <MarkdownContent {...props} />
        </Suspense>
    )
}

export const MarkdownHandler: FileHandler = {
    name: 'Markdown',
    priority: 60,
    matches: (opts: DecideOpts) => {
        return opts.intent === 'view' && !!(opts.path && opts.path.toLowerCase().endsWith('.md'))
    },
    view: MarkdownView,
    isEditable: false
}
