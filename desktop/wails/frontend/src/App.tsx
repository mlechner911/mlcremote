import React, { useState, useEffect } from 'react'
import LaunchScreen from './components/LaunchScreen'
import AppLock from './components/AppLock'
import SettingsDialog from './components/SettingsDialog' // Keep existing logic if needed or integrate
import RemoteView from './components/RemoteView'
import { StopTunnel, HasMasterPassword } from './wailsjs/go/app/App'
import spriteUrl from './generated/icons-sprite.svg'

// Inject SVG sprite
fetch(spriteUrl).then(r => r.text()).then(svg => {
  const div = document.createElement('div');
  div.style.display = 'none';
  div.innerHTML = svg;
  document.body.prepend(div);
}).catch(console.error);

export interface Profile {
  user: string
  host: string
  localPort: number
  remoteHost: string
  remotePort: number
  identityFile: string
  extraArgs: string[]
}

let runtime: any = null
function loadRuntimeIfPresent() {
  if (runtime) return runtime
  try {
    runtime = (window as any).runtime || (window as any).wails?.runtime || null
    if (!runtime) runtime = (window as any).runtime
  } catch (e) { runtime = null }
  return runtime
}

export default function App() {
  const [view, setView] = useState<'init' | 'locked' | 'launch' | 'remote' | 'settings'>('init')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [profileName, setProfileName] = useState('')

  useEffect(() => {
    // 1. Setup Runtime Events
    const rt = loadRuntimeIfPresent()
    if (rt && rt.EventsOn) {
      const handler = async (args: any) => {
        const url = Array.isArray(args) && args.length > 0 ? args[0] : args
        if (typeof url === 'string') {
          // Verify version
          try {
            const res = await fetch(`${url}/api/version`, { method: 'GET' })
            if (!res.ok) throw new Error('version check failed')
            const json = await res.json()
            if (json && json.frontendCompatible) {
              setRemoteUrl(url);
              setView('remote');
              return
            }
            try { runtime.EventsEmit('navigate-error', 'incompatible') } catch (e) { }
          } catch (e: any) { try { runtime.EventsEmit('navigate-error', String(e.message || e)) } catch (e) { } }
        }
      }
      rt.EventsOn('navigate', handler)
      return () => { try { rt.EventsOff('navigate', handler) } catch (e) { } }
    }
  }, [])

  useEffect(() => {
    // 2. Check Lock Status
    const checkLock = async () => {
      try {
        const locked = await HasMasterPassword()
        if (locked) setView('locked')
        else setView('launch')
      } catch (e) {
        console.error("Failed to check lock status", e)
        setView('launch') // Fallback
      }
    }
    checkLock()
  }, [])

  const handleConnected = (p: Profile) => {
    setProfileName(`${p.user}@${p.host}`)
    // View switch happens via 'navigate' event from backend usually, 
    // but we can set remoteUrl if we knew it to show loading?
    // backend emits 'navigate' with the URL once tunnel + health check passes.
    // So we just wait.
  }

  const handleDisconnect = async () => {
    try { await StopTunnel() } catch (e) { console.error(e) }
    setRemoteUrl('')
    setProfileName('')
    setView('launch')
  }

  if (view === 'init') return <div style={{ background: 'var(--bg-root)', height: '100vh' }} />

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', background: 'var(--bg-root)', color: 'var(--text-primary)' }}>
      {view === 'locked' && (
        <AppLock onUnlock={() => setView('launch')} />
      )}

      {view === 'launch' && (
        <LaunchScreen
          onConnected={handleConnected}
          onLocked={() => setView('locked')}
        />
      )}

      {view === 'remote' && (
        <RemoteView
          url={remoteUrl}
          profileName={profileName}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* Settings Dialog integration if needed later */}
    </div>
  )
}


