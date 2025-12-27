const textExtensions = new Set([
  'txt','md','markdown','yaml','yml','json','js','ts','jsx','tsx','html','css','env','ini','cfg','conf','gitignore','dockerfile'
])
const binaryExtensions = new Set([
  'zip','gz','tar','rar','exe','dll','so','bin','jpg','jpeg','png','gif','webp','pdf'
])

export function extFromPath(path: string): string {
  const parts = path.split('/')
  const name = parts[parts.length - 1] || ''
  const dot = name.lastIndexOf('.')
  if (dot === -1) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function isProbablyText(path: string): boolean {
  const ext = extFromPath(path)
  if (!ext) return true
  if (textExtensions.has(ext)) return true
  if (binaryExtensions.has(ext)) return false
  // default to true; treat unknown as text
  return true
}

export function isEditable(path: string): boolean {
  const ext = extFromPath(path)
  if (!ext) return false
  if (binaryExtensions.has(ext)) return false
  // allow YAML, JSON, code, text
  return true
}

export function isYaml(path: string): boolean {
  const e = extFromPath(path)
  return e === 'yml' || e === 'yaml'
}

export function isJson(path: string): boolean {
  const e = extFromPath(path)
  return e === 'json'
}

export type ProbeResult = { mime: string; isText: boolean; ext: string }

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
