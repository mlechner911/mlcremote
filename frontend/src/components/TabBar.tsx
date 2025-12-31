import React from 'react'
import { Icon, iconForExtension } from   '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
type Props = {
  openFiles: string[]
  active: string
  onActivate: (path: string) => void
  onClose: (path: string) => void
  onCloseOthers?: (path: string) => void
  onCloseLeft?: (path: string) => void
  titles?: Record<string,string>
  fullPaths?: Record<string,string>
  types?: Record<string, 'file'|'dir'|'shell'>
  evictedTabs?: string[]
  onRestoreEvicted?: (path: string) => void
}

export default function TabBar({ openFiles, active, onActivate, onClose, onCloseOthers, onCloseLeft, titles, fullPaths, types, evictedTabs = [], onRestoreEvicted }: Props) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [showLeft, setShowLeft] = React.useState(false)
  const [showRight, setShowRight] = React.useState(false)

  const updateScrollButtons = () => {
    const el = scrollRef.current
    if (!el) { setShowLeft(false); setShowRight(false); return }
    setShowLeft(el.scrollLeft > 0)
    setShowRight(el.scrollWidth > el.clientWidth + el.scrollLeft + 1)
  }

  const scrollBy = (dx: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dx, behavior: 'smooth' })
    // update visibility after a short delay
    setTimeout(updateScrollButtons, 220)
  }

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

  React.useEffect(() => {
    updateScrollButtons()
    function onResize() { updateScrollButtons() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [openFiles])

  return (
    <div className="tabbar" ref={containerRef}>
      {evictedTabs && evictedTabs.length > 0 ? (
        <div className="tab-evicted-dropdown" style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
          <select onChange={(e) => { const v = e.target.value; if (!v) return; onRestoreEvicted && onRestoreEvicted(v); e.currentTarget.selectedIndex = 0 }} defaultValue="">
            <option value="">⋯</option>
            {evictedTabs.map(t => <option key={t} value={t}>{t.split('/').pop()}</option>)}
          </select>
        </div>
      ) : null}
      {showLeft && <button className="tab-scroll tab-scroll-left" aria-label="scroll left" onClick={() => scrollBy(-200)}>◀</button>}
      <div className="tab-scroll-area" ref={scrollRef} onScroll={updateScrollButtons}>
        {openFiles.map((p, idx) => (
          <div key={p} className="tab-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
          <button className={p === active ? 'btn' : 'link'} onClick={() => onActivate(p)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span key={`${types?.[p] || 'file'}-${p}`} className="tab-icon">
                {(() => {
                  // Prefer using the generated `iconForExtension` mapping for all
                  // icon selection so we don't hardcode sprite ids here.
                  if ((types && types[p]) === 'shell') {
                    return <Icon name={getIcon('terminal')} />
                  }
                  if ((types && types[p]) === 'dir') {
                    return <Icon name={getIcon('folder')} />
                  }
                  // file: try extension map first
                  const ext = (p.split('.').pop() || '').toLowerCase()
                  const mapped = iconForExtension(ext)
                  return <Icon name={mapped!} />
                })()}
              </span>
              <span title={fullPaths?.[p] || p} className={(titles && titles[p] && titles[p].startsWith('*')) ? 'tab-title tab-unsaved' : 'tab-title'}>{(titles && titles[p]) || p.split('/').pop()}</span>
          </button>
          <div style={{ position: 'relative' }}>
            <button aria-haspopup="true" aria-expanded={openIdx === idx} className="btn btn-small" onClick={() => setOpenIdx(openIdx === idx ? null : idx)}>⋮</button>
          </div>
        </div>
        ))}
      </div>
      {/* Render dropdown at tabbar level so it is not clipped by horizontal scroll */}
      {openIdx !== null && (() => {
        const p = openFiles[openIdx]
        if (!p) return null
        // compute approximate position based on the tab button's bounding box
        const container = containerRef.current
        const scroll = scrollRef.current
        let style: React.CSSProperties = { position: 'absolute', right: 8, top: 40, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }
        try {
          const items = scroll?.querySelectorAll('.tab-item')
          const el = items ? items[openIdx] as HTMLElement : null
          if (el && container) {
            const crect = container.getBoundingClientRect()
            const rect = el.getBoundingClientRect()
            style = { position: 'absolute', left: rect.left - crect.left, top: rect.bottom - crect.top + 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }
          }
        } catch (e) {
          // ignore
        }
        return (
          <div className="dropdown" style={style}>
            <button ref={el => { if (el) el.focus() }} className="link" onClick={() => { onClose?.(p); setOpenIdx(null) }}>Close</button>
            <button className="link" onClick={() => { onCloseOthers?.(p); setOpenIdx(null) }}>Close Others</button>
            <button className="link" onClick={() => { onCloseLeft?.(p); setOpenIdx(null) }}>Close Left</button>
          </div>
        )
      })()}
      {showRight && <button className="tab-scroll tab-scroll-right" aria-label="scroll right" onClick={() => scrollBy(200)}>▶</button>}
    </div>
  )
}
