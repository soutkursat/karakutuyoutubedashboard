import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { init } from './lib/db'
import './styles.css'

void init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
