import React from 'react'
import { Icon } from '../generated/icons'

export const DEFAULT_COLORS = [
    '#007bff', // blue
    '#6f42c1', // purple
    '#28a745', // green
    '#dc3545', // red
    '#ffc107', // yellow
    '#17a2b8', // cyan
    '#fd7e14', // orange
]

interface ColorPickerProps {
    value: string
    onChange: (color: string) => void
}

import { useI18n } from '../utils/i18n'

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
    const { t } = useI18n()
    const isCustom = !DEFAULT_COLORS.includes(value) && value !== ''

    return (
        <div style={{ display: 'flex', gap: 6 }}>
            {DEFAULT_COLORS.map(c => (
                <div
                    key={c}
                    onClick={() => onChange(c)}
                    style={{
                        width: 20, height: 20, borderRadius: '50%', background: c,
                        cursor: 'pointer',
                        border: value === c ? '2px solid white' : '2px solid transparent',
                        outline: value === c ? '1px solid var(--accent)' : 'none',
                        transition: 'transform 0.1s'
                    }}
                    title={c}
                />
            ))}

            {/* Custom Picker */}
            <div style={{ position: 'relative', width: 20, height: 20 }}>
                <input
                    type="color"
                    value={isCustom ? value : '#ffffff'}
                    onChange={e => onChange(e.target.value)}
                    style={{
                        position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
                        width: '100%', height: '100%', padding: 0, margin: 0
                    }}
                    title={t('custom_color') || "Custom Color"}
                />
                <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: isCustom ? value : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                    border: isCustom ? '2px solid white' : '2px solid transparent',
                    outline: isCustom ? '1px solid var(--accent)' : 'none',
                    pointerEvents: 'none'
                }} />
            </div>
        </div>
    )
}
