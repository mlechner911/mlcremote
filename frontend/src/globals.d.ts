// Ambient module declarations used by the build (Vite + TypeScript). These
// allow importing CSS/images and other side-effect modules without explicit
// type definitions in the repo.
declare module '*.css'
declare module '*.scss'
declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.svg'

// PrismJS theme and component imports are imported for side-effects; provide
// permissive module declarations so TypeScript accepts those imports.
declare module 'prismjs/themes/*'
declare module 'prismjs/components/*'
declare module 'pdfjs-dist/legacy/build/pdf'
declare module 'pdfjs-dist/*'

// Catch-all to allow dynamic or third-party imports with unknown shapes.
declare module '*'

export {}
