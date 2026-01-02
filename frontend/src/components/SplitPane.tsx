import React, { useState, useRef, useEffect } from 'react'

interface SplitPaneProps {
    direction?: 'horizontal' | 'vertical'
    initialSize?: number // percentage (0-100) or pixels
    minSize?: number
    onResize?: (size: number) => void
    children: [React.ReactNode, React.ReactNode]
    className?: string
}

export default function SplitPane({ direction = 'vertical', initialSize = 50, minSize = 10, onResize, children, className }: SplitPaneProps) {
    // We use percentage for responsiveness
    // Initialize state from prop
    const [size, setSize] = useState(initialSize)

    // Update local state when prop changes (external layout update)
    useEffect(() => {
        setSize(initialSize)
    }, [initialSize])

    const containerRef = useRef<HTMLDivElement>(null)
    const isDragging = useRef(false)
    const currentSize = useRef(initialSize)

    const isVertical = direction === 'vertical' // vertical split = left/right panes (row layout)

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        isDragging.current = true
        currentSize.current = size
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize'
        document.body.style.userSelect = 'none'

        // Create an invisible overlay to prevent iframes/webviews from stealing mouse events
        const overlay = document.createElement('div')
        overlay.id = 'split-drag-overlay'
        overlay.style.position = 'fixed'
        overlay.style.top = '0'
        overlay.style.left = '0'
        overlay.style.width = '100%'
        overlay.style.height = '100%'
        overlay.style.zIndex = '9999'
        overlay.style.cursor = isVertical ? 'col-resize' : 'row-resize'
        document.body.appendChild(overlay)
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()

        let newSize = 0
        if (isVertical) {
            // Vertical split (side-by-side): calculate width percentage
            const relativeX = e.clientX - rect.left
            newSize = (relativeX / rect.width) * 100
        } else {
            // Horizontal split (stacked): calculate height percentage
            const relativeY = e.clientY - rect.top
            newSize = (relativeY / rect.height) * 100
        }

        // Clamp
        newSize = Math.max(minSize, Math.min(100 - minSize, newSize))
        setSize(newSize)
        currentSize.current = newSize
    }

    const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        const overlay = document.getElementById('split-drag-overlay')
        if (overlay) overlay.remove()

        // Commit size change
        if (onResize) {
            onResize(currentSize.current)
        }
    }

    return (
        <div
            ref={containerRef}
            className={`split-pane-container ${direction} ${className || ''}`}
            style={{
                display: 'flex',
                flexDirection: isVertical ? 'row' : 'column',
                width: '100%',
                height: '100%',
                overflow: 'hidden'
            }}
        >
            <div style={{ flexBasis: `${size}%`, flexGrow: 0, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                {children[0]}
            </div>

            <div
                className="split-resizer"
                style={{
                    flexBasis: '4px',
                    cursor: isVertical ? 'col-resize' : 'row-resize',
                    background: 'var(--border-color, #444)',
                    zIndex: 100, // Increased z-index
                    transition: 'background 0.2s',
                    position: 'relative',
                    // Ensure full stretch
                    alignSelf: 'stretch'
                }}
                onMouseDown={handleMouseDown}
            >
                {/* Hit area extension used to make it easier to grab */}
                <div style={{
                    position: 'absolute',
                    top: isVertical ? 0 : -4,
                    bottom: isVertical ? 0 : -4,
                    left: isVertical ? -4 : 0,
                    right: isVertical ? -4 : 0,
                    zIndex: 10
                }} />
            </div>

            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {children[1]}
            </div>
        </div>
    )
}
