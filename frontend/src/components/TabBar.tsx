import React from 'react'
import { Icon, iconForExtension } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import { useTranslation } from 'react-i18next'
type Props = {
  openFiles: string[]
  active: string
  onActivate: (path: string) => void
  onClose: (path: string) => void
  onCloseOthers?: (path: string) => void
  onCloseLeft?: (path: string) => void
  titles?: Record<string, string>
  fullPaths?: Record<string, string>
  types?: Record<string, 'file' | 'dir' | 'shell'>
  evictedTabs?: string[]
  onRestoreEvicted?: (path: string) => void
}

export default function TabBar({ openFiles, active, onActivate, onClose, onCloseOthers, onCloseLeft, titles, fullPaths, types, evictedTabs = [], onRestoreEvicted }: Props) {
  const { t } = useTranslation()
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [showLeft, setShowLeft] = React.useState(false)
  const [showRight, setShowRight] = React.useState(false)
  const [evictedOpen, setEvictedOpen] = React.useState(false)
  const [visibleCount, setVisibleCount] = React.useState<number | null>(null)

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
    // recompute visible count when resizing
    function recompute() {
      const el = scrollRef.current
      const approx = 140
      if (!el) { setVisibleCount(null); return }
      const avail = el.clientWidth
      const cnt = Math.max(1, Math.floor(avail / approx))
      setVisibleCount(cnt)
    }
    window.addEventListener('resize', recompute)
    recompute()
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('resize', recompute)
    }
  }, [openFiles])

  return (
    <div className="tabbar" ref={containerRef}>
      {/* Evicted/overflow dropdown: compute overflow based on available width */}
      {(() => {
        const approx = 140
        const avail = scrollRef.current ? scrollRef.current.clientWidth : 600
        const cnt = visibleCount ?? Math.max(1, Math.floor(avail / approx))
        const overflow = openFiles.length > cnt ? openFiles.slice(0, openFiles.length - cnt) : []
        if (overflow.length === 0) return null
        return (
          <div className="tab-evicted-dropdown" style={{ display: 'flex', alignItems: 'center', marginRight: 8, position: 'relative' }}>
            <button className="btn" onClick={() => setEvictedOpen(o => !o)}>⋯</button>
            {evictedOpen && (
              <div style={{ position: 'absolute', left: 0, top: '100%', background: 'var(--bg)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: 8, zIndex: 50 }}>
                {overflow.map(t2 => (
                  <div key={t2} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
                    <button className="link" onClick={() => { onRestoreEvicted && onRestoreEvicted(t2); setEvictedOpen(false) }} style={{ flex: 1, textAlign: 'left' }}>{(titles && titles[t2]) || t2.split('/').pop()}</button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-small" title={t('restore')} onClick={() => { onRestoreEvicted && onRestoreEvicted(t2); setEvictedOpen(false) }}>↺</button>
                      <button className="btn btn-small" title={t('close')} onClick={() => { onClose && onClose(t2); setEvictedOpen(false) }}>✕</button>
                      <button className="btn btn-small" title={t('close_others')} onClick={() => { overflow.filter(x => x !== t2).forEach(x => onClose && onClose(x)); setEvictedOpen(false) }}>⋯</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
      {showLeft && <button className="tab-scroll tab-scroll-left" aria-label={t('scroll_left')} onClick={() => scrollBy(-200)}>◀</button>}
      <div className="tab-scroll-area" ref={scrollRef} onScroll={updateScrollButtons}>
        {openFiles.map((p, idx) => (
          <div key={p} className="tab-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
            <button
              className={p === active ? 'btn' : 'link'}
              onClick={() => onActivate(p)}
              onContextMenu={(e) => { e.preventDefault(); setOpenIdx(idx); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              {(() => {
                const full = (titles && titles[p]) || p.split('/').pop() || p
                const display = full.length > 10 ? full.slice(0, 10) + '…' : full
                const cls = (titles && titles[p] && titles[p].startsWith('*')) ? 'tab-title tab-unsaved' : 'tab-title'
                return <span title={fullPaths?.[p] || full} className={cls} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{display}</span>
              })()}
            </button>
            {/* removed small menu button; right-click the tab to open menu */}
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
            <button ref={el => { if (el) el.focus() }} className="link" onClick={() => { onClose?.(p); setOpenIdx(null) }}>{t('close')}</button>
            <button className="link" onClick={() => { onCloseOthers?.(p); setOpenIdx(null) }}>{t('close_others')}</button>
            <button className="link" onClick={() => { onCloseLeft?.(p); setOpenIdx(null) }}>{t('close_left')}</button>
          </div>
        )
      })()}
      {showRight && <button className="tab-scroll tab-scroll-right" aria-label={t('scroll_right')} onClick={() => scrollBy(200)}>▶</button>}
    </div>
  )
}
