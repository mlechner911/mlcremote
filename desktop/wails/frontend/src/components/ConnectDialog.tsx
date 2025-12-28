import React, {useState, useRef, useEffect} from 'react'

export default function ConnectDialog({onClose}:{onClose:()=>void}){
  const [url, setUrl] = useState('http://127.0.0.1:8443')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Tunnel form fields
  const [user, setUser] = useState('')
  const [host, setHost] = useState('')
  const [localPort, setLocalPort] = useState('8443')
  const [remoteHost, setRemoteHost] = useState('localhost')
  const [remotePort, setRemotePort] = useState('8443')
  const [identityFile, setIdentityFile] = useState('')
  const [authMethod, setAuthMethod] = useState<'agent'|'key'|'password'>('agent')
  const [password, setPassword] = useState('')
  const fileRef = useRef<HTMLInputElement|null>(null)

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

  async function startTunnelAndCheck(){
    setLoading(true)
    setStatus('not-found')
    try{
      // basic validation
      const resolvedHost = host || url.replace(/^https?:\/\//, '')
      if(!user){ setStatus('missing-user'); setLoading(false); return }
      if(!resolvedHost){ setStatus('missing-host'); setLoading(false); return }
      const lp = Number(localPort)
      const rp = Number(remotePort)
      if(Number.isNaN(lp) || Number.isNaN(rp)){ setStatus('invalid-ports'); setLoading(false); return }

      let idPath = identityFile || undefined
      if(authMethod === 'key' && fileRef.current && fileRef.current.files && fileRef.current.files.length>0){
        const f = fileRef.current.files[0]
        const arr = await f.arrayBuffer()
        const b64 = btoa(String.fromCharCode(...new Uint8Array(arr)))
        try{
          // @ts-ignore
          const tmp = await (window as any).app.SaveIdentityFile(b64, f.name)
          idPath = String(tmp)
        }catch(err:any){
          setStatus('save-key-failed')
          setLoading(false)
          return
        }
      }

      const profile = {
        user: user,
        host: resolvedHost,
        localPort: lp,
        remoteHost: remoteHost || 'localhost',
        remotePort: rp,
        identityFile: idPath,
        password: authMethod === 'password' ? password : undefined,
      }
      // @ts-ignore
      let res
      try{
        // @ts-ignore
        res = await (window as any).app.StartTunnelWithProfile(JSON.stringify(profile))
        console.log('StartTunnelWithProfile', res)
      }catch(err:any){
        // show backend error message
        setStatus(String(err?.message || err))
        setLoading(false)
        return
      }
      // poll tunnel status and health
      for(let i=0;i<12;i++){
        // @ts-ignore
        const t = await (window as any).app.TunnelStatus()
        setStatus(String(t))
        if(t === 'started' || t === 'running' || t === 'stopped'){
          // check backend
          try{
            // @ts-ignore
            const h = await (window as any).app.HealthCheck(url, 2)
            setStatus(String(h))
            if(String(h) === 'ok'){
              setLoading(false)
              return
            }
          }catch(e){ }
        }
        await new Promise(r=>setTimeout(r,1000))
      }
      setStatus('not-ok')
    }catch(e:any){
      setStatus('tunnel-failed')
    }
    setLoading(false)
  }

  useEffect(()=>{
    // subscribe to ssh-log events when running in Wails
    const runtime = (window as any).wailsRuntime || (window as any).runtime || (window as any).appRuntime
    try{
      // @ts-ignore
      const w = (window as any).wails
      if(w && w.EventsOn){
        w.EventsOn('ssh-log', (args: any)=>{
          const line = Array.isArray(args) && args.length>0 ? args[0] : args
          setLogs(l=>[...l, String(line)])
        })
      } else if((window as any).app && (window as any).app.EventsOn){
        // @ts-ignore
        (window as any).app.EventsOn('ssh-log', (args:any)=>{
          const line = Array.isArray(args) && args.length>0 ? args[0] : args
          setLogs(l=>[...l, String(line)])
        })
      }
    }catch(e){ }
  }, [])

  const [logs, setLogs] = useState<string[]>([])

  async function stopTunnel(){
    try{
      // @ts-ignore
      await (window as any).app.StopTunnel()
      setStatus('stopped')
    }catch(e:any){
      setStatus('stop-failed')
    }
  }

  return (
    <div style={{position:'fixed',left:24,top:24,background:'#fff',padding:16,border:'1px solid #ddd',width:420}}>
      <h3>Connect</h3>
      <div style={{display:'flex',gap:8}}>
        <input style={{flex:1}} value={url} onChange={e=>setUrl(e.target.value)} />
        <button onClick={check} disabled={loading}>Check</button>
      </div>
      <div style={{marginTop:8,borderTop:'1px solid #eee',paddingTop:8}}>
        <div style={{display:'flex',gap:8}}>
          <input placeholder='user' value={user} onChange={e=>setUser(e.target.value)} />
          <input placeholder='host (optional)' value={host} onChange={e=>setHost(e.target.value)} />
        </div>
        <div style={{marginTop:8}}>
          <label>Auth:</label>
          <select value={authMethod} onChange={e=>setAuthMethod(e.target.value as any)}>
            <option value='agent'>ssh-agent (default)</option>
            <option value='key'>Private key file</option>
            <option value='password'>Password</option>
          </select>
        </div>
        {authMethod === 'key' && (
          <div style={{marginTop:8}}>
            <input type='file' ref={fileRef} />
          </div>
        )}
        {authMethod === 'password' && (
          <div style={{marginTop:8}}>
            <input type='password' placeholder='SSH password' value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
        )}
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <input style={{width:80}} placeholder='local' value={localPort} onChange={e=>setLocalPort(e.target.value)} />
          <input style={{width:120}} placeholder='remoteHost' value={remoteHost} onChange={e=>setRemoteHost(e.target.value)} />
          <input style={{width:80}} placeholder='remote' value={remotePort} onChange={e=>setRemotePort(e.target.value)} />
        </div>
        <div style={{marginTop:8}}>
          <input style={{width:'100%'}} placeholder='identity file (optional)' value={identityFile} onChange={e=>setIdentityFile(e.target.value)} />
        </div>
      </div>
      <div style={{marginTop:8}}>
        {loading? <span>Checking…</span> : status === 'ok' ? <span style={{color:'green'}}>Backend reachable</span> : status === 'not-found' ? <span style={{color:'red'}}>Backend not running — please install or start the server</span> : status === 'missing-user' ? <span style={{color:'red'}}>Please enter the SSH user</span> : status === 'missing-host' ? <span style={{color:'red'}}>Please provide a host</span> : status === 'invalid-ports' ? <span style={{color:'red'}}>Ports must be numeric</span> : status === 'started' || status === 'starting' ? <span style={{color:'orange'}}>Starting tunnel…</span> : status === 'tunnel-failed' ? <span style={{color:'red'}}>Tunnel start failed</span> : status === 'not-ok' ? <span style={{color:'red'}}>Backend still unreachable after tunnel</span> : null}
      </div>
      <div style={{marginTop:12,display:'flex',justifyContent:'flex-end',gap:8}}>
        <button onClick={onClose}>Close</button>
        <button onClick={stopTunnel} disabled={loading}>Stop</button>
        <button onClick={startTunnelAndCheck} disabled={loading}>Start Tunnel</button>
      </div>
      <div style={{marginTop:8,borderTop:'1px solid #eee',paddingTop:8,maxHeight:200,overflow:'auto',fontSize:12,background:'#f9f9f9'}}>
        {logs.map((l,i)=>(<div key={i} style={{whiteSpace:'pre-wrap'}}>{l}</div>))}
      </div>
    </div>
  )
}
