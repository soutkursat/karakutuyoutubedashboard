import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { init } from './lib/db'
import { applyTheme } from './lib/theme'
import './styles.css'

applyTheme()
void init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
