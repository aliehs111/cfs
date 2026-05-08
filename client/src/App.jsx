import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav'
import Footer from './components/Footer'
import Home from './pages/Home'
import ProjectsPage from './pages/ProjectsPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'

function PageTracker() {
  const location = useLocation()
  const lastTracked = useRef(null)

  useEffect(() => {
    const path = location.pathname

    if (!location.hash) {
      window.scrollTo(0, 0)
    }

    if (path.startsWith('/admin')) return
    if (lastTracked.current === path) return
    lastTracked.current = path
    fetch('/api/track/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        referrer: document.referrer || '',
      }),
    }).catch(() => {})
  }, [location.pathname, location.hash])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <PageTracker />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  )
}
