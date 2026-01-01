export function effectiveExtFromFilename(path?: string | null): string | null {
  if (!path) return null
  const parts = path.split('/')
  const name = parts[parts.length - 1] || ''
  const lower = name.toLowerCase()
  // explicit filename matches
  if (lower === '.bashrc' || lower === 'bashrc' || lower === '.bash_profile' || lower === '.profile') return 'bashrc'
  if (lower === '.zshrc' || lower === 'zshrc') return 'zshrc'
  if (lower === '.bash_history' || lower === 'bash_history') return 'bash_history'
  if (lower === 'makefile') return 'makefile'
  if (lower === 'dockerfile') return 'dockerfile'
  if (lower === 'nginx.conf' || lower === 'nginx.conf.default') return 'conf'
  // fallback: return null to indicate no special mapping
  return null
}
