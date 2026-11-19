import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Pre-built pages (and index.html) carry title/description/preview tags
// marked data-seo for search engines. Once the app runs, components/Seo.jsx
// manages those tags, so remove the static copies to avoid duplicates.
document.querySelectorAll('head [data-seo]').forEach((el) => el.remove())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
