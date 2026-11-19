import { NavLink, useLocation } from 'react-router-dom'

// Pages where, on laptop/desktop, the footer sits over the page's photo with
// no charcoal band or top line (.footer-over-photo in index.css).
const OVER_PHOTO_PATHS = ['/about']

const detail = {
  color: 'var(--off-white)',
  opacity: 0.75,
  fontSize: '0.8rem',
  letterSpacing: '0.05em',
  textDecoration: 'none',
  fontStyle: 'normal',
  whiteSpace: 'nowrap',
}

export default function Footer() {
  const { pathname } = useLocation()
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const overPhoto = OVER_PHOTO_PATHS.includes(path)
  return (
    <footer
      className={`py-8 px-6${overPhoto ? ' footer-over-photo' : ''}`}
      style={{
        borderTop: '1px solid rgba(236, 228, 215, 0.08)',
        backgroundColor: 'var(--charcoal)',
      }}
    >
      {/* One row on laptop/desktop, spread edge to edge: name, phone, address,
          copyright. Stacked on phones and tablets. lg:pr-20 leaves room for
          the round chat button fixed in the bottom-right corner. */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-8 lg:pr-20">
        {/* brand + hidden admin gear (visible on group hover) */}
        <div className="group flex items-center gap-4">
          <NavLink to="/" style={{ textDecoration: 'none' }}>
            <span
              className="font-display uppercase"
              style={{
                color: 'var(--off-white)',
                fontSize: '0.85rem',
                letterSpacing: '0.18em',
              }}
            >
              © {new Date().getFullYear()} Cavalier Flooring Systems
            </span>
          </NavLink>
          <NavLink
            to="/admin"
            aria-label="Admin"
            title="Admin"
            className="opacity-0 group-hover:opacity-60 focus-visible:opacity-100 transition-opacity duration-300"
            style={{ color: 'var(--off-white)', display: 'inline-flex' }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </NavLink>
        </div>


        {/* Keep the phone and address exactly as on the Google Business
            Profile (src/seo.js has the same details). */}
        {/* Phone and address read as one line, separated by a dot; on
            phones they wrap onto two lines (the dot is hidden there). */}
        <address className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3" style={{ ...detail, opacity: 1 }}>
          <a href="tel:+18042547700" style={detail}>
            (804) 254-7700
          </a>
          <span aria-hidden="true" className="hidden sm:inline" style={{ ...detail, opacity: 0.4 }}>
            ·
          </span>
          <span style={detail}>2020 Tomlynn Street, Richmond, VA 23230</span>
        </address>
        {/* Privacy stays linked from every page because the site collects
            contact details. (The copyright is with the company name, left.) */}
        <NavLink
          to="/privacy"
          style={{ ...detail, opacity: 0.6, fontSize: '0.75rem', borderBottom: '1px solid rgba(236,228,215,0.3)' }}
        >
          Privacy Policy
        </NavLink>
      </div>
    </footer>
  )
}
