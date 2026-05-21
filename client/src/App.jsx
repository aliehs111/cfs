import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || ''
import Nav from './components/Nav'
import Footer from './components/Footer'
import ChatWidget from './components/ChatWidget'
import UpdateBanner from './components/UpdateBanner'
import Home from './pages/Home'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import DiscussPage from './pages/DiscussPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import AdminPage from './pages/AdminPage'

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
    fetch(`${API_BASE}/api/track/visit`, {
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

function ChatGate() {
  const location = useLocation()
  if (location.pathname.startsWith('/admin')) return null
  return <ChatWidget />
}

export default function App() {
  return (
    <BrowserRouter>
      <UpdateBanner />
      <PageTracker />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:slug" element={<ProjectDetailPage />} />
          <Route path="/discuss" element={<DiscussPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
      <Footer />
      <ChatGate />
    </BrowserRouter>
  )
}
