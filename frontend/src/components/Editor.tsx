import React from 'react'
import { readFile, saveFile, deleteFile } from '../api'
import { formatBytes } from '../format'
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

// @ts-ignore: allow side-effect CSS import without type declarations
import '../editor.css'

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
  reloadTrigger?: number
  onUnsavedChange?: (hasUnsaved: boolean) => void
  onMeta?: (m: any) => void
}

export default function Editor({ path, onSaved, settings, reloadTrigger, onUnsavedChange, onMeta }: Props) {
  const [content, setContent] = React.useState<string>('')
  const [origContent, setOrigContent] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)
  const [meta, setMeta] = React.useState<any>(null)
  const [probe, setProbe] = React.useState<{ mime: string; isText: boolean; ext: string } | null>(null)
  const [lastLoadTime, setLastLoadTime] = React.useState<number | null>(null)
  const [lastModTime, setLastModTime] = React.useState<string | null>(null)
  const [loadFailed, setLoadFailed] = React.useState<boolean>(false)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const preRef = React.useRef<HTMLElement | null>(null)
  const prevUnsavedRef = React.useRef<boolean | null>(null)

  const loadFile = React.useCallback(async (force = false) => {
    if (!path) return
    setLoading(true)
    setStatus('')
    try {
      // fetch metadata
      const m = await import('../api').then(api => api.statPath(path))
      setMeta(m)
      if (typeof onMeta === 'function') onMeta(m)

      // Check if file has changed since last load (only if we have previous load data and not forcing)
      if (!force && lastLoadTime && lastModTime && m.modTime !== lastModTime) {
        if (!confirm('File has been modified externally. Reload?')) {
          setLoading(false)
          return
        }
      }

      setLastModTime(m.modTime)

      // Probe backend for actual file type
      const pt = await probeFileType(path)
      setProbe(pt)

      if (!pt.isText) {
        setContent('')
        if (!pt.mime || !pt.mime.startsWith('image/')) {
          setStatus('Binary or unsupported file type — use Download')
        } else {
          setStatus('')
        }
        setLoading(false)
        return
      }

      const text = await readFile(path)
      setContent(text)
      setOrigContent(text)
      setLastLoadTime(Date.now())
      setLoadFailed(false)
    } catch (error) {
      setStatus('Failed to load')
      setLoadFailed(true)
      setLastLoadTime(null) // Reset so next attempt will try again
    } finally {
      setLoading(false)
    }
  }, [path])

  // compute grammar/alias for the current path to set on elements
  // prefer the probed extension from the backend probe if available
  const detectedExt = probe && probe.ext ? probe.ext : extFromPath(path)
  const ext = detectedExt
  const alias = aliasForExt(ext)
  const grammar = alias || (probe && probe.ext ? probe.ext : 'text')
  // sanitize id (unique per full path) to avoid duplicate ids and ensure uniqueness
  const sanitizeId = (p: string) => {
    if (!p) return 'editor'
    return 'editor-' + p.replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-')
  }
  const textareaId = sanitizeId(path || '')

  React.useEffect(() => {
    loadFile()
  }, [loadFile])

  React.useEffect(() => {
    if (reloadTrigger && reloadTrigger > 0) {
      loadFile(true) // force reload
    }
  }, [reloadTrigger])

  // keep pre scrolled to textarea's scroll position when content changes
  React.useEffect(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [content])

  // sync line-height and vertical padding from pre to textarea for alignment
  // Thius is needed because Prism's line-height can differ from normal textarea line-height
  // and we had this broken .. .more than once :(
  React.useEffect(() => {
    if (textareaRef.current && preRef.current) {
      const cs = window.getComputedStyle(preRef.current)
      const lh = cs.lineHeight
      const pt = cs.paddingTop
      const pb = cs.paddingBottom
      if (lh) textareaRef.current.style.lineHeight = lh
      if (pt) textareaRef.current.style.paddingTop = pt
      if (pb) textareaRef.current.style.paddingBottom = pb
    }
  }, [content, path])

  // keep grammar attributes and Prism highlighting in sync when grammar or content changes
  React.useEffect(() => {
    if (preRef.current) {
      preRef.current.setAttribute('data-grammar', grammar)
    }
    if (textareaRef.current) {
      textareaRef.current.setAttribute('data-grammar', grammar)
      if (textareaId) textareaRef.current.id = textareaId
    }
    // re-run Prism highlight on the code element to ensure grammar changes take effect
    try {
      const code = preRef.current?.querySelector('code')
      if (code) {
        // @ts-ignore
        Prism.highlightElement(code)
      }
    } catch (e) {
      // ignore highlight errors
    }
  }, [grammar, content, textareaId])

  // notify parent when unsaved status changes, but avoid calling parent every render
  React.useEffect(() => {
    if (!onUnsavedChange) return
    const hasUnsaved = content !== origContent
    if (prevUnsavedRef.current === null || prevUnsavedRef.current !== hasUnsaved) {
      try {
        onUnsavedChange(hasUnsaved)
      } catch (e) {
        console.warn('onUnsavedChange threw', e)
      }
      prevUnsavedRef.current = hasUnsaved
    }
  }, [content, origContent, onUnsavedChange])
// save action saves the file
  const onSave = async () => {
    if (!path) return
    setStatus('Saving...')
    try {
      await saveFile(path, content)
      setStatus('Saved')
      setOrigContent(content)
      onSaved && onSaved()
      try {
        // re-stat the file so parent can update size/metadata
        const m = await import('../api').then(api => api.statPath(path))
        setMeta(m)
        if (typeof onMeta === 'function') onMeta(m)
      } catch (e) {
        // ignore stat errors; save still succeeded
      }
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
    } catch (e) {
      setStatus('Reload failed')
    }
  }

  return (
    <div className="editor">
      <div className="editor-header">
        <strong>Editor</strong>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="muted">{path || 'Select a file'}</span>
          {meta && (
            <span className="muted" style={{ fontSize: 11 }}>
              {((meta.mime && meta.mime !== 'text/plain') ? meta.mime : (probe && probe.mime ? probe.mime : meta.mime)) || (meta.isDir ? 'directory' : '')}
              {((probe && probe.ext) || (meta && meta.ext)) ? ` (${(probe && probe.ext) || meta.ext})` : ''} · {meta.mode} · {new Date(meta.modTime).toLocaleString()} {meta.size ? `· ${formatBytes(meta.size)}` : ''}
            </span>
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
        {status && <div className="muted">{status}</div>}
      </div>
      <div className="editor-body">
        {loading ? (
          <div className="muted">Loading...</div>
        ) : (
          ((probe?.isText ?? isProbablyText(path)) || isEditable(path) ? (
            <div className="editor-edit-area">
              {
                (() => {
                  return (
                    <pre aria-hidden className={`highlight-wrap language-${alias}`} data-grammar={grammar} ref={el => { preRef.current = el }}>
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
                name={path || 'editor'}
                id={textareaId}
                data-grammar={grammar}
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
              <div className="muted">{status || 'Binary or unsupported file type'}</div>
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
