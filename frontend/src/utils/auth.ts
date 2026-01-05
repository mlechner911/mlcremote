// Lightweight auth helpers: token storage and an auth-aware fetch wrapper.
export function getToken(): string | null {
  try {
    return localStorage.getItem('mlcremote_token')
  } catch (_) { return null }
}

export function setToken(t: string) {
  try { localStorage.setItem('mlcremote_token', t) } catch (_) { }
}

let apiBaseUrl = ''

export function setApiBaseUrl(url: string) {
  apiBaseUrl = url.replace(/\/$/, '')
}

export function getApiBaseUrl() {
  return apiBaseUrl
}

export function makeUrl(endpoint: string) {
  if (!apiBaseUrl) return endpoint
  if (typeof endpoint !== 'string') return endpoint // safety
  if (endpoint.startsWith('http')) return endpoint

  // If apiBaseUrl has query params (like token), we need to handle them carefully
  // instead of simple concatenation which results in malformed URLs
  if (apiBaseUrl.includes('?')) {
    const [base, query] = apiBaseUrl.split('?')
    const url = `${base.replace(/\/$/, '')}${endpoint}`
    if (url.includes('?')) {
      return `${url}&${query}`
    }
    return `${url}?${query}`
  }

  return `${apiBaseUrl}${endpoint}`
}

export async function authedFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init?.headers as HeadersInit)
  if (token) headers.set('X-Auth-Token', token)
  const merged: RequestInit = { ...(init || {}), headers }

  // Apply base URL if input is a string path
  let finalInput = input
  if (typeof input === 'string' && input.startsWith('/')) {
    finalInput = makeUrl(input)
  }

  const res = await fetch(finalInput, merged)
  if (res.status === 401) {
    try { localStorage.removeItem('mlcremote_token') } catch (_) { }
    try {
      window.dispatchEvent(new CustomEvent('mlcremote:auth-failed', { detail: { url: typeof input === 'string' ? input : (input as Request).url } }))
    } catch (_) { }
  }
  return res
}
