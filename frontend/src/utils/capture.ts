import html2canvas from 'html2canvas'

export async function captureElementToPng(el: HTMLElement, filename = 'mlcremote-screenshot.png') {
  const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 })
  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}
