import * as React from 'react'
import { Icon } from '../generated/icons'
import { getIcon } from '../generated/icon-helpers'

type Props = {
  autoOpen: boolean
  showHidden: boolean
  onToggleAutoOpen: (v: boolean) => void
  onToggleShowHidden: (v: boolean) => void
  showLogs: boolean
  onToggleLogs: (v: boolean) => void
  hideMemoryUsage: boolean
  onToggleHideMemoryUsage: (v: boolean) => void
  onClose: () => void
}

export default function SettingsPopup({ autoOpen, showHidden, onToggleAutoOpen, onToggleShowHidden, showLogs, onToggleLogs, hideMemoryUsage, onToggleHideMemoryUsage, onClose }: Props) {
  const [localHideMemoryUsage, setLocalHideMemoryUsage] = React.useState<boolean>(hideMemoryUsage)

  // Quick docs removed — settings simplified

  return (
    <div style={{ position: 'absolute', right: 12, top: 40, zIndex: 60 }}>
      <div style={{ width: 320, background: 'var(--bg)', border: '1px solid var(--muted)', borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Settings</strong>
          <button aria-label="Close settings" title="Close" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Icon name={getIcon('close')} title="Close" size={16} /></button>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={autoOpen} onChange={e => onToggleAutoOpen(e.target.checked)} />{' '}
            Auto open files
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showHidden} onChange={e => onToggleShowHidden(e.target.checked)} />{' '}
            Show hidden files
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showLogs} onChange={e => onToggleLogs(e.target.checked)} /> Show server logs
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={localHideMemoryUsage} onChange={e => { setLocalHideMemoryUsage(e.target.checked); onToggleHideMemoryUsage(e.target.checked) }} /> Hide memory usage gauge
          </label>
        </div>
      </div>
    </div>
  )
}
