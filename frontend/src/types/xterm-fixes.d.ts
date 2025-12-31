// hand crafted ... to get rid of typescript wearnings
declare module '@xterm/addon-fit' {
  import { IAddon } from 'xterm'
  export class FitAddon implements IAddon {
    constructor()
    activate(terminal: import('xterm').Terminal): void
    dispose(): void
    fit(): void
  }
  export default FitAddon
}

declare module '@xterm/xterm/css/xterm.css'

declare module '@xterm/xterm' {
  import { Terminal as _Terminal } from 'xterm'
  export { _Terminal as Terminal }
  const t: any
  export default t
}
