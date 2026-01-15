import React, { useState, useEffect } from 'react'
import { Icon } from '../generated/icons'
import { TaskDef } from '../types'
import { useI18n } from '../utils/i18n'
import ColorPicker, { DEFAULT_COLORS } from './ColorPicker'

interface TaskEditorProps {
    task?: TaskDef
    onSave: (t: TaskDef) => void
    onCancel: () => void
}

const AVAILABLE_ICONS = [
    'play', 'stop', 'terminal', 'server', 'log', 'refresh', 'settings',
    'upload', 'download', 'trash', 'copy', 'info', 'link'
]

export default function TaskEditor({ task, onSave, onCancel }: TaskEditorProps) {
    const { t } = useI18n()
    const [name, setName] = useState(task?.name || '')
    const [command, setCommand] = useState(task?.command || '')
    const [color, setColor] = useState(task?.color || DEFAULT_COLORS[0])
    const [icon, setIcon] = useState(task?.icon || 'play')
    const [showOnLaunch, setShowOnLaunch] = useState(task?.showOnLaunch || false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave({
            id: task?.id || crypto.randomUUID(),
            name,
            command,
            color,
            icon,
            showOnLaunch
        })
    }

    return (
        <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-panel)', marginTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>{task ? t('edit_task') : t('new_task')}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>

                {/* Name & Color */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                    <div>
                        <label className="label">{t('name')}</label>
                        <input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Restart Server" />
                    </div>
                    <div>
                        <label className="label">{t('color')}</label>
                        <ColorPicker value={color} onChange={setColor} />
                    </div>
                </div>

                {/* Command */}
                {/* Command */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="label">{t('command')}</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={showOnLaunch}
                                onChange={e => setShowOnLaunch(e.target.checked)}
                            />
                            {t('show_on_launch', 'Show on Launch Screen')}
                        </label>
                    </div>
                    <textarea
                        className="input"
                        required
                        value={command}
                        onChange={e => setCommand(e.target.value)}
                        placeholder="systemctl restart nginx"
                        style={{ height: 80, fontFamily: 'monospace', resize: 'vertical' }}
                    />
                    <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                        {t('command_hint') || "Runs on the remote server via SSH. Supports multiple lines."}
                    </div>
                </div>

                {/* Icon Picker */}
                <div>
                    <label className="label">{t('icon')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {AVAILABLE_ICONS.map(i => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setIcon(i)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 32, height: 32,
                                    borderRadius: 6,
                                    border: icon === i ? `2px solid ${color}` : '1px solid var(--border)',
                                    background: icon === i ? `${color}22` : 'transparent',
                                    cursor: 'pointer',
                                    color: icon === i ? color : 'var(--text-secondary)'
                                }}
                                title={i}
                            >
                                <Icon name={`icon-${i}`} size={16} />
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                    <button type="button" className="btn link" onClick={onCancel}>{t('cancel')}</button>
                    <button type="submit" className="btn primary">{t('save')}</button>
                </div>
            </form>
        </div>
    )
}
