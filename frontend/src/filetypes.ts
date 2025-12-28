/**
 * Known textual file extensions. These are treated as text for preview/edit purposes.
 * Keep this list conservative — unknown extensions default to text.
 */
const textExtensions = new Set([
  'txt','md','markdown','yaml','yml','json','js','ts','jsx','tsx','html','css','env','ini','cfg','conf','gitignore','dockerfile'
])
/**
 * Known binary file extensions. These are treated as non-text/binary and will
 * typically be offered for download or an image preview instead of an editor.
 */
const binaryExtensions = new Set([
  'zip','gz','tar','rar','exe','dll','so','bin','jpg','jpeg','png','gif','webp','pdf'
])

/**
 * Return the file extension for a given POSIX-style path.
 * Example: '/foo/bar/baz.txt' -> 'txt'
 */
export function extFromPath(path: string): string {
  const parts = path.split('/')
  const name = parts[parts.length - 1] || ''
  const dot = name.lastIndexOf('.')
  if (dot === -1) return ''
  return name.slice(dot + 1).toLowerCase()
}

/**
 * Heuristic: determine whether a path likely refers to a text file based on
 * its extension. If the extension is unknown we err on the side of text so
 * that small scripts and config files are editable.
 */
export function isProbablyText(path: string): boolean {
  const ext = extFromPath(path)
  if (!ext) return true
  if (textExtensions.has(ext)) return true
  if (binaryExtensions.has(ext)) return false
  // default to true; treat unknown as text
  return true
}

/**
 * Decide whether the file should be opened in the editor. This is stricter
 * than `isProbablyText` — files without an extension are not considered
 * editable by default to avoid offering editing for device files, etc.
 */
export function isEditable(path: string): boolean {
  const ext = extFromPath(path)
  if (!ext) return false
  if (binaryExtensions.has(ext)) return false
  // allow YAML, JSON, code, text
  return true
}

/**
 * Convenience predicate for YAML extensions.
 */
export function isYaml(path: string): boolean {
  const e = extFromPath(path)
  return e === 'yml' || e === 'yaml'
}

/**
 * Convenience predicate for JSON extension.
 */
export function isJson(path: string): boolean {
  const e = extFromPath(path)
  return e === 'json'
}

/**
 * Result returned by the server and the local probe helper describing the
 * detected MIME type and whether the file should be treated as text.
 */
export type ProbeResult = { mime: string; isText: boolean; ext: string }

/**
 * Probe the file type by contacting the backend `/api/filetype` endpoint.
 * If the request fails we fall back to a local heuristic based on extension.
 */
export async function probeFileType(path: string): Promise<ProbeResult> {
  if (!path) return { mime: 'application/octet-stream', isText: false, ext: '' }
  try {
    const q = `?path=${encodeURIComponent(path)}`
    const r = await fetch(`/api/filetype${q}`)
    if (!r.ok) throw new Error('probe failed')
    return await r.json()
  } catch (e) {
    const ext = extFromPath(path)
    return { mime: 'application/octet-stream', isText: isProbablyText(path), ext }
  }
}
