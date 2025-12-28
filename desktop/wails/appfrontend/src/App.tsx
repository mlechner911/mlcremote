import React, {useState, useEffect} from 'react'
import ConnectDialog from './components/ConnectDialog'
import SettingsDialog from './components/SettingsDialog'
let runtime: any = null
if (typeof window !== 'undefined') {
  import('@wails/runtime')
    .then((mod) => { runtime = mod })
    .catch(() => {})
}

export default function App(){
  const [showConnect, setShowConnect] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (!runtime || !runtime.EventsOn) return
    const handler = async (args: any) => {
      const url = Array.isArray(args) && args.length > 0 ? args[0] : args
      if (typeof url === 'string') {
        try{
          const res = await fetch(`${url}/api/version`, {method: 'GET'})
          if(!res.ok) throw new Error('version check failed')
          const json = await res.json()
          if(json && json.frontendCompatible){ window.location.href = url; return }
          try{ runtime.EventsEmit('navigate-error', 'incompatible') }catch(e){}
        }catch(e:any){ try{ runtime.EventsEmit('navigate-error', String(e.message || e)) }catch(e){} }
      }
    }
    runtime.EventsOn('navigate', handler)
    const errHandler = (args:any)=>{ const msg = Array.isArray(args) && args.length>0? args[0]: args; alert('Navigation error: '+String(msg)) }
    try{ runtime.EventsOn('navigate-error', errHandler) }catch(e){}
    return () => { try { runtime.EventsOff('navigate', handler) } catch (e) {} ; try { runtime.EventsOff('navigate-error', errHandler)} catch (e) {} }
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
