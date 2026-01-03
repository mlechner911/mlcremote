import React, { useState, useEffect } from 'react'
import LaunchScreen from './components/LaunchScreen'
import AppLock from './components/AppLock'
import SettingsDialog from './components/SettingsDialog'
import RemoteView from './components/RemoteView'
import { StopTunnel, HasMasterPassword } from './wailsjs/go/app/App'
import { I18nProvider, useI18n } from './utils/i18n'
// @ts-ignore
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
  remoteOS?: string
  remoteArch?: string
  remoteVersion?: string
  id?: string
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

function AppContent() {
  const { t } = useI18n()
  const [view, setView] = useState<'init' | 'locked' | 'launch' | 'remote' | 'settings'>('init')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [profileName, setProfileName] = useState('')
  const [shuttingDown, setShuttingDown] = useState(false)

  useEffect(() => {
    // Global shutdown listener
    const rt = loadRuntimeIfPresent()
    if (rt && rt.EventsOn) {
      rt.EventsOn('shutdown-initiated', () => {
        setShuttingDown(true)
      })
    }
  }, [])

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
    setRemoteUrl(`http://localhost:${p.localPort || 8443}`)
    setView('remote')
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
          onOpenSettings={() => setView('settings')}
        />
      )}

      {view === 'remote' && (
        <RemoteView
          url={remoteUrl}
          profileName={profileName}
          onDisconnect={handleDisconnect}
        />
      )}

      {view === 'settings' && (
        <SettingsDialog onClose={() => setView('launch')} />
      )}

      {shuttingDown && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'white'
        }}>
          <div style={{ marginBottom: 16 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.5s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
          <h2 style={{ margin: 0, fontWeight: 500 }}>{t('disconnecting')}</h2>
          <p style={{ marginTop: 8, opacity: 0.7 }}>Closing remote tunnels safely.</p>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
