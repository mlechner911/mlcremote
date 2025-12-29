const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs')
const destDir = path.join(__dirname, '..', 'public')
const dest = path.join(destDir, 'pdf.worker.mjs')

try {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir)
  fs.copyFileSync(src, dest)
  console.log('pdf.worker.mjs copied to public')
} catch (e) {
  console.error('failed to copy pdf.worker.mjs', e)
  process.exit(0)
}
