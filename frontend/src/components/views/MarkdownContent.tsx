import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import '../../markdown.css'

import { ViewProps } from '../../handlers/types'

/**
 * The actual renderer component for Markdown content, lazy-loaded by MarkdownView.
 */
export default function MarkdownPreview({ content }: ViewProps) {
    return (
        <div className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    )
}
