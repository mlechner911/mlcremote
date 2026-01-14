import React from 'react'
import { Icon } from '../generated/icons'

interface TaskIconProps {
    icon: string
    color: string
    size?: number
    active?: boolean
}

export default function TaskIcon({ icon, color, size = 16, active }: TaskIconProps) {
    return (
        <div style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: size + 8, height: size + 8,
            filter: active ? `drop-shadow(0 0 6px ${color}88)` : 'none',
            transition: 'filter 0.2s ease-in-out'
        }}>
            <Icon
                name={'icon-' + icon.replace('icon-', '')}
                size={size}
                className="task-icon"
            // We'll apply color via style prop if Icon supports it or wrapper
            />
            {/* Overlay for colortint if SVG is monotone */}
            <style>{`
                .task-icon {
                    color: ${color};
                }
                .theme-light .task-icon {
                     /* Light mode specific halo if needed */
                     filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
                }
            `}</style>
        </div>
    )
}
