export enum EditorView {
  NONE = 'none',
  TEXT = 'text',
  IMAGE = 'image',
  PDF = 'pdf',
  DIRECTORY = 'directory',
  SHELL = 'shell',
  BINARY = 'binary',
  UNSUPPORTED = 'unsupported',
}

export type DecideOpts = {
  path?: string | null
  meta?: any | null
  probe?: { mime?: string | null; isText?: boolean; ext?: string } | null
}

export function decideEditorToUse(opts: DecideOpts): EditorView {
  const { path, meta, probe } = opts
  // special shell path handling
  if (path && path.startsWith('shell-')) return EditorView.SHELL

  // directory
  if (meta && meta.isDir) return EditorView.DIRECTORY

  // if we have probe info, prefer that
  if (probe && probe.mime) {
    if (probe.mime === 'application/pdf') return EditorView.PDF
    if (probe.mime.startsWith('image/')) return EditorView.IMAGE
    if (!probe.isText) return EditorView.BINARY
    if (probe.isText) return EditorView.TEXT
  }

  // fallback to path-based heuristics
  if (path) {
    const lower = path.toLowerCase()
    if (lower.endsWith('.pdf')) return EditorView.PDF
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.svg')) return EditorView.IMAGE
    if (lower.endsWith('.md') || lower.endsWith('.txt') || lower.endsWith('.json') || lower.endsWith('.js') || lower.endsWith('.py') || lower.endsWith('.go') || lower.endsWith('.css') || lower.endsWith('.html')) return EditorView.TEXT
  }

  // default
  return EditorView.UNSUPPORTED
}
