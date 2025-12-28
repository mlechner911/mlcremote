import React from 'react'
import { readFile, saveFile, deleteFile } from '../api'
import { isEditable, isProbablyText, extFromPath, probeFileType } from '../filetypes'
import Prism from 'prismjs'
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
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'

function escapeHtml(unsafe: string) {
  return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function langForExt(ext: string) {
  const L = Prism.languages as any
  switch (ext) {
  case 'js': case 'jsx': return L.javascript
  case 'ts': case 'tsx': return L.typescript
  case 'go': return L.go
  case 'php': return L.php
  case 'json': return L.json
  case 'yaml': case 'yml': return L.yaml
  case 'toml': return L.toml || L.markup
  case 'md': case 'markdown': return L.markdown
  case 'c': return L.c
  case 'cpp': return L.cpp
  case 'py': return L.python
  case 'sh': case 'bash': return L.bash
  default: return L.javascript
  }
}

function aliasForExt(ext: string) {
  switch (ext) {
  case 'js': case 'jsx': return 'javascript'
  case 'ts': case 'tsx': return 'typescript'
  case 'go': return 'go'
  case 'php': return 'php'
  case 'json': return 'json'
  case 'yaml': case 'yml': return 'yaml'
  case 'toml': return 'toml'
  case 'md': case 'markdown': return 'markdown'
  case 'c': return 'c'
  case 'cpp': return 'cpp'
  case 'py': return 'python'
  case 'sh': case 'bash': return 'bash'
  default: return 'text'
  }
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

type Props = {
  path: string
  onSaved?: () => void
  settings?: { allowDelete?: boolean }
}

/**
 * Editor component — fetches and renders file contents. Supports syntax
 * highlighting via Prism, saving, reloading, formatting (via dynamic import),
 * and inline image preview for image mime types.
 */
export default function Editor({ path, onSaved, settings }: Props) {
  const [content, setContent] = React.useState<string>('')
  const [origContent, setOrigContent] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)
  const [meta, setMeta] = React.useState<any>(null)
  const [probe, setProbe] = React.useState<{ mime: string; isText: boolean; ext: string } | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const preRef = React.useRef<HTMLElement | null>(null)
  const statusTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!path) return
    setLoading(true)
    setStatus('')
    // Probe backend for actual file type rather than relying on extension
    probeFileType(path).then(pt => {
      setProbe(pt)
      // fetch metadata
      import('../api').then(api => api.statPath(path).then(m => setMeta(m)).catch(() => setMeta(null)))
      if (!pt.isText) {
        setContent('')
        // if it's an image, we'll render it inline; otherwise show the binary notice
        if (!pt.mime || !pt.mime.startsWith('image/')) {
          setStatus('Binary or unsupported file type — use Download')
        } else {
          setStatus('')
        }
        setLoading(false)
        return
      }
      readFile(path)
        .then(text => { setContent(text); setOrigContent(text) })
        .catch(() => setStatus('Failed to load'))
        .finally(() => setLoading(false))
    }).catch(() => {
      setStatus('Failed to probe file type')
      setLoading(false)
    })
  }, [path])

  // keep pre scrolled to textarea's scroll position when content changes
  React.useEffect(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [content])

  const onSave = async () => {
    if (!path) return
    setStatus('Saving...')
    try {
      await saveFile(path, content)
      setStatus('Saved')
      setOrigContent(content)
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
    // confirm with user
    if (!confirm(`Delete ${path}? This will move the file to the server-side trash.`)) return
    setStatus('Deleting...')
    try {
      await deleteFile(path)
      setStatus('Deleted')
      setContent('')
    } catch {
      setStatus('Delete failed')
    }
  }

  const onReload = async () => {
    if (!path) return
    // if unsaved changes exist, confirm
    if (content !== origContent) {
      if (!confirm('You have unsaved changes. Reloading will discard them. Continue?')) return
    }
    setStatus('Reloading...')
    try {
      // re-probe and re-read
      const pt = await probeFileType(path)
      setProbe(pt)
      if (!pt.isText) {
        setContent('')
        if (!pt.mime || !pt.mime.startsWith('image/')) {
          setStatus('Binary or unsupported file type — use Download')
        } else {
          setStatus('')
        }
        return
      }
      const text = await readFile(path)
      setContent(text)
      setOrigContent(text)
      setStatus('Reloaded')
      // clear any previous timer
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
      statusTimerRef.current = window.setTimeout(() => {
        setStatus('')
        statusTimerRef.current = null
      }, 2000)
    } catch (e) {
      setStatus('Reload failed')
    }
  }

  // cleanup any pending timers on unmount
  React.useEffect(() => {
    return () => { if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current) }
  }, [])

  return (
    <div className="editor">
      <div className="editor-header">
        <strong>Editor</strong>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="muted">{path || 'Select a file'}</span>
          {meta && (
            <span className="muted" style={{ fontSize: 11 }}>{meta.mime || (meta.isDir ? 'directory' : '')} · {meta.mode} · {new Date(meta.modTime).toLocaleString()}</span>
          )}
        </div>
          <div className="actions">
          {/* Format removed until implemented */}
          <button className="btn" onClick={onReload} disabled={!path}>Reload</button>
          {path && content !== origContent && (
            <button className="btn" onClick={onSave}>Save</button>
          )}
          {settings && settings.allowDelete ? (
            <button className="btn btn-danger" onClick={onDelete} disabled={!path}>Delete</button>
          ) : null}
        </div>
        {(status && !(probe && probe.mime && probe.mime.startsWith('image/'))) && <div className="muted">{status}</div>}
      </div>
      <div className="editor-body">
        {loading ? (
          <div className="muted">Loading...</div>
        ) : (
          ((probe?.isText ?? isProbablyText(path)) || isEditable(path) ? (
            <div className="editor-edit-area">
              {
                (() => {
                  const ext = extFromPath(path)
                  const alias = aliasForExt(ext)
                  return (
                    <pre aria-hidden className={`highlight-wrap language-${alias}`} ref={el => { preRef.current = el }}>
                      <code className={`language-${alias}`} dangerouslySetInnerHTML={{ __html: safeHighlight(content || '', ext) }} />
                    </pre>
                  )
                })()
              }
              <textarea
                ref={textareaRef}
                className="textarea"
                wrap="off"
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
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
          ) : (
            <div>
              {/* Only show the textual notice when there is no image preview */}
              {!(probe && probe.mime && probe.mime.startsWith('image/')) && (
                <div className="muted">{status || 'Binary or unsupported file type'}</div>
              )}
              {probe && probe.mime && probe.mime.startsWith('image/') ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <img
                      src={`/api/file?path=${encodeURIComponent(path)}`}
                      alt={path.split('/').pop()}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
                    />
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <a className="link" href={`/api/file?path=${encodeURIComponent(path)}`} download={path.split('/').pop()}>Download</a>
                  </div>
                </div>
              ) : (
                path && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <a className="link" href={`/api/file?path=${encodeURIComponent(path)}`} download={path.split('/').pop()}>Download</a>
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
