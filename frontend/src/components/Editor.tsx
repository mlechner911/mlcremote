import React from 'react'
import { readFile, saveFile, deleteFile, listTree, statPath } from '../api'
const PdfPreview = React.lazy(() => import('./PdfPreview'))
import { formatBytes } from '../bytes'
import { isEditable, isProbablyText, extFromPath, probeFileType } from '../filetypes'
import { getToken, authedFetch } from '../auth'
import TextView from './TextView'
import ImageView from './ImageView'
import PdfView from './PdfView'
import { Icon } from '../generated/icons'
import { iconForMimeOrFilename as getIcon, iconForExtension } from '../generated/icons'
const ShellView = React.lazy(() => import('./ShellView'))




// Editor no longer computes a Prism alias here — TextView handles highlighting.


type Props = {
  path: string
  onSaved?: () => void
  settings?: { allowDelete?: boolean }
  reloadTrigger?: number
  // onUnsavedChange receives the editor `path` and whether it has
  // unsaved changes. Parents should pass a stable callback so this
  // component does not need to create per-render closures.
  onUnsavedChange?: (path: string, hasUnsaved: boolean) => void
  onMeta?: (m: any) => void
}

export default function Editor({ path, onSaved, settings, reloadTrigger, onUnsavedChange, onMeta }: Props) {
  const [content, setContent] = React.useState<string>('')
  const [origContent, setOrigContent] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)
  const [meta, setMeta] = React.useState<any>(null)
  const [sectionLoading, setSectionLoading] = React.useState<boolean>(false)
  const [probe, setProbe] = React.useState<{ mime: string; isText: boolean; ext: string } | null>(null)
  const [imageDims, setImageDims] = React.useState<{ w: number; h: number } | null>(null)
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
      const m = await statPath(path)
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

      // If backend reports an image MIME, treat it as an image preview regardless
      // of `isText` probe. This fixes cases where images were mis-classified as text.
      if (pt.mime && pt.mime.startsWith('image/')) {
        setContent('')
        setStatus('')
        setLoading(false)
        return
      }
      // pdf preview also special case
        if (pt.mime && pt.mime === 'application/pdf') {
            setContent('')
            setStatus('')
              setLoading(false)
        return
        }

      // If backend says it's not text (and not an image), show binary message
      if (!pt.isText) {
        setContent('')
        setStatus('no preview available — unsupported file type, use Download')
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

  const editableThreshold = 10 * 1024 * 1024 // 10 MB

  // load a section of the file via the server's section endpoint
  const loadSection = async (offset: number, length = 64 * 1024) => {
    if (!path) return
    setSectionLoading(true)
    try {
      const q = `?path=${encodeURIComponent(path)}&offset=${offset}&length=${length}`
      const r = await authedFetch(`/api/file/section${q}`)
      if (!r.ok) throw new Error('section fetch failed')
      const txt = await r.text()
      setContent(txt)
      setOrigContent(txt)
    } catch (e) {
      setStatus('Failed to load section')
    } finally {
      setSectionLoading(false)
    }
  }

  // compute grammar/alias for the current path to set on elements
  // prefer the probed extension from the backend probe if available
  const detectedExt = probe && probe.ext ? probe.ext : extFromPath(path)
  const ext = detectedExt
  const alias = undefined
  const grammar = (probe && probe.ext) ? probe.ext : 'text'
  // sanitize id (unique per full path) to avoid duplicate ids and ensure uniqueness
  const sanitizeId = (p: string) => {
    if (!p) return 'editor'
    return 'editor-' + p.replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-')
  }
  const textareaId = sanitizeId(path || '')

  React.useEffect(() => {
    loadFile()
  }, [loadFile])

  // If selected path is a directory, fetch listing for display
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!meta || !meta.isDir || !path) return
      try {
        const entries = await listTree(path)
        if (!mounted) return
        setContent('')
        // store entries as a simple newline-separated preview for now
        setOrigContent(entries.map((e: any) => e.name).join('\n'))
      } catch (e) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [meta, path])

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
        onUnsavedChange(path, hasUnsaved)
      } catch (e) {
        console.warn('onUnsavedChange threw', e)
      }
      prevUnsavedRef.current = hasUnsaved
    }
  }, [content, origContent, onUnsavedChange, path])
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
        const m = await statPath(path)
        setMeta(m)
        if (typeof onMeta === 'function') onMeta(m)
      } catch (e) {
        // ignore stat errors; save still succeeded
      }
    } catch {
      setStatus('Save failed')
    }
  }
/*
  import('../format').catch(() => {}) // ensure type info available to bundler
  // NOTE: `formatByExt` is imported statically to avoid Vite chunking warnings.
  // The actual formatting implementation is lightweight now (passthrough), so
  // the static import cost is acceptable.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { formatByExt } = require('../format') as typeof import('../format')
  const onFormat = async () => {
    if (!path) return
    const ext = extFromPath(path)
    setStatus('Formatting...')
    try {
      const formatted = formatByExt(ext, content)
      setContent(formatted)
      setStatus('Formatted')
    } catch (e) {
      setStatus('Format failed')
    }
  }
*/
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
          setStatus('?Binary or unsupported file type — use Download'+pt.mime)
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
          <span className="muted">{(meta && meta.absPath) ? meta.absPath : (path || 'Select a file')}</span>
          {meta && (
            <>
            <span className="muted" style={{ fontSize: 11 }}>
              {
                // friendly display: directory, image, pdf, text, or fallback to mime
                meta.isDir ? 'directory'
                : (probe && probe.mime && probe.mime.startsWith('image/')) ? 'image'
                : (probe && probe.mime === 'application/pdf') ? 'pdf'
                : (probe && probe.isText) ? 'text'
                : (meta.mime && meta.mime !== 'text/plain') ? meta.mime
                : (probe && probe.mime) ? probe.mime
                : meta.mime || 'file'
              }
              · {meta.mode} · {new Date(meta.modTime).toLocaleString()} {meta.size ? `· ${formatBytes(meta.size)}` : ''}
            </span>
            {probe && probe.mime && probe.mime.startsWith('image/') && imageDims ? (
              <span style={{ fontSize: 11, marginLeft: 8 }} className="muted">{imageDims.w} × {imageDims.h}</span>
            ) : null}
            </>
          )}
        </div>
          <div className="actions">
          {/* Format removed until implemented */}
          <button className="link icon-btn" title="Reload" aria-label="Reload" onClick={onReload} disabled={!path}>
            <Icon name={iconForExtension('refresh') || 'icon-refresh'} title="Reload" size={16} />
          </button>
          <button className="link icon-btn" title="Save" aria-label="Save" onClick={onSave} disabled={!path || content === origContent}>
            <Icon name={iconForExtension('upload') || 'icon-upload'} title="Save" size={16} />
          </button>
          {settings && settings.allowDelete ? (
            <button className="btn btn-danger" onClick={onDelete} disabled={!path}>Delete</button>
          ) : null}
        </div>
        {meta && meta.size && meta.size > editableThreshold ? (
          <div style={{ marginLeft: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>File is large ({formatBytes(meta.size)}). Full edit disabled.</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => loadSection(0, 64*1024)}>View head</button>
              <button className="btn" onClick={() => loadSection(Math.max(0, (meta.size || 0) - 64*1024), 64*1024)}>View tail</button>
              <button className="btn" onClick={() => {
                const off = Math.max(0, Math.floor((meta.size || 0) / 2))
                loadSection(off, 64*1024)
              }}>View middle</button>
            </div>
            {sectionLoading && <div className="muted">Loading section...</div>}
          </div>
        ) : null}
        {status && <div className="muted">{status}</div>}
      </div>
      <div className="editor-body">
        {/* Trash is a global view accessible from the app toolbar */}
        {loading ? (
          <div className="muted">Loading...</div>
        ) : meta && meta.isDir ? (
          <div style={{ padding: 12 }}>
            <div style={{ fontWeight: 600 }}>Directory: {path}</div>
            <div className="muted" style={{ marginTop: 6 }}>{origContent ? origContent.split('\n').length : '0'} entries</div>
            <pre style={{ marginTop: 8, maxHeight: 240, overflow: 'auto', padding: 8, background: 'var(--panel)' }}>{origContent}</pre>
          </div>
        ) : ((probe?.isText ?? isProbablyText(path)) || isEditable(path)) ? (
          <TextView content={content} setContent={setContent} origContent={origContent} ext={ext} alias={alias} textareaId={textareaId} />
        ) : (
          <div>
            {/* special shell view: path may be 'shell-<ts>' for terminal tabs */}
            {path && path.startsWith('shell-') ? (
              <React.Suspense fallback={<div className="muted">Loading shell…</div>}>
                <ShellView path={path} />
              </React.Suspense>
            ) : probe && probe.mime && probe.mime === 'application/pdf' ? (
              <PdfView path={path} />
            ) : probe && probe.mime && probe.mime.startsWith('image/') ? (
              <ImageView path={path} onDimensions={(w,h) => setImageDims({ w,h })} />
            ) : path ? (
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <a className="link" href={`/api/file?path=${encodeURIComponent(path)}`} download={path.split('/').pop()}>Download</a>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
