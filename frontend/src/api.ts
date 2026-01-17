import { info, warn } from './utils/logger'
import { getToken, setToken, authedFetch, makeUrl, setApiBaseUrl, getApiBaseUrl } from './utils/auth'

export { setApiBaseUrl, getApiBaseUrl, makeUrl, getToken }

export async function login(password: string): Promise<string> {
    info('POST /api/login')
    const r = await fetch(makeUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    })
    info(`/api/login => ${r.status}`)
    if (!r.ok) throw new Error('login failed')
    const j = await r.json()
    if (j && j.token) {
        setToken(j.token)
        return j.token
    }
    throw new Error('no token in response')
}

// re-export authedFetch so other modules can call it from api
export { authedFetch }

/**
 * Health payload returned by the server's `/health` endpoint.
 */
export type Health = {
    status: string;
    version: string;
    host?: string;
    os?: string;
    distro?: string;
    pid: number;
    go_alloc_bytes: number;
    cpu_percent?: number;
    sys_mem_total_bytes?: number;
    sys_mem_free_bytes?: number;
    go_sys_bytes?: number;
    password_auth?: boolean;
    auth_required?: boolean;

    server_time?: string;
    timezone?: string;
    start_time?: string;
}

/**
 * Directory entry used by the file tree API.
 * `path` is always relative to the server root and starts with a leading '/'.
 */
export type DirEntry = {
    name: string
    path: string // leading '/'
    isDir: boolean
    isSymlink?: boolean
    isBroken?: boolean
    isExternal?: boolean
    isReadOnly?: boolean
    isRestricted?: boolean
    mode?: string
    size: number
    modTime: string
}

/**
 * Fetch the server health payload.
 */
export async function getHealth(): Promise<Health> {
    info('GET /health')
    const r = await authedFetch('/health')
    info(`/health => ${r.status}`)
    if (!r.ok) {
        warn('/health not ok')
        throw new Error('health failed')
    }
    return r.json()
}

// If a token is provided via URL query (e.g., ?token=XXX) set it into storage
// this is now our default method of setting the token, so we should never end up with unauthenticated endpointds
export function captureTokenFromURL() {
    try {
        const params = new URLSearchParams(window.location.search)
        const t = params.get('token')
        if (t) {
            setToken(t)
            // Do not return true here, so we continue to check API url?
            // actually main.tsx calls this.
        }

        const api = params.get('api')
        if (api) {
            //     info(`[Debug] Found API param: ${api}`)
            try {
                const apiObj = new URL(api)
                // Set base URL without query params and without trailing slash
                let base = apiObj.origin + apiObj.pathname
                if (base.endsWith('/')) {
                    base = base.slice(0, -1)
                }
                // DEBUG: Alert the resolved base URL
                // window.alert(`MLCRemote Debug: API Base set to ${base}`)
                //     info(`[Debug] Setting Base URL: ${base}`)
                setApiBaseUrl(base)

                // Extract token from api url params
                const apiToken = apiObj.searchParams.get('token')
                if (apiToken) {
                    setToken(apiToken)
                }
            } catch (e) {
                // if parsing fails, fallback to raw string (though likely broken if it had params)
                //     console.error("Failed to parse API URL", e)
                setApiBaseUrl(api)
            }
        } else {
            // info('[Debug] No API param found')
        }

        return !!t
    } catch (_) { }
    return false
}

export async function authCheck(): Promise<boolean> {
    try {
        const r = await authedFetch('/api/auth/check')
        return r.status === 200
    } catch (e) {
        return false
    }
}

/**
 * List directory entries under `path`. When `path` is empty the server root
 * is listed.
 */
export async function listTree(path = '', opts?: { showHidden?: boolean }): Promise<DirEntry[]> {
    const params = new URLSearchParams()
    if (path) params.set('path', path)
    if (opts?.showHidden) params.set('showHidden', '1')
    params.set('_', Date.now().toString()) // cache busting
    const q = params.toString() ? `?${params.toString()}` : ''
    info(`GET /api/tree${q}`)
    const r = await authedFetch(`/api/tree${q}`)
    info(`/api/tree${q} => ${r.status}`)
    if (r.status === 403) {
        throw new Error('Permission denied')
    }
    if (!r.ok) {
        warn('/api/tree not ok')
        throw new Error('tree failed')
    }
    return r.json()
}

/**
 * Read the contents of the file at `path` as UTF-8 text.
 */
export async function readFile(path: string): Promise<string> {
    info(`GET /api/file?path=${path}`)
    const r = await authedFetch(`/api/file?path=${encodeURIComponent(path)}`)
    info(`/api/file?path=${path} => ${r.status}`)
    if (r.status === 403) throw new Error('Permission denied')
    if (!r.ok) {
        warn('/api/file read failed')
        throw new Error('read failed')
    }
    return r.text()
}

/**
 * FileStat represents extended file metadata returned by `/api/stat`.
 */
export interface FileStat {
    isDir: boolean
    size: number
    mode: string
    modTime: string
    absPath: string
    mime: string
    isBlockDevice: boolean
    isCharDevice: boolean
    isSocket: boolean
    isNamedPipe: boolean
    isReadOnly: boolean
    isRestricted?: boolean
}

/**
 * Retrieve metadata for `path`. The server returns an object describing the
 * file (mime, size, mode, modTime, etc.).
 */
export async function statPath(path: string): Promise<FileStat> {
    info(`GET /api/stat?path=${path}`)
    const r = await authedFetch(`/api/stat?path=${encodeURIComponent(path)}`)
    info(`/api/stat?path=${path} => ${r.status}`)
    if (r.status === 403) throw new Error('Permission denied')
    if (!r.ok) throw new Error('stat failed')
    return r.json()
}

/**
 * Save `content` to the server-side path. This creates directories as needed.
 */
export async function saveFile(path: string, content: string): Promise<void> {
    info(`POST /api/file path=${path} size=${content.length}`)
    const r = await authedFetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
    })
    info(`/api/file POST => ${r.status}`)
    if (!r.ok) {
        warn('/api/file save failed')
        throw new Error('save failed')
    }
}

/**
 * Delete a file on the server.
 */
export async function deleteFile(path: string): Promise<void> {
    info(`DELETE /api/file?path=${path}`)
    const r = await authedFetch(`/api/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
    info(`/api/file delete => ${r.status}`)
    if (!r.ok) {
        warn('/api/file delete failed')
        const txt = await r.text().catch(() => '')
        throw new Error(txt || 'delete failed')
    }
}

/**
 * Upload a file to the specified directory.
 */
export async function uploadFile(path: string, file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)
    info(`POST /api/upload path=${path} filename=${file.name} size=${file.size}`)
    const r = await authedFetch(`/api/upload?path=${encodeURIComponent(path)}`, {
        method: 'POST',
        body: formData
    })
    info(`/api/upload POST => ${r.status}`)
    if (!r.ok) {
        warn('/api/upload failed')
        throw new Error('upload failed')
    }
}

/**
 * Rename a file or directory.
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
    info(`POST /api/rename old=${oldPath} new=${newPath}`)
    const r = await authedFetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath })
    })
    info(`/api/rename POST => ${r.status}`)
    if (!r.ok) {
        warn('/api/rename failed')
        const txt = await r.text().catch(() => '')
        throw new Error(txt || 'rename failed')
    }
}

export type ArchiveEntry = {
    name: string
    size: number
    isDir: boolean
    modTime: string
}

/**
 * List contents of an archive file.
 */
export async function listArchive(path: string): Promise<ArchiveEntry[]> {
    const q = `?path=${encodeURIComponent(path)}`
    info(`GET /api/archive/list${q}`)
    const r = await authedFetch(`/api/archive/list${q}`)
    info(`/api/archive/list${q} => ${r.status}`)
    if (!r.ok) throw new Error('archive list failed')
    return r.json()
}

/**
 * Fetch the last 50KB of server logs.
 */
export async function getRemoteLogs(): Promise<string> {
    const r = await authedFetch('/api/logs')
    if (!r.ok) throw new Error('Failed to fetch remote logs')
    return r.text()
}

// ... (existing code)

/**
 * User configurable settings.
 */
export interface Settings {
    theme?: 'dark' | 'light'
    language?: string
    lastProfileId?: string
    autoOpen?: boolean
    showHiddenFiles?: boolean
    onboardingCompleted?: boolean
    showLogs?: boolean
    showServerLogs?: boolean
    hideMemoryUsage?: boolean
    maxEditorSize?: number
    allowDelete?: boolean
    defaultShell?: string
    uiMode?: 'classic' | 'modern'
}

export interface TaskDef {
    name: string
    command: string
    icon?: string
    color?: string
    showOnLaunch?: boolean
}

export async function getSettings(): Promise<Settings> {
    const r = await authedFetch('/api/settings')
    if (!r.ok) throw new Error('Failed to load settings')
    return r.json()
}

export async function saveSettings(s: Partial<Settings>): Promise<Settings> {
    const r = await authedFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s)
    })
    if (!r.ok) throw new Error('Failed to save settings')
    return r.json()
}
