import React from 'react'
import { readFile, saveFile, deleteFile, listTree, statPath, DirEntry } from '../api' // DirEntry for type if needed
import { Intent } from '../handlers/types'
import { formatBytes } from '../utils/bytes'
import { getIcon } from '../generated/icon-helpers'
import { probeFileType, extFromPath } from '../utils/filetypes'
import { effectiveExtFromFilename } from '../languageForFilename'
import { authedFetch } from '../utils/auth'
import { Icon } from '../generated/icons'
import { iconForExtension } from '../generated/icons'
import { getHandler } from '../handlers/registry'
import { useTranslation } from 'react-i18next'
import { handleBOM, restoreBOM } from '../utils/text'

import { Tab } from '../types/layout'

type Props = {
  path: string
  tab?: Tab
  onSaved?: () => void
  settings?: { allowDelete?: boolean }
  reloadTrigger?: number
  onUnsavedChange?: (path: string, hasUnsaved: boolean) => void
  onMeta?: (m: any) => void
  intent?: Intent
  onOpen?: (path: string, type?: any, label?: string, intent?: Intent) => void
  customLabel?: string
}

import MessageBox from './MessageBox'

export default function Editor({ path, tab, onSaved, settings, reloadTrigger, onUnsavedChange, onMeta, intent, onOpen, customLabel }: Props) {
  const { t } = useTranslation()
  const [content, setContent] = React.useState<string>('')
  const [origContent, setOrigContent] = React.useState<string>('')
  const [hasBOM, setHasBOM] = React.useState<boolean>(false)
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
  const [confirmDialog, setConfirmDialog] = React.useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const handler = getHandler({ path, meta, probe, intent })
  const HandlerView = handler.view

  const loadFile = React.useCallback(async (force = false) => {
    if (!path) return
    setLoading(true)
    setStatus('')
    try {
      // fetch metadata
      const m = await statPath(path)
      setMeta(m)
      if (typeof onMeta === 'function') onMeta(m)

      if (!force && lastLoadTime && lastModTime && m.modTime !== lastModTime) {
        if (!confirm(t('confirm_reload_external', 'File has been modified externally. Reload?'))) {
          setLoading(false)
          return
        }
      }

      setLastModTime(m.modTime)

      // Probe backend for actual file type
      const pt = await probeFileType(path)
      setProbe(pt)

      // Determine handler to decide if we need to load content
      const handler = getHandler({ path, meta: m, probe: pt, intent })

      // If it's a directory, listTree is handled in a separate effect for now, 
      // but let's clear content here just in case.
      if (m.isDir) {
        setContent('')
        setLoading(false)
        return
      }

      // If handler is Text (editable) then we read the file
      // If handler is Binary/Image/PDF/Shell we might not need to read text content
      if (handler.name === 'Text') {
        const rawText = await readFile(path)
        const { text, hasBOM } = handleBOM(rawText)
        setContent(text)
        setOrigContent(text)
        setHasBOM(hasBOM)
        setLastLoadTime(Date.now())
        setLoadFailed(false)
      } else {
        // For non-text, clear content
        setContent('')
        setLoading(false)
      }

    } catch (error) {
      if (probe && probe.isText) {
        setStatus(t('failed_to_load', 'Failed to load'))
        setLoadFailed(true)
      }
      setLastLoadTime(null)
    } finally {
      setLoading(false)
    }
  }, [path, t])

  // Read max size from settings (default 1MB)
  const getMaxSize = () => {
    try {
      const s = localStorage.getItem('mlc_max_editor_size')
      if (s) return parseInt(s, 10)
    } catch { }
    return 1024 * 1024 // 1MB default (was 10MB)
  }
  const editableThreshold = getMaxSize()

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
      setStatus(t('failed_to_load_section', 'Failed to load section'))
    } finally {
      setSectionLoading(false)
    }
  }

  const extFromName = effectiveExtFromFilename(path)
  const ext = extFromName || (probe && probe.ext) || extFromPath(path)
  const alias = undefined
  const grammar = (probe && probe.ext) ? probe.ext : 'text'

  const sanitizeId = (p: string) => {
    if (!p) return 'editor'
    return 'editor-' + p.replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-')
  }
  const textareaId = sanitizeId(path || '')

  React.useEffect(() => {
    loadFile()
  }, [loadFile])

  React.useEffect(() => {
    let mounted = true
      ; (async () => {
        if (!meta || !meta.isDir || !path) return
        try {
          const { entries } = await listTree(path)
          if (!mounted) return
          setContent('')
          setOrigContent(entries.map((e: any) => e.name).join('\n'))
        } catch (e) {
        }
      })()
    return () => { mounted = false }
  }, [meta, path])

  React.useEffect(() => {
    if (reloadTrigger && reloadTrigger > 0) {
      loadFile(true)
    }
  }, [reloadTrigger, loadFile])

  React.useEffect(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [content])

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

  React.useEffect(() => {
    if (preRef.current) {
      preRef.current.setAttribute('data-grammar', grammar)
    }
    if (textareaRef.current) {
      textareaRef.current.setAttribute('data-grammar', grammar)
      if (textareaId) textareaRef.current.id = textareaId
    }
    try {
      const code = preRef.current?.querySelector('code')
      if (code) {
        // @ts-ignore
        Prism.highlightElement(code)
      }
    } catch (e) {
    }
  }, [grammar, content, textareaId])

  React.useEffect(() => {
    if (!onUnsavedChange) return
    if (!handler.isEditable) return
    const hasUnsaved = content !== origContent
    if (prevUnsavedRef.current === null || prevUnsavedRef.current !== hasUnsaved) {
      try {
        onUnsavedChange(path, hasUnsaved)
      } catch (e) {
        console.warn('onUnsavedChange threw', e)
      }
      prevUnsavedRef.current = hasUnsaved
    }
  }, [content, origContent, onUnsavedChange, path, handler.isEditable])

  const onSave = async () => {
    if (!path) return
    setStatus(t('saving', 'Saving...'))
    try {
      const contentToSave = hasBOM ? restoreBOM(content) : content
      await saveFile(path, contentToSave)
      setStatus(t('saved', 'Saved'))
      setTimeout(() => setStatus(s => s === t('saved', 'Saved') ? '' : s), 1500)
      await loadFile(true)
      onSaved && onSaved()
    } catch {
      setStatus(t('save_failed', 'Save failed'))
    }
  }

  const onReload = async () => {
    if (!path) return
    const doReload = async () => {
      setStatus(t('reloading', 'Reloading...'))
      try {
        await loadFile(true)
        setStatus(t('reloaded', 'Reloaded'))
        setTimeout(() => setStatus(s => s === t('reloaded', 'Reloaded') ? '' : s), 1500)
      } catch (e) {
        setStatus(t('reload_failed', 'Reload failed'))
      }
    }

    if (content !== origContent) {
      setConfirmDialog({
        title: t('unsaved_changes_title', 'Unsaved Changes'),
        message: t('confirm_reload_unsaved', 'You have unsaved changes. Reloading will discard them. Continue?'),
        onConfirm: () => {
          setConfirmDialog(null)
          doReload()
        }
      })
      return
    }
    doReload()
  }

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSave])

  return (
    <div className="editor">
      {confirmDialog && (
        <MessageBox
          title={confirmDialog.title}
          message={confirmDialog.message}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
        />
      )}
      <div className="editor-header">
        <strong>{t('editor')}</strong>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="muted">{(meta && meta.absPath) ? meta.absPath : (customLabel || path || t('select_or_create'))}</span>
            {meta?.isReadOnly && <span className="badge badge-error" style={{ fontSize: 10, padding: '1px 4px' }}>{t('read_only', 'READ ONLY')}</span>}
            {intent === 'view' && <span className="badge box-accent" style={{ fontSize: 10, padding: '1px 4px', background: 'var(--accent)', color: 'white', borderRadius: 4 }}>{t('preview', 'PREVIEW')}</span>}
          </div>
          {meta && (
            <>
              <span className="muted" style={{ fontSize: 11 }}>
                {meta.isDir ? 'directory' : handler.name}
                · {meta.mode} · {new Date(meta.modTime).toLocaleString()} {meta.size ? `· ${formatBytes(meta.size)}` : ''}
              </span>
              {imageDims && handler.name === 'Image' ? (
                <span style={{ fontSize: 11, marginLeft: 8 }} className="muted">{imageDims.w} × {imageDims.h}</span>
              ) : null}
            </>
          )}
        </div>
        <div className="actions">
          <button className="link icon-btn" title={t('refresh')} aria-label={t('refresh')} onClick={onReload} disabled={!path}>
            <Icon name={iconForExtension('refresh') || 'icon-refresh'} title={t('refresh')} size={16} />
          </button>

          {(ext === 'md' || ext === 'markdown' || ext === 'svg') && onOpen && (
            <button
              className="link icon-btn"
              title={intent === 'view' ? t('edit') : t('preview')}
              onClick={() => onOpen(path, undefined, undefined, intent === 'view' ? 'edit' : 'view')}
            >
              <Icon name={getIcon(intent === 'view' ? 'terminal' : 'view') || 'view'} size={16} />
            </button>
          )}

          {/* Only show Save if handler supports editing and content changed */}
          {handler.isEditable && content !== origContent && (
            <button
              className="link icon-btn"
              title={meta?.isReadOnly ? t('read_only_file') : t('save')}
              aria-label={t('save')}
              onClick={onSave}
              disabled={!path || meta?.isReadOnly}
              style={meta?.isReadOnly ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              <Icon name={iconForExtension('upload') || 'icon-upload'} title={t('save')} size={16} />
            </button>
          )}
        </div>
        {meta && meta.size && meta.size > editableThreshold && handler.isEditable ? (
          <div style={{ marginLeft: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>{t('file_too_large', 'File is large ({{size}}). Full edit disabled.', { size: formatBytes(meta.size) })}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => loadSection(0, 64 * 1024)}>{t('view_head', 'View head')}</button>
              <button className="btn" onClick={() => loadSection(Math.max(0, (meta.size || 0) - 64 * 1024), 64 * 1024)}>{t('view_tail', 'View tail')}</button>
            </div>
            {sectionLoading && <div className="muted">{t('loading_section', 'Loading section...')}</div>}
          </div>
        ) : null}
        {status && <div className="muted">{status}</div>}
      </div>
      <div className="editor-body">
        {loading ? (
          <div className="muted">{t('loading')}</div>
        ) : (
          <HandlerView
            path={path}
            content={content}
            setContent={setContent}
            origContent={origContent}
            ext={ext}
            alias={alias}
            textareaId={textareaId}
            onDimensions={(w, h) => setImageDims({ w, h })}
            readOnly={meta?.isReadOnly}
            intent={intent}
            tab={tab}
          />
        )}
      </div>
    </div >
  )
}
