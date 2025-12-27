import React, {useState} from 'react'
import ConnectDialog from './components/ConnectDialog'
import SettingsDialog from './components/SettingsDialog'

export default function App(){
  const [showConnect, setShowConnect] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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
