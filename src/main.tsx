import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/tinos/latin-400.css'
import { TINOS_WOFF2_URL } from './chemistry/atomFont'
import App from './App'
import './index.css'

const preload = document.createElement('link')
preload.rel = 'preload'
preload.as = 'font'
preload.type = 'font/woff2'
preload.crossOrigin = 'anonymous'
preload.href = TINOS_WOFF2_URL
document.head.appendChild(preload)
void document.fonts.load(`16px Tinos`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
