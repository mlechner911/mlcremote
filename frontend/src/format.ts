export function formatByExt(_ext: string, text: string): string {
  // Formatting has been removed from the client. Keep this function as a passthrough
  // so callers that import it dynamically won't fail.
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