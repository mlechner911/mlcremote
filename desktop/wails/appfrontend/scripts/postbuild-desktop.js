const fs = require('fs')
const path = require('path')
const src = path.join(__dirname, '..', 'index-desktop.html')
const dst = path.join(__dirname, '..', 'dist', 'index.html')
try{
  if (fs.existsSync(src)){
    fs.copyFileSync(src, dst)
    console.log('Copied index-desktop.html -> dist/index.html')
  } else {
    console.log('No index-desktop.html present; skipping copy')
  }
}catch(e){ console.error('postbuild-desktop failed', e); process.exit(1) }
