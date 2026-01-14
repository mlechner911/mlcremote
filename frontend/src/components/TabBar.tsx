import React from 'react'
import { Icon, iconForExtension } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'
import { useTranslation } from 'react-i18next'
import ContextMenu from './ContextMenu'
import { Tab } from '../types/layout'

type Props = {
  tabs: Tab[]
  activeId: string
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onCloseOthers?: (id: string) => void
  onCloseLeft?: (id: string) => void
  onSplitRight?: (id?: string) => void
  onSplitDown?: (id?: string) => void
}

export default function TabBar({ tabs, activeId, onActivate, onClose, onCloseOthers, onCloseLeft, onSplitRight, onSplitDown }: Props) {
  const { t } = useTranslation()
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

    // Use ResizeObserver to detect container size changes (e.g. sidebar resize)
    const resizeObserver = new ResizeObserver(() => {
      updateScrollButtons()
      // recompute visible count logic if still needed (though we rely on CSS scroll now)
    })

    if (scrollRef.current) {
      resizeObserver.observe(scrollRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [tabs])

  return (
    <div className="tabbar" ref={containerRef}>

      {showLeft && <button className="tab-scroll tab-scroll-left" aria-label={t('scroll_left')} onClick={() => scrollBy(-200)}>◀</button>}
      <div className="tab-scroll-area" ref={scrollRef} onScroll={updateScrollButtons}>
        {tabs.map((tab, idx) => (
          <div key={tab.id} className="tab-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
            <button
              className={tab.id === activeId ? 'btn' : 'link'}
              onClick={() => onActivate(tab.id)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setOpenIdx(idx); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="tab-icon">
                {(() => {
                  // Debug logging
                  if (tab.label === 'Desktop' || tab.type === 'terminal') {
                    //        console.log('TabBar rendering tab:', { id: tab.id, path: tab.path, type: tab.type, label: tab.label, icon: tab.icon })
                  }

                  if (tab.icon) {
                    const iconName = tab.icon.startsWith('icon-') ? tab.icon : getIcon(tab.icon)
                    // Apply color if present
                    const style = tab.iconColor ? { color: tab.iconColor } : undefined
                    return (
                      <span style={style} className="flex items-center">
                        <Icon name={iconName} />
                      </span>
                    )
                  }
                  // Check for shell- id pattern as well as path
                  if (tab.type === 'terminal' || tab.path.startsWith('shell-') || tab.id.startsWith('shell-')) return <Icon name={getIcon('terminal')} />
                  if (tab.type === 'custom' && tab.id === 'metadata') return <Icon name={getIcon('view')} />
                  if (tab.type === 'binary') return <Icon name={getIcon('file')} /> // fallback
                  const ext = (tab.path.split('.').pop() || '').toLowerCase()
                  const mapped = iconForExtension(ext)
                  return <Icon name={mapped!} />
                })()}
              </span>
              {(() => {
                const isDirty = tab.dirty
                const cls = isDirty ? 'tab-title tab-unsaved' : 'tab-title'
                const display = tab.label.length > 20 ? tab.label.slice(0, 20) + '…' : tab.label
                return <span title={tab.path} className={cls} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{isDirty ? `*${display}` : display}</span>
              })()}
            </button>
            {/* removed small menu button; right-click the tab to open menu */}
          </div>
        ))}
      </div>
      {/* Render dropdown at tabbar level so it is not clipped by horizontal scroll */}
      {/* Context Menu for Tabs */}
      {openIdx !== null && (() => {
        const tab = tabs[openIdx]
        if (!tab) return null

        // Calculate screen coordinates for the context menu
        // We generally want it near the mouse, but here we triggered it via UI context (or right click)
        // If triggered via right-click, we don't have the event here easily (it was in setOpenIdx).
        // Actually, we need to correct how setOpenIdx is set.
        // Let's modify the state to store coordinates?
        // Or just position it under the tab button.

        let x = 0
        let y = 0

        try {
          const items = scrollRef.current?.querySelectorAll('.tab-item')
          const el = items ? items[openIdx] as HTMLElement : null
          if (el) {
            const rect = el.getBoundingClientRect()
            x = rect.left
            y = rect.bottom + 4
          }
        } catch (e) { }

        return (
          <ContextMenu
            x={x}
            y={y}
            onClose={() => setOpenIdx(null)}
            items={[
              { label: t('close', 'Close'), action: () => onClose && onClose(tab.id) },

              // Only show advanced options for non-custom/shell/binary tabs (or at least filter appropriately)
              // Actually, user specifically mentioned "Trash" having useless info.
              // Let's hide Copy Path/Split/Close Others for "custom" types or simpler reasoning?
              // Logic:
              // - Close: Always
              // - Close Others: Only if >1 tab
              // - Copy Path: Only if real file (type='editor' or type='binary' with valid path? not trash)
              // - Split: Only if editor/terminal? (Actually split works for anything but is it useful for trash?)

              ...(tabs.length > 1 ? [
                { label: '-', action: () => { }, separator: true },
                { label: t('close_others', 'Close Others'), action: () => onCloseOthers && onCloseOthers(tab.id) }
              ] : []),

              ...(tab.type === 'editor' || tab.type === 'binary' || tab.type === 'terminal' ? [
                { label: '-', action: () => { }, separator: true },
                { label: t('copy_path', 'Copy Path'), action: () => { navigator.clipboard.writeText(tab.path) } },
                { label: t('copy_rel_path', 'Copy Relative Path'), action: () => { navigator.clipboard.writeText(tab.path) } },
                { label: '-', action: () => { }, separator: true },
                { label: t('split_right', 'Split Right'), action: () => onSplitRight && onSplitRight(tab.id) },
                { label: t('split_down', 'Split Down'), action: () => onSplitDown && onSplitDown(tab.id) }
              ] : []),

              ...(openIdx > 0 ? [
                { label: '-', action: () => { }, separator: true },
                { label: t('close_left', 'Close to the Left'), action: () => onCloseLeft && onCloseLeft(tab.id) }
              ] : [])
            ]}
          />
        )
      })()}
      {showRight && <button className="tab-scroll tab-scroll-right" aria-label={t('scroll_right')} onClick={() => scrollBy(200)}>▶</button>}
    </div>
  )
}
