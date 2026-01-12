import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import '../markdown.css'

export default function MarkdownPreview({ content }: { content: string }) {
    return (
        <div className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    )
}
