declare module 'pdfjs-dist/legacy/build/pdf' {
  const pdfjs: any
  export = pdfjs
}

declare module 'pdfjs-dist/*' {
  const anyExport: any
  export = anyExport
}
