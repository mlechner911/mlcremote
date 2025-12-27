import React from 'react'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'

type Props = {
  shell: string
  path: string
}

export default function TerminalTab({ shell, path }: Props) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const termRef = React.useRef<Terminal | null>(null)

  React.useEffect(() => {
    if (!ref.current) return
    const term = new Terminal({ cols: 80, rows: 24 })
    term.open(ref.current)
    termRef.current = term

    // request a new persistent session from the server
    let sessionId: string | null = null
    fetch(`/api/terminal/new?shell=${encodeURIComponent(shell)}`).then(r => r.json()).then(j => {
      sessionId = j.id
      const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws/terminal?session=${encodeURIComponent(sessionId!)}`)
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => { term.write('\r\nConnected to shell session: ' + sessionId + '\r\n') }
      ws.onmessage = (ev) => {
        const data = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer)
        term.write(data)
      }
      term.onData(d => { ws.send(d) })
    }).catch(e => {
      // fallback to ephemeral connection
      const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws/terminal?shell=${encodeURIComponent(shell)}`)
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => { term.write('\r\nConnected to ephemeral shell\r\n') }
      ws.onmessage = (ev) => {
        const data = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer)
        term.write(data)
      }
      term.onData(d => { ws.send(d) })
    })
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      term.write('\r\nConnected to shell: ' + shell + '\r\n')
    }
    ws.onmessage = (ev) => {
      const data = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer)
      term.write(data)
    }
    term.onData(d => { ws.send(d) })

    return () => {
      try { ws.close() } catch (_) {}
      try { term.dispose() } catch (_) {}
    }
  }, [shell])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 6, borderBottom: '1px solid rgba(255,255,255,0.03)', background: '#0b1220' }}>
        <strong>{path}</strong>
      </div>
      <div style={{ flex: 1, background: '#000' }} ref={ref} />
    </div>
  )
}
