// Lightweight auth helpers: token storage and an auth-aware fetch wrapper.
export function getToken(): string | null {
  try {
    return localStorage.getItem('mlcremote_token')
  } catch (_) { return null }
}

export function setToken(t: string) {
  try { localStorage.setItem('mlcremote_token', t) } catch (_) {}
}

export async function authedFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init?.headers as HeadersInit)
  if (token) headers.set('X-Auth-Token', token)
  const merged: RequestInit = { ...(init || {}), headers }
  return fetch(input, merged)
}
