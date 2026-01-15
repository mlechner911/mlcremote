import Prism from 'prismjs'

export function langForExt(ext: string) {
  const L = Prism.languages as any
  switch (ext) {
    case 'jsx': return L.jsx
    case 'tsx': return L.tsx
    case 'java': return L.java
    case 'ini': case 'gitconfig': case 'editorconfig': case 'conf': case 'config': return L.ini
    case 'js': return L.javascript
    case 'ts': return L.typescript
    case 'go': return L.go
    case 'php': return L.php
    case 'json': return L.json
    case 'yaml': case 'yml': return L.yaml
    case 'toml': return L.toml || L.markup
    case 'md': case 'markdown': return L.markdown
    case 'c': case 'h': return L.c
    case 'cpp': case 'hpp': return L.cpp
    case 'py': return L.python
    case 'makefile': return L.makefile
    case 'bashrc': case 'zshrc': case 'bash_history': case 'profile': return L.bash
    case 'sh': case 'bash': return L.bash
    case 'xml': return L.xml || L.markup
    case 'xml-doc': return L['xml-doc']
    case 'html': case 'htm': return L.markup
    case 'css': case 'sass': case 'scss': return L.sass
    case 'sql': return L.sql
    default: return L.javascript
  }
}

export function aliasForExt(ext: string) {
  switch (ext) {
    case 'js': case 'jsx': return 'javascript'
    case 'ts': case 'tsx': return 'typescript'
    case 'go': return 'go'
    case 'php': return 'php'
    case 'json': return 'json'
    case 'yaml': case 'yml': return 'yaml'
    case 'toml': return 'toml'
    case 'ini': case 'gitconfig': case 'editorconfig': case 'conf': case 'config': return 'ini'
    case 'md': case 'markdown': return 'markdown'
    case 'c': case 'h': return 'c'
    case 'cpp': case 'cxx': case 'c++': case 'hpp': return 'cpp'
    case 'py': return 'python'
    case 'makefile': return 'makefile'
    case 'dockerfile': return 'dockerfile'
    case 'sh': case 'bash': case 'csh': return 'bash'
    case 'bashrc': case 'zshrc': case 'bash_history': case 'profile': return 'bash'
    case 'xml': return 'xml'
    case 'xml-doc': return 'xml-doc'
    case 'html': case 'htm': return 'markup'
    case 'sass': case 'scss': return 'sass'
    case 'sql': return 'sql'
    case 'less': case 'css': return 'css'
    default: return 'text'
  }
}

export default { langForExt, aliasForExt }
