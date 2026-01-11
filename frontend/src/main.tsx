import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { captureTokenFromURL } from './api'
import './editor-theme.css'
import '@xterm/xterm/css/xterm.css'
import './styles.css'
import i18n from './i18n'

// Initialize auth/api from URL if present
try {
	// Parse logic
	const params = new URLSearchParams(window.location.search)
	const api = params.get('api')
	if (api) {
		try {
			const apiObj = new URL(api)
			const lang = apiObj.searchParams.get('lang')
			if (lang) {
				i18n.changeLanguage(lang)
			}
		} catch (e) {
			// ignore
		}
	}

	if (typeof captureTokenFromURL === 'function') {
		captureTokenFromURL()
	}
} catch (e) {
	// ignore
}

// Global generic drag-and-drop handler to prevent the browser from opening the file
// inside the App window (default WebView behavior).
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault());

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
