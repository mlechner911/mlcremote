import React, { useState } from 'react'
import { Icon } from '../generated/icons'
import { useI18n } from '../utils/i18n'

// Define the shape locally until generated bindings are available/updated
// should come from swagger at some point..
export interface ConnectionProfile {
    id?: string
    name: string
    color: string
    user: string
    host: string
    port: int
    localPort: int
    identityFile: string
    isWindows: boolean
    lastUsed: number
    extraArgs: string[]
    remoteOS?: string
    remoteArch?: string
    remoteVersion?: string
}

type int = number

interface ProfileEditorProps {
    profile?: ConnectionProfile
    onSave: (p: ConnectionProfile) => void
    onCancel: () => void
}

const COLORS = [
    '#007bff', // blue
    '#6f42c1', // purple
    '#28a745', // green
    '#dc3545', // red
    '#ffc107', // yellow
    '#17a2b8', // cyan
    '#fd7e14', // orange
    '#6c757d', // gray
]

export default function ProfileEditor({ profile, onSave, onCancel }: ProfileEditorProps) {
    const { t } = useI18n()
    const [name, setName] = useState(profile?.name || '')
    const [color, setColor] = useState(profile?.color || COLORS[0])
    const [user, setUser] = useState(profile?.user || '')
    const [host, setHost] = useState(profile?.host || '')
    const [port, setPort] = useState(profile?.port || 22)
    const [localPort, setLocalPort] = useState(profile?.localPort || 8443)
    const [identityFile, setIdentityFile] = useState(profile?.identityFile || '')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave({
            ...profile,
            name: name || `${user}@${host}`, // default name if empty
            color,
            user,
            host,
            port: Number(port),
            localPort: Number(localPort),
            identityFile,
            isWindows: profile?.isWindows || false,
            lastUsed: profile?.lastUsed || 0,
            extraArgs: profile?.extraArgs || []
        })
    }

    return (
        <div style={{ padding: 24, paddingBottom: 0 }}>
            <h2 style={{ marginTop: 0, marginBottom: 20 }}>{profile ? t('edit_connection') : t('new_connection')}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
                {/* Name & Color */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                    <div>
                        <label className="label">{t('name')}</label>
                        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="My Remote Server" />
                    </div>
                    <div>
                        <label className="label">{t('color')}</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {COLORS.map(c => (
                                <div
                                    key={c}
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: 20, height: 20, borderRadius: '50%', background: c,
                                        cursor: 'pointer',
                                        border: color === c ? '2px solid white' : '2px solid transparent',
                                        outline: color === c ? '1px solid var(--accent)' : 'none'
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* User & Host */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <div>
                        <label className="label">{t('user')}</label>
                        <input className="input" required value={user} onChange={e => setUser(e.target.value)} placeholder="root" />
                    </div>
                    <div>
                        <label className="label">{t('host')}</label>
                        <input className="input" required value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.100" />
                    </div>
                </div>

                {/* SSH Port & Local Port */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label className="label">{t('port')}</label>
                        <input className="input" type="number" value={port} onChange={e => setPort(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="label">{t('localPort')}</label>
                        <input className="input" type="number" value={localPort} onChange={e => setLocalPort(Number(e.target.value))} />
                    </div>
                </div>

                <div>
                    <label className="label">{t('identityFile')}</label>
                    <input className="input" value={identityFile} onChange={e => setIdentityFile(e.target.value)} placeholder="/path/to/private/key" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                    <button type="button" className="btn link" onClick={onCancel}>{t('cancel')}</button>
                    <button type="submit" className="btn primary">{t('save_profile')}</button>
                </div>
            </form>

            <style>{`
        .label { display: block; font-size: 0.85rem; color: var(--text-muted); marginBottom: 4px; }
        .input { 
          width: 100%; padding: 8px 10px; borderRadius: 4px;
          border: 1px solid var(--border); background: var(--bg-root); color: var(--text-primary);
        }
        .input:focus { border-color: var(--accent); outline: none; }
      `}</style>
        </div>
    )
}
