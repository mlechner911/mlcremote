import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Inject generated SVG sprite into the DOM
(async () => {
    try {
        console.log("Loading icon sprite...")
        // @ts-ignore
        const mod = await import('./generated/icons-sprite.svg?raw')
        const sprite = (mod && (mod.default || mod)) as string | undefined
        console.log("Sprite loaded, length:", sprite?.length)
        if (sprite && typeof document !== 'undefined') {
            const container = document.createElement('div')
            container.style.width = '0'
            container.style.height = '0'
            container.style.position = 'absolute'
            container.style.visibility = 'hidden'
            container.innerHTML = sprite
            document.body.insertBefore(container, document.body.firstChild)
            console.log("Sprite injected into DOM")
        }
    } catch (e) {
        console.error('Failed to load icon sprite:', e)
    }
})()

createRoot(document.getElementById('root')!).render(<App />)
