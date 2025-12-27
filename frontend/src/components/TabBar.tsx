import React from 'react'

type Props = {
  openFiles: string[]
  active: string
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

export default function TabBar({ openFiles, active, onActivate, onClose }: Props) {
  return (
    <div className="tabbar">
      {openFiles.map(p => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className={p === active ? 'btn' : 'link'} onClick={() => onActivate(p)}>{p.split('/').pop()}</button>
          <button className="btn btn-small" onClick={() => onClose(p)}>x</button>
        </div>
      ))}
    </div>
  )
}
