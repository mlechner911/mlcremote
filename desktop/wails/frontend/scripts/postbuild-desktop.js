const fs = require('fs')
const path = require('path')

const dist = path.resolve(__dirname, '..', 'dist')
const srcDesktop = path.resolve(__dirname, '..', 'index-desktop.html')
const destIndex = path.join(dist, 'index.html')

if (!fs.existsSync(dist)) {
  console.error('dist directory not found, run build first')
  process.exit(1)
}

fs.copyFileSync(srcDesktop, destIndex)
console.log('Copied index-desktop.html -> dist/index.html')
