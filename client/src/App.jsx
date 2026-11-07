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
import LoginPage from './pages/LoginPage'
import MyAlertsPage from './pages/MyAlertsPage'
import PrivacyPage from './pages/PrivacyPage'
import FieldPage from './pages/FieldPage'
import FieldPostPage from './pages/FieldPostPage'
import NotFoundPage from './pages/NotFoundPage'

// Staff-only pages: no chat bubble, no visit tracking.
const isStaffPath = (path) =>
  path.startsWith('/admin') || path.startsWith('/login') || path.startsWith('/my-alerts') || path.startsWith('/in-the-field/post')

// New colour palette, rolled out page by page. Currently: homepage only
// (including the header and footer while you're on it).
const NEW_PALETTE_PATHS = ['/']

function PaletteScope() {
  const { pathname } = useLocation()
  useEffect(() => {
    const root = document.documentElement
    if (NEW_PALETTE_PATHS.includes(pathname)) root.dataset.palette = '2026'
    else delete root.dataset.palette
  }, [pathname])
  return null
}

function PageTracker() {
  const location = useLocation()
  const lastTracked = useRef(null)

  useEffect(() => {
    const path = location.pathname

    if (!location.hash) {
      window.scrollTo(0, 0)
    }

    if (isStaffPath(path)) return
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
  if (isStaffPath(location.pathname)) return null
  return <ChatWidget />
}

export default function App() {
  return (
    <BrowserRouter>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <UpdateBanner />
      <PageTracker />
      <PaletteScope />
      <Nav />
      <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:slug" element={<ProjectDetailPage />} />
          <Route path="/discuss" element={<DiscussPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/in-the-field" element={<FieldPage />} />
          <Route path="/in-the-field/post" element={<FieldPostPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/my-alerts" element={<MyAlertsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <ChatGate />
    </BrowserRouter>
  )
}
