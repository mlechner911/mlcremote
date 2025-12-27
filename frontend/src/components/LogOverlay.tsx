import React from 'react'
import { getLogs, subscribe, clear } from '../logger'

export default function LogOverlay() {
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const unsub = subscribe(() => setTick(t => t + 1))
    return unsub
  }, [])

  const logs = getLogs().slice(0, 100)
  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, width: 520, maxHeight: '40vh', overflow: 'auto', background: 'rgba(10,12,16,0.9)', border: '1px solid rgba(255,255,255,0.03)', padding: 8, borderRadius: 8, color: '#cbd5e1', fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>Logs</strong>
        <div>
          <button className="btn" onClick={() => clear()}>Clear</button>
        </div>
      </div>
      <div>
        {logs.map((l, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ color: '#94a3b8' }}>{l.ts} <span style={{ color: '#7c3aed' }}>{l.level}</span></div>
            <div>{l.msg}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
