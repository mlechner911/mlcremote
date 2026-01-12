import React from 'react'
import { FileHandler, DecideOpts, ViewProps } from './types'
import { makeUrl } from '../api'
import TextView from '../components/TextView'
import ImageView from '../components/ImageView'
import PdfView from '../components/PdfView'
import { extFromPath, isProbablyText } from '../filetypes'

// Lazy load ShellView
const ShellView = React.lazy(() => import('../components/ShellView'))
const MarkdownPreview = React.lazy(() => import('../components/MarkdownPreview'))
const ArchiveViewer = React.lazy(() => import('../components/ArchiveViewer'))

export const ShellHandler: FileHandler = {
    name: 'Shell',
    priority: 100,
    matches: (opts: DecideOpts) => !!(opts.path && opts.path.startsWith('shell-')),
    view: ({ path }: ViewProps) => (
        <React.Suspense fallback={<div className="muted">Loading shell…</div>}>
            <ShellView path={path} />
        </React.Suspense>
    ),
    isEditable: false
}

export const DirectoryHandler: FileHandler = {
    name: 'Directory',
    priority: 90,
    matches: (opts: DecideOpts) => !!(opts.meta && opts.meta.isDir),
    view: ({ path, origContent }: ViewProps) => (
        <div style={{ padding: 12 }}>
            <div style={{ fontWeight: 600 }}>Directory: {path}</div>
            <div className="muted" style={{ marginTop: 6 }}>{origContent ? origContent.split('\n').length : '0'} entries</div>
            <pre style={{ marginTop: 8, maxHeight: 240, overflow: 'auto', padding: 8, background: 'var(--panel)' }}>{origContent}</pre>
        </div>
    ),
    isEditable: false
}

export const PdfHandler: FileHandler = {
    name: 'PDF',
    priority: 80,
    matches: (opts: DecideOpts) => {
        return (opts.probe && opts.probe.mime === 'application/pdf') ||
            (!!opts.path && opts.path.toLowerCase().endsWith('.pdf'))
    },
    view: ({ path }: ViewProps) => <PdfView path={path} />,
    isEditable: false
}

export const ImageHandler: FileHandler = {
    name: 'Image',
    priority: 70,
    matches: (opts: DecideOpts) => {
        if (opts.probe && opts.probe.mime && opts.probe.mime.startsWith('image/')) return true
        if (opts.path) {
            const lower = opts.path.toLowerCase()
            return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.svg') || lower.endsWith('.webp')
        }
        return false
    },
    view: ({ path, onDimensions }: ViewProps) => (
        <ImageView path={path} onDimensions={onDimensions} />
    ),
    isEditable: false
}

export const ArchiveHandler: FileHandler = {
    name: 'Archive',
    priority: 65,
    matches: (opts: DecideOpts) => {
        if (!opts.path) return false
        const lower = opts.path.toLowerCase()
        return lower.endsWith('.zip') || lower.endsWith('.tar') || lower.endsWith('.tar.gz') || lower.endsWith('.tgz')
    },
    view: ({ path }: ViewProps) => (
        <React.Suspense fallback={<div className="muted">Loading archive...</div>}>
            <ArchiveViewer path={path} />
        </React.Suspense>
    ),
    isEditable: false
}

export const MarkdownHandler: FileHandler = {
    name: 'Markdown',
    priority: 60,
    matches: (opts: DecideOpts) => {
        return opts.intent === 'view' && !!(opts.path && opts.path.toLowerCase().endsWith('.md'))
    },
    view: ({ content }: ViewProps) => (
        <React.Suspense fallback={<div className="muted">Loading preview...</div>}>
            <MarkdownPreview content={content || ''} />
        </React.Suspense>
    ),
    isEditable: false
}

export const TextHandler: FileHandler = {
    name: 'Text',
    priority: 50,
    matches: (opts: DecideOpts) => {
        // If probe says text, it's text.
        if (opts.probe && opts.probe.isText) return true

        // If we have a probe and it explicitly says NOT text, then we shouldn't match
        if (opts.probe && !opts.probe.isText) return false

        // Fallback to heuristic
        if (opts.path && isProbablyText(opts.path)) return true
        return false
    },
    view: ({ content, setContent, origContent, ext, alias, textareaId, readOnly }: ViewProps) => (
        <TextView content={content || ''} setContent={setContent || (() => { })} origContent={origContent || ''} ext={ext || ''} alias={alias} textareaId={textareaId || 'editor'} readOnly={readOnly} />
    ),
    isEditable: true
}

export const BinaryHandler: FileHandler = {
    name: 'Binary',
    priority: 10,
    matches: (opts: DecideOpts) => {
        // Catch-all for non-text things that aren't matched by above.
        // If we have a probe and it says NOT text, and it wasn't caught by Image/PDF, then it's binary.
        if (opts.probe && !opts.probe.isText) return true
        return false
    },
    view: ({ path }: ViewProps) => (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <a className="link" href={makeUrl(`/api/file?path=${encodeURIComponent(path)}`)} download={path.split('/').pop()}>Download</a>
            <span className="muted">(Binary or unsupported file type)</span>
        </div>
    ),
    // Binary view is not editable, it just offers download
    isEditable: false
}

// Fallback for completely unknown things (should rarely be hit if Text/Binary cover most)
export const UnsupportedHandler: FileHandler = {
    name: 'Unsupported',
    priority: 0,
    matches: () => true, // Match everything as last resort
    view: ({ path }: ViewProps) => (
        <div style={{ padding: 12 }} className="muted">
            Unsupported file type: {path}
        </div>
    ),
    isEditable: false
}
