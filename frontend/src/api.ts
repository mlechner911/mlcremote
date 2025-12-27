import { info, warn } from './logger'

export type Health = { status: string; version: string }
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

export async function listTree(path = ''): Promise<DirEntry[]> {
  const q = path ? `?path=${encodeURIComponent(path)}` : ''
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
