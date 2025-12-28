import React, {useState, useEffect} from 'react'
import ConnectDialog from './components/ConnectDialog'
import SettingsDialog from './components/SettingsDialog'
let runtime: any = null
function loadRuntimeIfPresent(){
  if (runtime) return runtime
  try{
    const maybe = (globalThis as any).WAILS_RUNTIME || (typeof require !== 'undefined' ? require('@wails/runtime') : null)
    runtime = maybe || null
  }catch(e){ runtime = null }
  return runtime
}

export default function App(){
  const [showConnect, setShowConnect] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const rt = loadRuntimeIfPresent()
    if (!rt || !rt.EventsOn) return
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
    rt.EventsOn('navigate', handler)
    const errHandler = (args:any)=>{ const msg = Array.isArray(args) && args.length>0? args[0]: args; alert('Navigation error: '+String(msg)) }
    try{ rt.EventsOn('navigate-error', errHandler) }catch(e){}
    return () => { try { rt.EventsOff('navigate', handler) } catch (e) {} ; try { rt.EventsOff('navigate-error', errHandler)} catch (e) {} }
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
