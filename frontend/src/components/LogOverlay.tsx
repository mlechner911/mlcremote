import React from 'react'
import { getLogs, subscribe, clear } from '../logger'

type Props = { visible?: boolean; onClose?: () => void }

export default function LogOverlay({ visible = true, onClose }: Props) {
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const unsub = subscribe(() => setTick(t => t + 1))
    return unsub
  }, [])

  if (!visible) return null

  const logs = getLogs().slice(0, 100)
  return (
    <div className="log-overlay">
      <div className="log-header">
        <strong>Logs</strong>
        <div>
          <button className="btn" onClick={() => clear()}>Clear</button>
          <button className="btn" onClick={() => onClose && onClose()} style={{ marginLeft: 8 }}>Close</button>
        </div>
      </div>
      <div>
        {logs.map((l, i) => (
          <div key={i} className="log-entry">
            <div className="log-meta">{l.ts} <span className="log-level">{l.level}</span></div>
            <div>{l.msg}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
