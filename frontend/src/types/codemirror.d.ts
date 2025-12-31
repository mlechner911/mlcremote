declare module '@uiw/react-codemirror' {
  import * as React from 'react'
  type Props = any
  const CodeMirror: React.ComponentType<Props>
  export default CodeMirror
}

declare module '@codemirror/theme-one-dark' {
  export const oneDark: any
}

declare module '@codemirror/lang-python' {
  export function python(): any
}
declare module '@codemirror/lang-go' {
  export function go(): any
}
declare module '@codemirror/lang-php' {
  export function php(): any
}
declare module '@codemirror/lang-json' {
  export function json(): any
}
declare module '@codemirror/lang-markdown' {
  export function markdown(): any
}
declare module '@codemirror/lang-yaml' {
  export function yaml(): any
}
declare module '@codemirror/lang-shell' {
  export function shell(): any
}
declare module '@codemirror/lang-javascript' {
  export function javascript(): any
}
declare module '@codemirror/lang-css' {
  export function css(): any
}
declare module '@codemirror/lang-xml' {
  export function xml(): any
}
declare module '@codemirror/lang-cpp' {
  export function cpp(): any
  export function c(): any
}
