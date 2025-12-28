import React from 'react'

type Props = {
  openFiles: string[]
  active: string
  onActivate: (path: string) => void
  onClose: (path: string) => void
  titles?: Record<string,string>
  types?: Record<string, 'file'|'dir'|'shell'>
}

export default function TabBar({ openFiles, active, onActivate, onClose, titles, types }: Props) {
  return (
    <div className="tabbar">
      {openFiles.map(p => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 16 }}>{(types && types[p]) === 'shell' ? '🐚' : (types && types[p]) === 'dir' ? '📁' : '📄'}</span>
          <button className={p === active ? 'btn' : 'link'} onClick={() => onActivate(p)}>{(titles && titles[p]) || p.split('/').pop()}</button>
          <button className="btn btn-small" onClick={() => onClose(p)}>x</button>
        </div>
      ))}
    </div>
  )
}
