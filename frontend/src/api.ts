import { info, warn } from './logger'
import { getToken, setToken, authedFetch } from './auth'

export async function login(password: string): Promise<string> {
    info('POST /api/login')
    const r = await fetch('/api/login', {
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
    pid?: number;
    cpu_percent?: number;
    sys_mem_total_bytes?: number;
    sys_mem_free_bytes?: number;
    go_alloc_bytes?: number;
    go_sys_bytes?: number;
    password_auth?: boolean;
    auth_required?: boolean;

    server_time?: string;
    timezone?: string;

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
export function captureTokenFromURL() {
    try {
        const params = new URLSearchParams(window.location.search)
        const t = params.get('token')
        if (t) {
            setToken(t)
            return true
        }
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
    const q = params.toString() ? `?${params.toString()}` : ''
    info(`GET /api/tree${q}`)
    const r = await authedFetch(`/api/tree${q}`)
    info(`/api/tree${q} => ${r.status}`)
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
    if (!r.ok) {
        warn('/api/file read failed')
        throw new Error('read failed')
    }
    return r.text()
}

/**
 * Retrieve metadata for `path`. The server returns an object describing the
 * file (mime, size, mode, modTime, etc.). Caller treats the result as `any`.
 */
export async function statPath(path: string): Promise<any> {
    info(`GET /api/stat?path=${path}`)
    const r = await authedFetch(`/api/stat?path=${encodeURIComponent(path)}`)
    info(`/api/stat?path=${path} => ${r.status}`)
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
        throw new Error('delete failed')
    }
}
