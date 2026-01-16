import React from 'react'
import { getLogs, subscribe, clear } from '../utils/logger'
import { useTranslation } from 'react-i18next'
// probably unused at some point ,, for now .. let me check our backend calls..
type Props = { visible?: boolean; onClose?: () => void }

export default function LogOverlay({ visible = true, onClose }: Props) {
  const { t } = useTranslation()
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const unsub = subscribe(() => setTick(t => t + 1))
    return unsub
  }, [])

  if (!visible) return null

  const logs = getLogs().slice(0, 100)
  // simple renderer: color by level and highlight file:line patterns
  function renderMessage(msg: string) {
    // highlight file:line (e.g. src/file.ts:123)
    const parts: Array<{ text: string; cls?: string }> = []
    const regex = /([\w\/\.\-]+:\d+)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(msg)) !== null) {
      if (m.index > last) parts.push({ text: msg.slice(last, m.index) })
      parts.push({ text: m[0], cls: 'log-path' })
      last = m.index + m[0].length
    }
    if (last < msg.length) parts.push({ text: msg.slice(last) })
    return parts.map((p, i) => p.cls ? <span key={i} className={p.cls}>{p.text}</span> : <span key={i}>{p.text}</span>)
  }

  return (
    <div className="log-overlay">
      <div className="log-header">
        <strong>{t('logs')}</strong>
        <div>
          <button className="btn" onClick={() => clear()}>{t('clear')}</button>
          <button className="btn" onClick={() => onClose && onClose()} style={{ marginLeft: 8 }}>{t('close')}</button>
        </div>
      </div>
      <div>
        {logs.map((l, i) => (
          <div key={i} className={`log-entry log-level-${(l.level || '').toLowerCase()}`}>
            <div className="log-meta">{l.ts} <span className="log-level">{l.level}</span></div>
            <div className="log-message">{renderMessage(l.msg)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
