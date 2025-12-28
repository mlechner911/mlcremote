import React from 'react'
export default function ConnectDialog({onClose}:{onClose:()=>void}){
  return (
    <div style={{border:'1px solid #ccc', padding:12, marginTop:8}}>
      <h2>Connect (placeholder)</h2>
      <button onClick={onClose}>Close</button>
    </div>
  )
}
