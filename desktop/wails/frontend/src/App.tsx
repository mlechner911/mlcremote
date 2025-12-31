import React, { useState, useEffect } from 'react'
import ConnectDialog from './components/ConnectDialog'
import SettingsDialog from './components/SettingsDialog'
import Welcome from './components/Welcome'
import RemoteView from './components/RemoteView'
import { StopTunnel } from '../wailsjs/go/app/App'

// Common type shareable via export
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
  const [currentView, setCurrentView] = useState<'welcome' | 'settings' | 'remote'>('welcome')
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Profile | undefined>(undefined)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [connectedProfileName, setConnectedProfileName] = useState('')

  useEffect(() => {
    const rt = loadRuntimeIfPresent()
    if (!rt || !rt.EventsOn) return
    const handler = async (args: any) => {
      const url = Array.isArray(args) && args.length > 0 ? args[0] : args
      if (typeof url === 'string') {
        try {
          const res = await fetch(`${url}/api/version`, { method: 'GET' })
          if (!res.ok) throw new Error('version check failed')
          const json = await res.json()
          // Instead of redirecting, switch to remote view
          if (json && json.frontendCompatible) {
            setRemoteUrl(url);
            setCurrentView('remote');
            return
          }
          try { runtime.EventsEmit('navigate-error', 'incompatible') } catch (e) { }
        } catch (e: any) { try { runtime.EventsEmit('navigate-error', String(e.message || e)) } catch (e) { } }
      }
    }
    rt.EventsOn('navigate', handler)
    const errHandler = (args: any) => { const msg = Array.isArray(args) && args.length > 0 ? args[0] : args; alert('Navigation error: ' + String(msg)) }
    try { rt.EventsOn('navigate-error', errHandler) } catch (e) { }
    return () => { try { rt.EventsOff('navigate', handler) } catch (e) { }; try { rt.EventsOff('navigate-error', errHandler) } catch (e) { } }
  }, [])

  const handleOpenConnect = (profile?: Profile) => {
    setSelectedProfile(profile)
    setShowConnectDialog(true)
  }

  const handleConnected = (profile: Profile) => {
    // Save to history
    try {
      const hStr = localStorage.getItem('mlcremote_history')
      let h: Profile[] = hStr ? JSON.parse(hStr) : []
      // remove duplicate if exists
      h = h.filter(x => !(x.user === profile.user && x.host === profile.host && x.localPort === profile.localPort))
      // add to top
      h.unshift(profile)
      // limit to 10
      if (h.length > 10) h = h.slice(0, 10)
      localStorage.setItem('mlcremote_history', JSON.stringify(h))
    } catch (e) { console.error(e) }

    setConnectedProfileName(`${profile.user}@${profile.host}`)
    setShowConnectDialog(false)
    // Wait for 'navigate' event from backend
  }

  const handleDisconnect = async () => {
    try {
      await StopTunnel()
    } catch (e) {
      console.error("Failed to stop tunnel:", e)
    }
    setRemoteUrl('')
    setConnectedProfileName('')
    // small delay to ensure UI updates before potential rapid reconnect
    setTimeout(() => setCurrentView('welcome'), 100)
  }

  return (
    <>
      <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh' }}>
        {currentView === 'welcome' && (
          <Welcome
            onConnect={handleOpenConnect}
            onOpenSettings={() => setCurrentView('settings')}
          />
        )}

        {currentView === 'remote' && (
          <RemoteView
            url={remoteUrl}
            profileName={connectedProfileName}
            onDisconnect={handleDisconnect}
          />
        )}

        {currentView === 'settings' && (
          <SettingsDialog onClose={() => setCurrentView('welcome')} />
        )}
      </div>

      {showConnectDialog && (
        <ConnectDialog
          onClose={() => setShowConnectDialog(false)}
          initialProfile={selectedProfile}
          onConnected={handleConnected}
        />
      )}
    </>
  )
}
