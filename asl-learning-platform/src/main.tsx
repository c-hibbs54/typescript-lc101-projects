import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// `basename` must track Vite's `base`, or a subpath deploy (GitHub Pages serves
// this project at /<repo>/) matches no route and renders a blank page with
// off-site nav links. import.meta.env.BASE_URL is '/' in dev and the configured
// base in a Pages build, so this is correct in both.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
