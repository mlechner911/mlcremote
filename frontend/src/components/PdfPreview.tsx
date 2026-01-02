import React from 'react'
import { getToken, authedFetch, makeUrl } from '../utils/auth'

export default function PdfPreview({ path }: { path: string }) {
  const [pdfLib, setPdfLib] = React.useState<any | null>(null)
  const [pdfDoc, setPdfDoc] = React.useState<any | null>(null)
  const [pageNum, setPageNum] = React.useState<number>(1)
  const [numPages, setNumPages] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  // load pdfjs library and set worker
  React.useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const pdfjs = await import('pdfjs-dist/legacy/build/pdf')
          // use the worker served from public/pdf.worker.mjs
          // @ts-ignore
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
          if (!mounted) return
          setPdfLib(pdfjs)
        } catch (e) {
          console.error('Failed to load pdfjs', e)
        }
      })()
    return () => { mounted = false }
  }, [])

  // fetch PDF and load document
  React.useEffect(() => {
    if (!pdfLib) return
    let cancelled = false
      ; (async () => {
        setLoading(true)
        try {
          // use authedFetch to include token header when required
          const r = await authedFetch(`/api/file?path=${encodeURIComponent(path)}`)
          if (!r.ok) throw new Error('fetch failed')
          const data = await r.arrayBuffer()
          const loadingTask = pdfLib.getDocument({ data })
          const doc = await loadingTask.promise
          if (cancelled) return
          setPdfDoc(doc)
          setNumPages(doc.numPages || null)
          setPageNum(1)
        } catch (e) {
          console.error('Failed to load PDF', e)
          if (!cancelled) setPdfDoc(null)
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

  if (!pdfLib) return <div className="muted">Loading PDF support…</div>
  if (loading && !pdfDoc) return <div className="muted">Loading PDF…</div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1}>Prev</button>
        <span>{pageNum}{numPages ? ` / ${numPages} ` : ''}</span>
        <button className="btn" onClick={() => setPageNum(p => Math.min((numPages || Infinity), p + 1))} disabled={numPages ? pageNum >= numPages : false}>Next</button>
        <a className="link" href={makeUrl(`/api/file?path=${encodeURIComponent(path)}`)} download={path.split('/').pop()}>Download</a>
      </div>
      <div style={{ marginTop: 8 }}>
        {(!pdfDoc) ? <div className="muted">No preview</div> : <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />}
      </div>
    </div>
  )
}
