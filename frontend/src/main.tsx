import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { captureTokenFromURL } from './api'
import './editor-theme.css'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

// Initialize auth/api from URL if present
console.log('MLCRemote: captureTokenFromURL type:', typeof captureTokenFromURL)
try {
	if (typeof captureTokenFromURL === 'function') {
		captureTokenFromURL()
	} else {
		console.error('MLCRemote: captureTokenFromURL is not a function!')
	}
} catch (e) {
	console.error('MLCRemote: Initialization error', e)
}

// Inject generated SVG sprite into the DOM so <use href="#icon-..."> works.
// Dynamically import the sprite as raw text (Vite supports `?raw`) and insert it.
(async () => {
	try {
		const mod = await import('./generated/icons-sprite.svg?raw')
		const sprite = (mod && (mod.default || mod)) as string | undefined
		if (sprite && typeof document !== 'undefined') {
			const container = document.createElement('div')
			container.style.width = '0'
			container.style.height = '0'
			container.style.position = 'absolute'
			container.style.visibility = 'hidden'
			container.innerHTML = sprite
			document.body.insertBefore(container, document.body.firstChild)
		}
	} catch (e: any) {
		// sprite not available — continue without throwing ??
		alert('Failed to load icon sprite: ' + (e?.message || e))
	}
})()

// Application entrypoint — go for it
createRoot(document.getElementById('root')!).render(<AuthProvider>
	<App />
</AuthProvider>)
