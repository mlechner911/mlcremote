import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import 'prismjs/themes/prism-tomorrow.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
