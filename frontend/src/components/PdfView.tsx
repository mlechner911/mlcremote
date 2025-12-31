import React from 'react'
const PdfPreview = React.lazy(() => import('./PdfPreview'))

export default function PdfView({ path }: { path: string }) {
  return (
    <React.Suspense fallback={<div className="muted">Loading PDF preview…</div>}>
      <PdfPreview path={path} />
    </React.Suspense>
  )
}
