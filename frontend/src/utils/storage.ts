export type Serializer<T> = {
  read: (raw: string | null) => T | null
  write: (val: T) => string
}

export class LocalStore {
  prefix: string
  constructor(prefix = '') { this.prefix = prefix }

  key(k: string) { return `${this.prefix}${k}` }

  get<T>(k: string, serializer: Serializer<T>, fallback: T | null = null): T | null {
    try {
      const raw = localStorage.getItem(this.key(k))
      const parsed = serializer.read(raw)
      return parsed === null ? fallback : parsed
    } catch (e) {
      return fallback
    }
  }

  getOrDefault<T>(k: string, serializer: Serializer<T>, defaultValue: T): T {
    const v = this.get<T>(k, serializer, null)
    return v === null ? defaultValue : v
  }

  set<T>(k: string, v: T, serializer: Serializer<T>): void {
    try {
      localStorage.setItem(this.key(k), serializer.write(v))
    } catch (e) {
      // ignore storage errors
    }
  }

  remove(k: string) {
    try { localStorage.removeItem(this.key(k)) } catch (e) {}
  }
}

// Common serializers
export const strSerializer: Serializer<string> = {
  read: (r) => r === null ? null : r,
  write: (v) => String(v)
}

export const boolSerializer: Serializer<boolean> = {
  read: (r) => {
    if (r === null) return null
    return r === '1' || r === 'true'
  },
  write: (v) => v ? '1' : '0'
}

export const jsonSerializer = <T,>(): Serializer<T> => ({
  read: (r) => {
    if (r === null) return null
    try { return JSON.parse(r) as T } catch { return null }
  },
  write: (v) => JSON.stringify(v as any)
})

export const defaultStore = new LocalStore('mlc:')
