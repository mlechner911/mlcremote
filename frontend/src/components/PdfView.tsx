import React from 'react'
import { useTranslation } from 'react-i18next'
const PdfPreview = React.lazy(() => import('./PdfPreview'))

export default function PdfView({ path }: { path: string }) {
  const { t } = useTranslation()
  return (
    <React.Suspense fallback={<div className="muted">{t('loading_pdf')}</div>}>
      <PdfPreview path={path} />
    </React.Suspense>
  )
}
