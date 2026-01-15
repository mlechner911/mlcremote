import React from 'react'
import { getToken, authedFetch, makeUrl } from '../utils/auth'
import { useTranslation } from 'react-i18next'

export default function PdfPreview({ path }: { path: string }) {
  const { t } = useTranslation()
  const [pdfLib, setPdfLib] = React.useState<any | null>(null)
  const [pdfDoc, setPdfDoc] = React.useState<any | null>(null)
  const [pageNum, setPageNum] = React.useState<number>(1)
  const [numPages, setNumPages] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [errorState, setErrorState] = React.useState<string>('')
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  // load pdfjs library and set worker
  React.useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const pdfjs = await import('pdfjs-dist/build/pdf')
          // Use Vite's URL import to get the correct path to the worker in production/dev
          // @ts-ignore
          const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default

          // @ts-ignore
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
          if (!mounted) return
          setPdfLib(pdfjs)
        } catch (e: any) {
          console.error('Failed to load pdfjs', e)
          if (mounted) setErrorState(e.message || 'Failed to load PDF library')
        }
      })()
    return () => { mounted = false }
  }, [])

  // fetch PDF and load document
  React.useEffect(() => {
    if (!pdfLib) return
    let cancelled = false
    setErrorState('')
      ; (async () => {
        setLoading(true)
        try {
          // use authedFetch to include token header when required
          const r = await authedFetch(`/api/file?path=${encodeURIComponent(path)}`)
          if (!r.ok) {
            const txt = await r.text().catch(() => '')
            throw new Error(`fetch failed: ${r.status} ${txt}`)
          }
          const data = await r.arrayBuffer()
          const loadingTask = pdfLib.getDocument({ data })
          const doc = await loadingTask.promise
          if (cancelled) return
          setPdfDoc(doc)
          setNumPages(doc.numPages || null)
          setPageNum(1)
        } catch (e: any) {
          console.error('Failed to load PDF', e)
          if (!cancelled) {
            setPdfDoc(null)
            setErrorState(e.message || 'Failed to load document')
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    return () => { cancelled = true }
  }, [pdfLib, path])

  // render current page to canvas
  React.useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let mounted = true
      ; (async () => {
        try {
          const page = await pdfDoc.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.25 })
          const canvas = canvasRef.current as HTMLCanvasElement
          const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
          canvas.width = Math.min(viewport.width, window.innerWidth * 0.9)
          canvas.height = viewport.height
          const renderContext = { canvasContext: ctx, viewport }
          const renderTask = page.render(renderContext)
          await renderTask.promise
        } catch (e) {
          if (mounted) console.error('PDF render failed', e)
        }
      })()
    return () => { mounted = false }
  }, [pdfDoc, pageNum])

  if (!pdfLib && !errorState) return <div className="muted">{t('loading_pdf_support')}</div>
  if (loading && !pdfDoc && !errorState) return <div className="muted">{t('loading_pdf')}</div>

  // Expose error if present
  if (errorState) return (
    <div style={{ padding: 12 }}>
      <div className="muted" style={{ color: 'var(--danger)' }}>{t('error', 'Error')}: {errorState}</div>
      <div style={{ marginTop: 8 }}>
        <a className="link" href={makeUrl(`/api/file?path=${encodeURIComponent(path)}`)} download={path.split(/[/\\]/).pop()}>{t('download')}</a>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1}>{t('previous')}</button>
        <span>{pageNum}{numPages ? ` / ${numPages} ` : ''}</span>
        <button className="btn" onClick={() => setPageNum(p => Math.min((numPages || Infinity), p + 1))} disabled={numPages ? pageNum >= numPages : false}>{t('next')}</button>
        <a className="link" href={makeUrl(`/api/file?path=${encodeURIComponent(path)}`)} download={path.split(/[/\\]/).pop()}>{t('download')}</a>
      </div>
      <div style={{ marginTop: 8 }}>
        {(!pdfDoc) ? <div className="muted">{t('no_preview')}</div> : <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />}
      </div>
    </div>
  )
}
