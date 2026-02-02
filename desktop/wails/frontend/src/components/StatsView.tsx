import React, { useEffect, useState, useRef } from 'react'
import { Stats } from '../types'
import { useI18n } from '../utils/i18n'

interface StatsViewProps {
    stats: Stats
    historySize?: number
}

const Chart = ({ data, color, label, format }: { data: number[], color: string, label: string, format: (v: number) => string }) => {
    const width = 200
    const height = 60
    const max = 100
    const min = 0

    // Create points for SVG path
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((val - min) / (max - min)) * height
        return `${x},${y}`
    }).join(' ')

    // Area path (closed at bottom)
    const areaPath = `${points} ${width},${height} 0,${height}`

    return (
        <div style={{ background: 'rgba(0,0,0,0.1)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                <span>{label}</span>
                <span>{format(data[data.length - 1])}</span>
            </div>
            <div style={{ height: height, position: 'relative' }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                    <path d={`M ${points}`} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    <path d={`M ${areaPath}`} fill={color} fillOpacity="0.1" stroke="none" />
                </svg>
            </div>
        </div>
    )
}

export default function StatsView({ stats, historySize = 30 }: StatsViewProps) {
    const { t } = useI18n()
    const [history, setHistory] = useState<{ cpu: number[], mem: number[], disk: number[] }>({ cpu: [], mem: [], disk: [] })
    const lastTimestamp = useRef(0)

    useEffect(() => {
        if (stats.timestamp === lastTimestamp.current) return
        lastTimestamp.current = stats.timestamp

        setHistory(prev => {
            const push = (arr: number[], val: number) => {
                const newArr = [...arr, val]
                if (newArr.length > historySize) newArr.shift()
                return newArr
            }
            return {
                cpu: push(prev.cpu, stats.cpu),
                mem: push(prev.mem, stats.memory),
                disk: push(prev.disk, stats.disk)
            }
        })
    }, [stats, historySize])

    // Fill initial history with current value if empty? Or just build up.
    // If empty, just show current.

    const cpuData = history.cpu.length > 0 ? history.cpu : [stats.cpu]
    const memData = history.mem.length > 0 ? history.mem : [stats.memory]
    const diskData = history.disk.length > 0 ? history.disk : [stats.disk]

    // Ensure at least 2 points for line
    if (cpuData.length === 1) cpuData.unshift(cpuData[0])
    if (memData.length === 1) memData.unshift(memData[0])
    if (diskData.length === 1) diskData.unshift(diskData[0])

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
            <Chart data={cpuData} color="#3b82f6" label="CPU" format={v => `${v.toFixed(1)}%`} />
            <Chart data={memData} color="#10b981" label="RAM" format={v => `${v.toFixed(1)}%`} />
            <Chart data={diskData} color="#8b5cf6" label="Disk" format={v => `${v.toFixed(1)}%`} />
        </div>
    )
}
