import React from 'react'
import { readFile, saveFile, deleteFile } from '../api'
import { extFromPath, probeFileType } from '../filetypes'
import { Icon, iconForExtension as getIcon } from '../generated/icons'

type Props = {
  path: string
  onSaved?: () => void
}

export default function EditorCodeMirror({ path, onSaved }: Props) {
  const [content, setContent] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)
  const [CM, setCM] = React.useState<React.ComponentType<any> | null>(null)
  const [langExt, setLangExt] = React.useState<any>(null)
  const [theme, setTheme] = React.useState<any | null>(null)
  const [probe, setProbe] = React.useState<{ mime: string; isText: boolean; ext: string } | null>(null)
  const [origContent, setOrigContent] = React.useState<string>('')

  // lazy-load CodeMirror wrapper + theme once
  React.useEffect(() => {
    let mounted = true
      ; (async () => {

        try {
          const cmMod = await import('@uiw/react-codemirror')
          const themeMod = await import('@codemirror/theme-one-dark')
          if (!mounted) return
          const isLight = document.documentElement.classList.contains('theme-light')
          setCM(() => cmMod.default)
          setTheme(() => isLight ? null : themeMod.oneDark)
        } catch (e) {
          console.warn('Failed to load CodeMirror:', e)
        }
      })()
    return () => { mounted = false }
  }, [])

  // update theme when document class changes
  React.useEffect(() => {
    const updateTheme = async () => {
      const isLight = document.documentElement.classList.contains('theme-light')
      if (isLight) {
        setTheme(null)
      } else {
        const themeMod = await import('@codemirror/theme-one-dark')
        setTheme(themeMod.oneDark)
      }
    }
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // load file content and probe
  React.useEffect(() => {
    if (!path) return
    setLoading(true)
    probeFileType(path).then(p => setProbe(p)).catch(() => setProbe(null))
    readFile(path).then(t => { setContent(t); setOrigContent(t) }).catch(() => { setContent(''); setOrigContent('') }).finally(() => setLoading(false))
  }, [path])

  // lazy-load language extension for current file
  React.useEffect(() => {
    if (!CM || !path) return
    let mounted = true
    const ext = extFromPath(path)
      ; (async () => {
        try {
          let extModule: any = null
          switch (ext) {
            case 'py': {
              const m = await import('@codemirror/lang-python')
              extModule = m.python()
              break
            }
            case 'go': {
              const m = await import('@codemirror/lang-go')
              extModule = m.go()
              break
            }
            case 'php': {
              const m = await import('@codemirror/lang-php')
              extModule = m.php()
              break
            }
            case 'json': {
              const m = await import('@codemirror/lang-json')
              extModule = m.json()
              break
            }
            case 'md': case 'markdown': {
              const m = await import('@codemirror/lang-markdown')
              extModule = m.markdown()
              break
            }
            case 'yml': case 'yaml': {
              const m = await import('@codemirror/lang-yaml')
              extModule = m.yaml()
              break
            }
            case 'sh': case 'bash': {
              const m = await import('@codemirror/lang-shell')
              extModule = m.shell()
              break
            }
            case 'js': case 'jsx': case 'mjs': case 'cjs': {
              const m = await import('@codemirror/lang-javascript')
              extModule = m.javascript()
              break
            }
            case 'css': {
              const m = await import('@codemirror/lang-css')
              extModule = m.css()
              break
            }
            case 'scss': case 'sass': {
              const m = await import('@codemirror/lang-css')
              // scss/sass use the postcss/css support in CodeMirror
              extModule = m.css()
              break
            }
            case 'xml': case 'xsl': case 'xslt': case 'html': case 'htm': {
              const m = await import('@codemirror/lang-xml')
              extModule = m.xml()
              break
            }
            case 'c': {
              const m = await import('@codemirror/lang-cpp')
              extModule = m.c()
              break
            }
            case 'cpp': case 'cc': case 'cxx': case 'h': case 'hpp': {
              const m = await import('@codemirror/lang-cpp')
              extModule = m.cpp()
              break
            }
            default: {
              // fallback: no language extension
              extModule = null
            }
          }
          if (mounted) setLangExt(extModule)
        } catch (e) {
          console.warn('Failed to load language extension', e)
          if (mounted) setLangExt(null)
        }
      })()
    return () => { mounted = false }
  }, [CM, path])

  const onSave = async () => {
    if (!path) return
    try {
      await saveFile(path, content)
      onSaved && onSaved()
      setOrigContent(content)
    } catch (e) {
      console.warn('save failed', e)
    }
  }

  const onReload = async () => {
    if (!path) return
    if (content !== origContent) {
      if (!confirm('You have unsaved changes. Reloading will discard them. Continue?')) return
    }
    setLoading(true)
    try {
      const pt = await probeFileType(path)
      setProbe(pt)
      if (!pt.isText) {
        setContent('')
        setOrigContent('')
        return
      }
      const text = await readFile(path)
      setContent(text)
      setOrigContent(text)
    } catch (e) {
      console.warn('reload failed', e)
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async () => {
    if (!path) return
    if (!confirm(`Delete ${path}? This will move the file to server-side trash.`)) return
    try {
      await deleteFile(path)
      setContent('')
    } catch (e) {
      console.warn('delete failed', e)
    }
  }


  // Render fallback while CodeMirror or language is loading
  if (!CM) {
    return (
      <div style={{ height: '100%' }}>
        <div style={{ padding: 12 }} className="muted">CodeMirror loading…</div>
        {/* show existing overlay preview as fallback */}
        <pre style={{ padding: 12, whiteSpace: 'pre-wrap' }}>{content}</pre>
      </div>
    )
  }

  const CodeMirror = CM

  const hasUnsaved = content !== origContent

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
        <strong style={{ alignSelf: 'center' }}>CodeMirror Editor</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="link icon-btn" title="Reload" aria-label="Reload" onClick={onReload} disabled={!path}>
            <Icon name={getIcon('refresh') || 'icon-refresh'} title="Reload" size={16} />
          </button>
          <button className="link icon-btn" title="Save" aria-label="Save" onClick={onSave} disabled={!path || !hasUnsaved}>
            <Icon name={getIcon('upload') || 'icon-upload'} title="Save" size={16} />
          </button>
          <button className="btn btn-danger" onClick={onDelete} disabled={!path}>Delete</button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <CodeMirror
          value={content}
          height="100%"
          theme={theme}
          extensions={langExt ? [langExt] : []}
          onChange={(value: string) => setContent(value)}
        />
      </div>
    </div>
  )
}
