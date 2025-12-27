import React, {useState} from 'react'

export default function SettingsDialog({onClose}:{onClose:()=>void}){
  const [profiles, setProfiles] = useState(() => {
    try{
      const raw = localStorage.getItem('mlcremote.profiles')
      return raw ? JSON.parse(raw) : []
    }catch(e){
      return []
    }
  })

  function addEmpty(){
    const p = {id: Date.now(), name:'new', host:'example.com', port:22, user:'', useTunnel:false}
    const next = [...profiles, p]
    setProfiles(next)
    localStorage.setItem('mlcremote.profiles', JSON.stringify(next))
  }

  return (
    <div style={{position:'fixed',left:24,top:24,background:'#fff',padding:16,border:'1px solid #ddd',width:640}}>
      <h3>Settings — Profiles</h3>
      <div style={{display:'flex',flexDirection:'column',gap:8, maxHeight:300, overflow:'auto'}}>
        {profiles.map((p:any)=> (
          <div key={p.id} style={{padding:8,border:'1px solid #eee'}}>
            <div style={{display:'flex',gap:8}}>
              <input value={p.name} onChange={(e)=>{p.name=e.target.value; setProfiles([...profiles])}} />
              <input value={p.host} onChange={(e)=>{p.host=e.target.value; setProfiles([...profiles])}} />
              <input value={String(p.port)} style={{width:80}} onChange={(e)=>{p.port=Number(e.target.value); setProfiles([...profiles])}} />
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,display:'flex',justifyContent:'space-between'}}>
        <div>
          <button onClick={addEmpty}>Add Profile</button>
        </div>
        <div>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
