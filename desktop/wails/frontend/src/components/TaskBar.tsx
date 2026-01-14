import React from 'react'
import TaskIcon from './TaskIcon'
import { TaskDef } from '../types'
import { useI18n } from '../utils/i18n'

interface TaskBarProps {
    tasks?: TaskDef[]
    onRunTask: (task: TaskDef) => void
}

export default function TaskBar({ tasks, onRunTask }: TaskBarProps) {
    const { t } = useI18n()

    if (!tasks || tasks.length === 0) return null

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 12px', height: '100%',
            overflowX: 'auto',
            borderRight: '1px solid rgba(255,255,255,0.1)'
        }}
            onWheel={(e) => {
                if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                    e.preventDefault(); // Horizontal scroll with wheel
                }
            }}
        >
            {tasks.map(task => (
                <button
                    key={task.id}
                    onClick={() => onRunTask(task)}
                    title={task.name + (task.command ? ` (${task.command})` : '')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <TaskIcon icon={task.icon || 'play'} color={task.color || '#3b82f6'} size={18} />
                </button>
            ))}
        </div>
    )
}
