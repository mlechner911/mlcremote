import React from 'react'
export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', backgroundColor: '#f5f5f5', color: '#333'
    }}>
      <div style={{
        background: 'white', padding: 32, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: 500, width: '100%', textAlign: 'center'
      }}>
        <h2 style={{ marginTop: 0 }}>About MLCRemote</h2>

        <div style={{ margin: '24px 0', lineHeight: '1.6' }}>
          <p>
            <strong>Version:</strong> 0.1.0<br />
            <strong>License:</strong> MIT License
          </p>

          <div style={{ borderTop: '1px solid #eee', margin: '16px 0', paddingTop: 16 }}>
            <strong>Copyright © {new Date().getFullYear()} Michael Lechner</strong><br />
            Schönachstrasse 27<br />
            86972 Altenstadt, Germany<br />
            <a href="mailto:lechner.altenstadt@web.de" style={{ color: '#007bff' }}>lechner.altenstadt@web.de</a>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            padding: '8px 24px', background: '#333', color: 'white',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '1rem'
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
