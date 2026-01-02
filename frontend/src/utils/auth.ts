// Lightweight auth helpers: token storage and an auth-aware fetch wrapper.
export function getToken(): string | null {
  try {
    return localStorage.getItem('mlcremote_token')
  } catch (_) { return null }
}

export function setToken(t: string) {
  try { localStorage.setItem('mlcremote_token', t) } catch (_) { }
}

export async function authedFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init?.headers as HeadersInit)
  if (token) headers.set('X-Auth-Token', token)
  const merged: RequestInit = { ...(init || {}), headers }
  const res = await fetch(input, merged)
  if (res.status === 401) {
    try { localStorage.removeItem('mlcremote_token') } catch (_) { }
    try {
      window.dispatchEvent(new CustomEvent('mlcremote:auth-failed', { detail: { url: typeof input === 'string' ? input : (input as Request).url } }))
    } catch (_) { }
  }
  return res
}
