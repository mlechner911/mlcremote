import React from 'react'

export type ContextMenuItem = {
    label: string
    action: () => void
    icon?: React.ReactNode
    danger?: boolean
    separator?: boolean
}

type Props = {
    x: number
    y: number
    items: ContextMenuItem[]
    onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
    const ref = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        function onMouseDown(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose()
            }
        }
        window.addEventListener('mousedown', onMouseDown)
        // also close on scroll/resize to avoid floating menu in wrong place
        window.addEventListener('scroll', onClose, true)
        window.addEventListener('resize', onClose)
        return () => {
            window.removeEventListener('mousedown', onMouseDown)
            window.removeEventListener('scroll', onClose, true)
            window.removeEventListener('resize', onClose)
        }
    }, [onClose])

    // Adjust position to keep within viewport
    const [adjusted, setAdjusted] = React.useState({ x, y })
    React.useLayoutEffect(() => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect()
            let newX = x
            let newY = y
            if (newX + rect.width > window.innerWidth) newX = window.innerWidth - rect.width - 8
            if (newY + rect.height > window.innerHeight) newY = window.innerHeight - rect.height - 8
            setAdjusted({ x: newX, y: newY })
        }
    }, [x, y])

    return (
        <div
            ref={ref}
            style={{
                position: 'fixed',
                left: adjusted.x,
                top: adjusted.y,
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                borderRadius: 6,
                padding: 4,
                zIndex: 99999,
                minWidth: 160,
                display: 'flex',
                flexDirection: 'column',
            }}
            onContextMenu={(e) => { e.preventDefault(); onClose() }} // Close if right-clicked again elsewhere (or handled by parent) but here we just prevent default
        >
            {items.map((item, i) => (
                item.separator ? (
                    <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                ) : (
                    <button
                        key={i}
                        className="context-menu-item"
                        onClick={() => {
                            onClose()
                            item.action()
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            border: 'none',
                            background: 'transparent',
                            color: item.danger ? 'var(--danger)' : 'var(--text)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            borderRadius: 4,
                            fontSize: 13,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.1)' : 'var(--bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        {item.icon && <span style={{ width: 16, display: 'flex' }}>{item.icon}</span>}
                        {item.label}
                    </button>
                )
            ))}
        </div>
    )
}
