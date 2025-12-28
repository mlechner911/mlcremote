import React from 'react'

type Props = {
  openFiles: string[]
  active: string
  onActivate: (path: string) => void
  onClose: (path: string) => void
  onCloseOthers?: (path: string) => void
  onCloseLeft?: (path: string) => void
  titles?: Record<string,string>
  types?: Record<string, 'file'|'dir'|'shell'>
}

export default function TabBar({ openFiles, active, onActivate, onClose, onCloseOthers, onCloseLeft, titles, types }: Props) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (e.target instanceof Node && containerRef.current.contains(e.target)) return
      setOpenIdx(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenIdx(null)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="tabbar" ref={containerRef}>
      {openFiles.map((p, idx) => (
        <div key={p} className="tab-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
          <button className={p === active ? 'btn' : 'link'} onClick={() => onActivate(p)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="tab-icon">{(types && types[p]) === 'shell' ? '🐚' : (types && types[p]) === 'dir' ? '📁' : '📄'}</span>
            <span>{(titles && titles[p]) || p.split('/').pop()}</span>
          </button>
          <div style={{ position: 'relative' }}>
            <button aria-haspopup="true" aria-expanded={openIdx === idx} className="btn btn-small" onClick={() => setOpenIdx(openIdx === idx ? null : idx)}>⋮</button>
            {openIdx === idx && (
              <div className="dropdown" style={{ position: 'absolute', right: 0, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button ref={el => { if (el && openIdx === idx) el.focus() }} className="link" onClick={() => { onClose?.(p); setOpenIdx(null) }}>Close</button>
                <button className="link" onClick={() => { onCloseOthers?.(p); setOpenIdx(null) }}>Close Others</button>
                <button className="link" onClick={() => { onCloseLeft?.(p); setOpenIdx(null) }}>Close Left</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
