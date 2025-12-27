import React, {useState} from 'react'

export default function ConnectDialog({onClose}:{onClose:()=>void}){
  const [url, setUrl] = useState('http://127.0.0.1:8443')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function check(){
    setLoading(true)
    setStatus(null)
    try{
      // call Wails backend
      // @ts-ignore
      const res = await (window as any).app.HealthCheck(url, 2)
      setStatus(String(res))
    }catch(e:any){
      setStatus('not-found')
    }
    setLoading(false)
  }

  return (
    <div style={{position:'fixed',left:24,top:24,background:'#fff',padding:16,border:'1px solid #ddd',width:420}}>
      <h3>Connect</h3>
      <div style={{display:'flex',gap:8}}>
        <input style={{flex:1}} value={url} onChange={e=>setUrl(e.target.value)} />
        <button onClick={check} disabled={loading}>Check</button>
      </div>
      <div style={{marginTop:8}}>
        {loading? <span>Checking…</span> : status === 'ok' ? <span style={{color:'green'}}>Backend reachable</span> : status === 'not-found' ? <span style={{color:'red'}}>Backend not running — please install or start the server</span> : null}
      </div>
      <div style={{marginTop:12,display:'flex',justifyContent:'flex-end',gap:8}}>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
