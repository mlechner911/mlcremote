type LogEntry = { ts: string; level: 'info'|'warn'|'error'; msg: string }

const BUFFER = 200
const logs: LogEntry[] = []
const subs: Array<() => void> = []

function pushLog(level: LogEntry['level'], msg: string) {
  const entry = { ts: new Date().toISOString(), level, msg }
  logs.push(entry)
  while (logs.length > BUFFER) logs.shift()
  subs.forEach(s => s())
}

export function info(msg: string) { pushLog('info', msg) }
export function warn(msg: string) { pushLog('warn', msg) }
export function error(msg: string) { pushLog('error', msg) }
export function getLogs() { return logs.slice().reverse() }
export function subscribe(cb: () => void) { subs.push(cb); return () => {
  const i = subs.indexOf(cb); if (i >= 0) subs.splice(i,1)
} }
export function clear() { logs.length = 0; subs.forEach(s => s()) }
