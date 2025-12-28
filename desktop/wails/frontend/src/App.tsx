import React, {useState, useEffect} from 'react'
import ConnectDialog from './components/ConnectDialog'
import SettingsDialog from './components/SettingsDialog'
// runtime may be undefined when running in web; import via require at runtime
let runtime: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  runtime = require('@wails/runtime')
} catch (e) {
  // not running in Wails environment
}

export default function App(){
  const [showConnect, setShowConnect] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (!runtime || !runtime.EventsOn) return
    const handler = (args: any) => {
      const url = Array.isArray(args) && args.length > 0 ? args[0] : args
      if (typeof url === 'string') {
        window.location.href = url
      }
    }
    runtime.EventsOn('navigate', handler)
    return () => {
      try { runtime.EventsOff('navigate', handler) } catch (e) {}
    }
  }, [])

  return (
    <div style={{fontFamily: 'system-ui, sans-serif', padding: 16}}>
      <h1>MLCRemote Desktop Prototype</h1>
      <div style={{display:'flex', gap:8}}>
        <button onClick={()=>setShowConnect(true)}>Connect</button>
        <button onClick={()=>setShowSettings(true)}>Settings</button>
      </div>
      {showConnect && <ConnectDialog onClose={()=>setShowConnect(false)} />}
      {showSettings && <SettingsDialog onClose={()=>setShowSettings(false)} />}
    </div>
  )
}
