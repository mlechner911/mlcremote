import React from 'react'
import Prism from 'prismjs'
import { langForExt, aliasForExt } from '../grammar'
// Prism language components and theme — keep these imports local to TextView
// to avoid loading them for non-text previews.
// @ts-ignore: allow side-effect CSS import without type declarations
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-markup-templating'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-toml'
import 'prismjs/components/prism-java'
// ini
import 'prismjs/components/prism-ini'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-xml-doc'
import 'prismjs/components/prism-sass'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-sql'
// jsx
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'

// editor styles
import '../editor.css'

type Props = {
    content: string
    setContent: (s: string) => void
    origContent: string
    ext: string
    alias?: string
    textareaId: string
}

function escapeHtml(unsafe: string) {
    return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}


function safeHighlight(text: string, ext: string) {
    try {
        const lang = langForExt(ext)
        const alias = aliasForExt(ext)
        if (!lang) return escapeHtml(text)
        return Prism.highlight(text, lang, alias)
    } catch (e) {
        console.warn('Prism highlight failed', e)
        return escapeHtml(text)
    }
}

export default function TextView({ content, setContent, origContent, ext, alias, textareaId }: Props) {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
    const preRef = React.useRef<HTMLElement | null>(null)

    React.useEffect(() => {
        const usedAlias = alias || aliasForExt(ext)
        if (preRef.current) preRef.current.setAttribute('data-grammar', usedAlias)
        if (textareaRef.current) textareaRef.current.setAttribute('data-grammar', usedAlias)
        try {
            const code = preRef.current?.querySelector('code')
            if (code) Prism.highlightElement(code)
        } catch (e) {
            // ignore
        }
    }, [alias, content, ext])

    React.useEffect(() => {
        if (textareaRef.current && preRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop
            preRef.current.scrollLeft = textareaRef.current.scrollLeft
        }
    }, [content])

    return (
        <div className="editor-edit-area">
            <pre aria-hidden className={`highlight-wrap language-${(alias || aliasForExt(ext))}`} data-grammar={(alias || aliasForExt(ext))} ref={el => { preRef.current = el }}>
                <code className={`language-${(alias || aliasForExt(ext))}`} dangerouslySetInnerHTML={{ __html: safeHighlight(content || '', ext) }} />
            </pre>
            <textarea
                ref={textareaRef}
                className="textarea"
                wrap="off"
                value={content}
                name={textareaId || 'editor'}
                id={textareaId}
                data-grammar={alias}
                onChange={(e) => setContent(e.target.value)}
                onScroll={() => {
                    if (textareaRef.current && preRef.current) {
                        preRef.current.scrollTop = textareaRef.current.scrollTop
                        preRef.current.scrollLeft = textareaRef.current.scrollLeft
                    }
                }}
                placeholder="Open or create a file to edit"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
            />
        </div>
    )
}
