import { getToken, makeUrl } from '../api'

/**
 * Triggers a file download by fetching the content as a blob and creating a temporary link.
 * This avoids navigation issues in single-window environments (like Wails/WebView2).
 * 
 * @param path The remote file path to download
 * @param filename Optional filename (defaults to basename of path)
 */
export const triggerDownload = async (path: string, filename?: string) => {
    try {
        const token = getToken()
        const url = makeUrl(`/api/file?path=${encodeURIComponent(path)}&token=${token}&download=true`)

        // Use fetch to get blob, preventing navigation
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`Download failed: ${resp.statusText}`)

        const blob = await resp.blob()
        const blobUrl = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = blobUrl
        a.download = filename || path.split(/[/\\]/).pop() || 'download'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Revoke after a short delay to ensure click is registered
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (e) {
        console.error("Download error", e)
        alert("Failed to download file: " + (e as any).message)
    }
}
