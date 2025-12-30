export function formatByExt(_ext: string, text: string): string {
  // Basic client-side formatters for a few languages. Keep this lightweight.
  const ext = (_ext || '').toLowerCase()
  if (ext === 'sql') {
    // Very small SQL prettifier: uppercase common keywords and ensure semicolon newline
    const keywords = ['select','from','where','insert','into','values','update','set','delete','join','left','right','inner','outer','on','group','by','order','limit','create','table','alter','drop']
    let out = text.replace(/\s+/g, ' ')
    keywords.forEach(k => {
      const re = new RegExp('\\b' + k + '\\b', 'gi')
      out = out.replace(re, (m) => m.toUpperCase())
    })
    out = out.replace(/;\s*/g, ';\n\n')
    return out.trim()
  }
  // Formatting removed for other languages — passthrough
  return text
}
 /**
   * Format bytes into a human-readable string.
   */
  export function formatBytes(n?: number) {
    if (!n || n <= 0) return '0 B'
    const KB = 1024
    const MB = KB * 1024
    const GB = MB * 1024
    if (n >= GB) return `${(n / GB).toFixed(2)} GB`
    if (n >= MB) return `${(n / MB).toFixed(2)} MB`
    if (n >= KB) return `${(n / KB).toFixed(2)} KB`
    return `${n} B`
  }