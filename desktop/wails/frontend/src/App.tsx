import React, { useState, useEffect } from 'react'
import LaunchScreen from './components/LaunchScreen'
import AppLock from './components/AppLock'
import SettingsDialog from './components/SettingsDialog'
import RemoteView from './components/RemoteView'
import {
  StartTunnel, StopTunnel, TunnelStatus, DetectRemoteOS,
  InstallBackend, DeployAgent, CheckBackend, ProbeConnection,
  ListProfiles, SaveProfile, DeleteProfile,
  SetMasterPassword, VerifyMasterPassword, HasMasterPassword, RunTask, StopBackend
} from './wailsjs/go/app/App'
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

import { Profile, TaskDef } from './types'

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
  const { t, lang } = useI18n()
  const [view, setView] = useState<'init' | 'locked' | 'launch' | 'remote' | 'settings'>('init')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [profileName, setProfileName] = useState('')
  const [profileColor, setProfileColor] = useState('')
  const [shuttingDown, setShuttingDown] = useState(false)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)

  // Theme Management
  const [theme, setTheme] = useState<'auto' | 'dark' | 'light'>('auto')
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('app-theme')
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      setTheme(saved as any)
    }
  }, [])

  useEffect(() => {
    const resolve = () => {
      if (theme === 'auto') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return theme
    }
    setEffectiveTheme(resolve())

    if (theme === 'auto') {
      const m = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => setEffectiveTheme(e.matches ? 'dark' : 'light')
      m.addEventListener('change', handler)
      return () => m.removeEventListener('change', handler)
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.className = effectiveTheme === 'dark' ? 'theme-dark' : 'theme-light'
    // Also set body styles to ensure full coverage
    document.body.style.backgroundColor = effectiveTheme === 'dark' ? '#111827' : '#f9fafb'
    document.body.style.color = effectiveTheme === 'dark' ? '#f3f4f6' : '#1f2937'
    localStorage.setItem('app-theme', theme)
  }, [effectiveTheme, theme])

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

  const [initialTask, setInitialTask] = useState<TaskDef | undefined>(undefined)

  const handleConnected = (p: Profile, token?: string, task?: TaskDef) => {
    setCurrentProfile(p)
    setInitialTask(task)
    setProfileName(`${p.user}@${p.host}`)
    setProfileColor(p.color || '')
    let url = `http://localhost:${p.localPort || 8443}`
    if (token) {
      url += `?token=${encodeURIComponent(token)}`
    } else {
      url += '?'
    }
    // Propagate language
    url += `&lang=${lang || 'en'}`

    setRemoteUrl(url)
    setView('remote')
  }

  const handleDisconnect = async () => {
    // 1. Immediately unmount RemoteView to stop polling
    setShuttingDown(true)
    setView('launch')

    // Clear URL param immediately
    window.history.pushState({}, '', '/')

    try {
      // Attempt to stop the remote server process before closing the tunnel
      if (currentProfile) {
        try {
          console.log("Stopping remote backend...")
          await StopBackend(JSON.stringify(currentProfile))
        } catch (e) {
          console.warn("Failed to stop remote backend (may already be stopped):", e)
        }
      }

      await StopTunnel()
      setCurrentProfile(null)
    } catch (e) {
      console.error(e)
    } finally {
      // Reset State
      setShuttingDown(false)
      setRemoteUrl('')
      setProfileName('')
      setProfileColor('')
      // Ensure we are in launch view (already set, but for safety)
      setView('launch')
    }
  }

  const handleRunTask = async (task: TaskDef) => {
    if (!currentProfile) return

    // Show "Running..." toast/indicator?
    // simple alert for now or implement a better UI later
    // We can use a temporary overlay
    const start = Date.now()
    console.log("Running task:", task.name)

    try {
      // @ts-ignore
      const res = await RunTask(currentProfile, task, "")
      const duration = Date.now() - start
      console.log("Task finished in", duration, "ms")
      console.log("Output:", res)

      // Simple output display
      if (res) {
        alert(`Task: ${task.name}\n\n${res}`)
      } else {
        // Success no output
        // alert(`Task: ${task.name} completed successfully.`)
      }
    } catch (e: any) {
      console.error("Task failed:", e)
      alert(`Task Failed: ${task.name}\nError: ${e.message || e}`)
    }
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
          profileColor={profileColor}
          profileId={currentProfile?.id}
          user={currentProfile?.user}
          localPort={currentProfile?.localPort}
          tasks={currentProfile?.tasks}
          initialTask={initialTask}
          onRunTask={handleRunTask}
          theme={effectiveTheme}
          onSetTheme={setTheme}
          onDisconnect={handleDisconnect}
          defaultShell={currentProfile?.defaultShell}
        />
      )}

      {view === 'settings' && (
        <SettingsDialog
          theme={theme}
          onSetTheme={setTheme}
          onClose={() => setView('launch')}
        />
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
          <p style={{ marginTop: 8, opacity: 0.7 }}>{t('disconnecting_desc')}</p>
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
