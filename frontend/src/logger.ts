/**
 * Lightweight in-memory logger used by the frontend for display and debug.
 * This intentionally keeps a small circular buffer and supports subscriptions
 * so UI components can reactively update when new messages arrive.
 */
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

/**
 * Log an informational message.
 */
export function info(msg: string) { pushLog('info', msg) }

/**
 * Log a warning message.
 */
export function warn(msg: string) { pushLog('warn', msg) }

/**
 * Log an error message.
 */
export function error(msg: string) { pushLog('error', msg) }

/**
 * Return a reversed copy of the current log buffer (newest first).
 */
export function getLogs() { return logs.slice().reverse() }

/**
 * Subscribe to log updates. Returns an unsubscribe function.
 */
export function subscribe(cb: () => void) { subs.push(cb); return () => {
  const i = subs.indexOf(cb); if (i >= 0) subs.splice(i,1)
} }

/**
 * Clear the log buffer and notify subscribers.
 */
export function clear() { logs.length = 0; subs.forEach(s => s()) }
