import React, { Suspense } from 'react'
import { ViewProps, FileHandler, DecideOpts } from '../../handlers/types'

const TerminalTab = React.lazy(() => import('./TerminalTab'))

/**
 * Wrapper for a terminal session associated with a specific shell ID.
 */
export default function ShellView({ path }: ViewProps) {
  // path is expected to be a generated shell id like 'shell-<ts>' and the cwd
  // is passed in via props in the parent when creating a shell tab. For now,
  // attempt to derive shell name and use root cwd fallback.
  const shell = 'bash'
  const cwd = '/' // TerminalTab will resolve proper cwd via statPath if possible
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Suspense fallback={<div className="muted">Loading terminal...</div>}>
        <TerminalTab shell={shell} path={cwd} />
      </Suspense>
    </div>
  )
}

export const ShellHandler: FileHandler = {
  name: 'Shell',
  priority: 100,
  matches: (opts: DecideOpts) => !!(opts.path && opts.path.startsWith('shell-')),
  view: ShellView,
  isEditable: false
}
