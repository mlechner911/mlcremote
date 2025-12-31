import React from 'react'
import TerminalTab from './TerminalTab'

export default function ShellView({ path }: { path: string }) {
  // path is expected to be a generated shell id like 'shell-<ts>' and the cwd
  // is passed in via props in the parent when creating a shell tab. For now,
  // attempt to derive shell name and use root cwd fallback.
  const shell = 'bash'
  const cwd = '/' // TerminalTab will resolve proper cwd via statPath if possible
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TerminalTab shell={shell} path={cwd} />
    </div>
  )
}
