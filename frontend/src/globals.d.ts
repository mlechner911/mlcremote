// Type declarations for static assets and modules used as side-effects
declare module '*.css'
declare module '*.scss'
declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.svg'

// Prism may be imported for side-effects; ensure types exist
declare module 'prismjs/themes/*'
declare module 'prismjs/components/*'

// Allow dynamic imports with unknown module shapes
declare module '*'

export {}
