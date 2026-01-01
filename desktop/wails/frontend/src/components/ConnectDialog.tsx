import React, { useState, useEffect } from 'react'
import {
  StartTunnelWithProfile, CheckBackend, InstallBackend, StopTunnel,
  GetRemoteFileTree, TailRemoteLogs, KillPort
} from '../../wailsjs/go/app/App'

import { Profile } from '../App'

interface ConnectDialogProps {
  initialProfile?: Profile
  onClose: () => void
  onConnected: (p: Profile) => void
}

export default function ConnectDialog({ initialProfile, onClose, onConnected }: ConnectDialogProps) {
  const [localPort, setLocalPort] = useState(initialProfile?.localPort || 8443)
  const [host, setHost] = useState(initialProfile?.host || '')
  const [user, setUser] = useState(initialProfile?.user || '')
  const [identityFile, setIdentityFile] = useState(initialProfile?.identityFile || '')
  const [status, setStatus] = useState('')
  const [showInstall, setShowInstall] = useState(false)
  const [profileStr, setProfileStr] = useState('')

  useEffect(() => {
    if (initialProfile) {
      setHost(initialProfile.host)
      setUser(initialProfile.user)
      setIdentityFile(initialProfile.identityFile || '')
      setLocalPort(initialProfile.localPort || 8443)
    }
  }, [initialProfile])

  const getProfileObj = (): Profile => ({
    user,
    host,
    localPort: Number(localPort),
    remoteHost: 'localhost',
    remotePort: 8443,
    identityFile,
    extraArgs: []
  })

  const handleConnect = async () => {
    if (!user || !host) {
      setStatus('User and Host are required')
      return
    }

    // Always try to stop any existing tunnel first to avoid "already running" errors
    try {
      await StopTunnel()
      // Wait for port release
      await new Promise(r => setTimeout(r, 1000))
    } catch (e) { /* ignore */ }

    setStatus('Checking backend...')
    const pObj = getProfileObj()
    const p = JSON.stringify(pObj)
    setProfileStr(p)

    try {
      const exists = await CheckBackend(p)
      if (exists) {
        setStatus('Backend found. Starting tunnel...')
        startTunnel(p, pObj)
      } else {
        setStatus('Backend not found on remote.')
        setShowInstall(true)
      }
    } catch (e: any) {
      const msg = typeof e === 'string' ? e : (e.message || JSON.stringify(e))
      setStatus('Error: ' + msg)
    }
  }

  const startTunnel = async (p: string, pObj: Profile, retry = true) => {
    try {
      const res = await StartTunnelWithProfile(p)
      if (res === 'started') {
        setStatus('Connected!')
        onConnected(pObj)
      } else if (res === 'already-running' && retry) {
        setStatus('Tunnel busy, restarting...')
        try { await StopTunnel(); await new Promise(r => setTimeout(r, 1000)); } catch (e) { /* ignore */ }
        startTunnel(p, pObj, false)
      } else {
        setStatus('Tunnel failed: ' + res)
      }
    } catch (e: any) {
      const msg = typeof e === 'string' ? e : (e.message || JSON.stringify(e))
      // catch string "tunnel already running" if it comes as error
      if ((msg.includes('already running') || msg.includes('bind')) && retry) {
        setStatus('Port busy, clearing...')
        try {
          await StopTunnel()
          await KillPort(pObj.localPort)
          await new Promise(r => setTimeout(r, 1000))
        } catch (e) { /* ignore */ }
        startTunnel(p, pObj, false)
        return
      }
      setStatus('Tunnel Error: ' + msg)
    }
  }

  const handleInstall = async () => {
    if (!user || !host) {
      setStatus('User and Host are required')
      return
    }
    const pObj = getProfileObj()
    const pJSON = JSON.stringify(pObj)

    setStatus('Installing backend... (this may take a minute)')
    try {
      const res = await InstallBackend(pJSON)
      if (res === 'installed') {
        setStatus('Installation complete. Connecting...')
        setShowInstall(false)
        startTunnel(pJSON, pObj)
      } else {
        setStatus('Installation failed: ' + res)
      }
    } catch (e: any) {
      const msg = typeof e === 'string' ? e : (e.message || JSON.stringify(e))
      setStatus('Install Error: ' + msg)
    }
  }

  const [debugOutput, setDebugOutput] = useState('')

  const handleDebug = async () => {
    if (!user || !host) {
      setStatus('User and Host are required')
      return
    }
    setStatus('Fetching remote file tree...')
    const pObj = getProfileObj()
    const pJSON = JSON.stringify(pObj)
    try {
      const tree = await GetRemoteFileTree(pJSON)
      setDebugOutput("--- File Tree ---\n" + tree)
      setStatus('Debug info received.')
    } catch (e: any) {
      setStatus('Debug failed: ' + (e.message || e))
    }
  }

  const handleLogs = async () => {
    if (!user || !host) {
      setStatus('User and Host are required')
      return
    }
    setStatus('Fetching remote logs...')
    const pObj = getProfileObj()
    const pJSON = JSON.stringify(pObj)
    try {
      const logs = await TailRemoteLogs(pJSON)
      setDebugOutput("--- Service Logs ---\n" + logs)
      setStatus('Logs received.')
    } catch (e: any) {
      setStatus('Logs failed: ' + (e.message || e))
    }
  }

  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runtime = (window as any).runtime
    if (runtime && runtime.EventsOn) {
      runtime.EventsOn('ssh-log', (msg: string) => {
        setLogs(prev => [...prev, msg].slice(-20))
      })
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{ background: 'white', padding: 24, borderRadius: 8, minWidth: 500, color: '#333', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>{initialProfile ? 'Reconnect' : 'Connect to Remote'}</h2>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>User</label>
          <input value={user} onChange={e => setUser(e.target.value)} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Host</label>
          <input value={host} onChange={e => setHost(e.target.value)} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12, display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Identity File (Optional)</label>
            <input
              value={identityFile}
              onChange={e => setIdentityFile(e.target.value)}
              placeholder="e.g. C:\Users\name\.ssh\id_rsa"
              style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ width: 100 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Local Port</label>
            <input
              type="number"
              value={localPort}
              onChange={e => setLocalPort(parseInt(e.target.value))}
              style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12, color: status.includes('Error') || status.includes('failed') ? 'red' : '#666' }}>
          {status}
        </div>

        {logs.length > 0 && (
          <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginBottom: 16, fontSize: '0.8em', fontFamily: 'monospace', maxHeight: 150, overflowY: 'auto' }}>
            {logs.map((L, i) => <div key={i}>{L}</div>)}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
          {!showInstall && (
            <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowInstall(true); setStatus('Ready to update backend.'); }}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Force Update
              </button>
              <button
                onClick={handleDebug}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Debug Files
              </button>
              <button
                onClick={handleLogs}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Server Logs
              </button>
            </div>
          )}
          <button onClick={onClose} style={{ padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
          {!showInstall && <button onClick={handleConnect} style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Connect</button>}
          {showInstall && <button onClick={handleInstall} style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Install Backend</button>}
        </div>

        {debugOutput && (
          <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
            <h3>Remote File Tree</h3>
            <pre style={{ background: '#f0f0f0', padding: 8, fontSize: '0.8rem', overflow: 'auto', maxHeight: 200 }}>{debugOutput}</pre>
            <button onClick={() => setDebugOutput('')} style={{ marginTop: 8 }}>Clear</button>
          </div>
        )}
      </div>
    </div>
  )
}
