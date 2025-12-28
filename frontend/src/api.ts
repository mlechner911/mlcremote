import { info, warn } from './logger'

export type Health = { status: string; version: string; host?: string; cpu_percent?: number; sys_mem_total_bytes?: number; sys_mem_free_bytes?: number }
export type DirEntry = {
  name: string
  path: string // leading '/'
  isDir: boolean
  size: number
  modTime: string
}

export async function getHealth(): Promise<Health> {
  info('GET /health')
  const r = await fetch('/health')
  info(`/health => ${r.status}`)
  if (!r.ok) {
    warn('/health not ok')
    throw new Error('health failed')
  }
  return r.json()
}

export async function listTree(path = '', opts?: { showHidden?: boolean }): Promise<DirEntry[]> {
  const params = new URLSearchParams()
  if (path) params.set('path', path)
  if (opts?.showHidden) params.set('showHidden', '1')
  const q = params.toString() ? `?${params.toString()}` : ''
  info(`GET /api/tree${q}`)
  const r = await fetch(`/api/tree${q}`)
  info(`/api/tree${q} => ${r.status}`)
  if (!r.ok) {
    warn('/api/tree not ok')
    throw new Error('tree failed')
  }
  return r.json()
}

export async function readFile(path: string): Promise<string> {
  info(`GET /api/file?path=${path}`)
  const r = await fetch(`/api/file?path=${encodeURIComponent(path)}`)
  info(`/api/file?path=${path} => ${r.status}`)
  if (!r.ok) {
    warn('/api/file read failed')
    throw new Error('read failed')
  }
  return r.text()
}

export async function statPath(path: string): Promise<any> {
  info(`GET /api/stat?path=${path}`)
  const r = await fetch(`/api/stat?path=${encodeURIComponent(path)}`)
  info(`/api/stat?path=${path} => ${r.status}`)
  if (!r.ok) throw new Error('stat failed')
  return r.json()
}

export async function saveFile(path: string, content: string): Promise<void> {
  info(`POST /api/file path=${path} size=${content.length}`)
  const r = await fetch('/api/file', {
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

export async function deleteFile(path: string): Promise<void> {
  info(`DELETE /api/file?path=${path}`)
  const r = await fetch(`/api/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
  info(`/api/file delete => ${r.status}`)
  if (!r.ok) {
    warn('/api/file delete failed')
    throw new Error('delete failed')
  }
}
