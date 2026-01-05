import React from 'react'
import { statPath, getApiBaseUrl } from '../api'
import { getToken, authedFetch } from '../utils/auth'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTranslation } from 'react-i18next'

type Props = {
  shell: string
  path: string
  onExit?: () => void
}

/**
 * TerminalTab hosts an xterm.js terminal and connects it to a server-side
 * PTY over WebSocket. It prefers creating a persistent session via
 * `/api/terminal/new` and then attaching with `?session=...`. If that
 * fails it falls back to an ephemeral WS-based PTY. The component handles
 * resize events and exposes copy/paste helpers.
 */
export default function TerminalTab({ shell, path, onExit }: Props) {
  const { t } = useTranslation()
  const ref = React.useRef<HTMLDivElement | null>(null)
  const termRef = React.useRef<Terminal | null>(null)
  const fitRef = React.useRef<FitAddon | null>(null)
  const wsRef = React.useRef<WebSocket | null>(null)

  React.useEffect(() => {
    if (!ref.current) return
    const term = new Terminal({ cols: 80, rows: 24 })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(ref.current)
    // fit to the container
    fit.fit()
    fitRef.current = fit
    termRef.current = term

    // request a new persistent session from the server
    let sessionId: string | null = null
    let ws: WebSocket | null = null

    const attachWS = (socket: WebSocket, connectedMsg: string) => {
      ws = socket
      wsRef.current = socket
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => {
        term.write('\r\n' + connectedMsg + '\r\n')
        // send initial size
        try {
          const dims = { type: 'resize', cols: (term as any).cols || 80, rows: (term as any).rows || 24 }
          if (ws) ws.send(JSON.stringify(dims))
        } catch (_) { }
      }
      ws.onmessage = (ev) => {
        const data = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer)
        term.write(data)
      }
      ws.onclose = () => {
        try { if (wsRef.current) wsRef.current = null } catch (_) { }
        if (onExit) try { onExit() } catch (_) { }
      }
      term.onData(d => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(d) })
    }

    // If `path` points to a file, use its parent directory. Ask backend /api/stat
    // to determine file vs directory. If stat fails, fall back to sending the
    // original path.
    const resolveCwd = async (p: string) => {
      try {
        const j = await statPath(p)
        if (j && j.exists && j.isDir) return p
        if (j && j.exists && !j.isDir) return p.replace(/\/[^/]*$/, '') || '/'
        return p
      } catch (_) {
        return p
      }
    }

    resolveCwd(path).then((cwd) => {
      const token = localStorage.getItem('mlcremote_token')

      const constructWsUrl = (baseUrl: string, endpoint: string, params: Record<string, string>) => {
        let urlObj: URL;
        try {
          urlObj = new URL(baseUrl);
        } catch (e) {
          urlObj = new URL(baseUrl, location.origin);
        }

        // Convert http to ws
        if (urlObj.protocol === 'https:') urlObj.protocol = 'wss:';
        else if (urlObj.protocol === 'http:') urlObj.protocol = 'ws:';

        // Append endpoint to existing path (handling slashes)
        const existingPath = urlObj.pathname.endsWith('/') ? urlObj.pathname.slice(0, -1) : urlObj.pathname;
        const endpointPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        urlObj.pathname = existingPath + endpointPath;

        // Merge params
        Object.entries(params).forEach(([k, v]) => {
          urlObj.searchParams.set(k, v);
        });

        return urlObj.toString();
      }

      const apiBase = getApiBaseUrl() || location.origin;
      const wsEndpoint = '/ws/terminal';
      const commonParams: Record<string, string> = {
        shell: shell,
        cwd: cwd
      };
      if (token) commonParams.token = token;

      const fetchParams = new URLSearchParams(commonParams);

      // Now that makeUrl handles query params in apiBase correctly, we can just use authedFetch naturally
      authedFetch(`/api/terminal/new?${fetchParams.toString()}`).then(r => r.json()).then(j => {
        sessionId = j.id
        const wsParams = { ...commonParams, session: sessionId };
        const wsUrl = constructWsUrl(apiBase, wsEndpoint, wsParams);

        const socket = new WebSocket(wsUrl);
        attachWS(socket, t('terminal_connected_session', { id: sessionId }));
      }).catch(() => {
        // fallback to ephemeral connection
        const wsParams = { ...commonParams };
        const wsUrl = constructWsUrl(apiBase, wsEndpoint, wsParams);

        const socket = new WebSocket(wsUrl);
        attachWS(socket, t('terminal_connected_ephemeral'));
      })
    })

    const sendResize = () => {
      try {
        fitRef.current?.fit()
        const term = termRef.current
        const ws = wsRef.current
        if (!term || !ws || ws.readyState !== WebSocket.OPEN) return
        const dims = {
          type: 'resize',
          cols: (term as any).cols || 80,
          rows: (term as any).rows || 24,
        }
        ws.send(JSON.stringify(dims))
      } catch (_) { }
    }

    // Use ResizeObserver to detect container size changes (e.g. split pane resize)
    const resizeObserver = new ResizeObserver(() => {
      // Debounce slightly or just call fit? fit() is synchronous and fast usually.
      // requestAnimationFrame avoids "ResizeObserver loop limit exceeded" sometimes
      requestAnimationFrame(() => sendResize())
    })

    if (ref.current) {
      resizeObserver.observe(ref.current)
    }

    return () => {
      resizeObserver.disconnect()
      try { if (ws) ws.close() } catch (_) { }
      wsRef.current = null
      try { term.dispose() } catch (_) { }
    }
  }, [shell, path, t])

  return (
    <div className="terminal-root">
      <div className="terminal-header">
        <strong>{path}</strong>
        <div className="terminal-controls">
          <button className="btn" onClick={async () => {
            // Copy terminal selection to clipboard
            try {
              // xterm exposes .getSelection()? we can read window.getSelection as fallback
              const sel = (termRef.current && (termRef.current as any).getSelection && (termRef.current as any).getSelection()) || window.getSelection()?.toString() || ''
              if (!sel) return
              if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(sel)
              } else {
                // fallback
                const ta = document.createElement('textarea')
                ta.value = sel
                document.body.appendChild(ta)
                ta.select()
                document.execCommand('copy')
                document.body.removeChild(ta)
              }
            } catch (e) {
              console.warn('copy failed', e)
            }
          }}>{t('copy')}</button>
          <button className="btn" onClick={async () => {
            // Paste from clipboard into terminal (send to ws)
            try {
              let text = ''
              if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText()
              else {
                // fallback: prompt user
                text = window.prompt(t('paste_text_here')) || ''
              }
              if (!text) return
              // send to WS if available, otherwise inject directly
              const ws = wsRef.current
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(text)
              } else if (termRef.current) {
                termRef.current.write(text)
              }
            } catch (e) {
              console.warn('paste failed', e)
            }
          }}>{t('paste')}</button>
        </div>
      </div>
      <div className="terminal-body" ref={ref} />
    </div>
  )
}
