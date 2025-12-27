import React from 'react'
import { readFile, saveFile, deleteFile } from '../api'
import { isEditable, isProbablyText, extFromPath, probeFileType } from '../filetypes'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-toml'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-bash'

function escapeHtml(unsafe: string) {
  return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function langForExt(ext: string) {
  switch (ext) {
  case 'js': case 'jsx': return Prism.languages.javascript
  case 'ts': case 'tsx': return Prism.languages.typescript
  case 'go': return Prism.languages.go
  case 'php': return Prism.languages.php
  case 'json': return Prism.languages.json
  case 'yaml': case 'yml': return Prism.languages.yaml
  case 'toml': return Prism.languages.toml || Prism.languages.markup
  case 'md': case 'markdown': return Prism.languages.markdown
  case 'c': return Prism.languages.c
  case 'cpp': return Prism.languages.cpp
  case 'sh': case 'bash': return Prism.languages.bash
  default: return Prism.languages.javascript
  }
}

function safeHighlight(text: string, ext: string) {
  try {
    const lang = langForExt(ext)
    if (!lang) return escapeHtml(text)
    return Prism.highlight(text, lang, ext || 'text')
  } catch (e) {
    console.warn('Prism highlight failed', e)
    return escapeHtml(text)
  }
}

type Props = {
  path: string
  onSaved?: () => void
}

export default function Editor({ path, onSaved }: Props) {
  const [content, setContent] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)

  React.useEffect(() => {
    if (!path) return
    setLoading(true)
    setStatus('')
    // Probe backend for actual file type rather than relying on extension
    probeFileType(path).then(pt => {
      if (!pt.isText) {
        setContent('')
        setStatus('Binary or unsupported file type — use Download')
        setLoading(false)
        return
      }
      readFile(path)
        .then(text => setContent(text))
        .catch(() => setStatus('Failed to load'))
        .finally(() => setLoading(false))
    }).catch(() => {
      setStatus('Failed to probe file type')
      setLoading(false)
    })
  }, [path])

  const onSave = async () => {
    if (!path) return
    setStatus('Saving...')
    try {
      await saveFile(path, content)
      setStatus('Saved')
      onSaved && onSaved()
    } catch {
      setStatus('Save failed')
    }
  }

  const onFormat = async () => {
    if (!path) return
    const ext = extFromPath(path)
    setStatus('Formatting...')
    try {
      // dynamic import to keep bundle small
      const mod = await import('../format')
      const formatted = mod.formatByExt(ext, content)
      setContent(formatted)
      setStatus('Formatted')
    } catch (e) {
      setStatus('Format failed')
    }
  }

  const onDelete = async () => {
    if (!path) return
    setStatus('Deleting...')
    try {
      await deleteFile(path)
      setStatus('Deleted')
      setContent('')
    } catch {
      setStatus('Delete failed')
    }
  }

  return (
    <div className="editor">
      <div className="editor-header">
        <strong>Editor</strong>
        <span className="muted">{path || 'Select a file'}</span>
        <div className="actions">
          <button className="btn" onClick={onFormat} disabled={!path}>Format</button>
          <button className="btn" onClick={onSave} disabled={!path}>Save</button>
          <button className="btn btn-danger" onClick={onDelete} disabled={!path}>Delete</button>
        </div>
        {status && <div className="muted">{status}</div>}
      </div>
      <div className="editor-body">
        {loading ? (
          <div className="muted">Loading...</div>
        ) : (
          (isEditable(path) ? (
            <div style={{ position: 'relative' }}>
              <textarea
                className="textarea"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Open or create a file to edit"
                style={{ position: 'relative', zIndex: 2 }}
              />
              <pre aria-hidden style={{ position: 'absolute', left: 12, top: 12, right: 12, bottom: 12, zIndex: 1, pointerEvents: 'none', opacity: 0.15 }}>
                <code dangerouslySetInnerHTML={{ __html: safeHighlight(content || '', extFromPath(path)) }} />
              </pre>
            </div>
          ) : (
            <div>
              <div className="muted">{status || 'Binary or unsupported file type'}</div>
              {path && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <a className="link" href={`/api/file?path=${encodeURIComponent(path)}`} download={path.split('/').pop()}>Download</a>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
