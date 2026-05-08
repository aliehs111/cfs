import { NavLink } from 'react-router-dom'

const FOOTER_LINKS = [
  { label: 'Projects', to: '/projects' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export default function Footer() {
  return (
    <footer
      className="py-8 px-6"
      style={{
        borderTop: '1px solid rgba(236, 228, 215, 0.08)',
        backgroundColor: 'var(--charcoal)',
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8">
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
              Cavalier Flooring Systems
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

        {/* nav */}
        <nav>
          <ul className="flex flex-wrap gap-x-8 gap-y-4">
            {FOOTER_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `nav-link text-xs uppercase tracking-[0.18em] no-underline ${
                      isActive ? 'nav-link-active' : ''
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* phone + copyright */}
        <div className="flex flex-col md:items-end gap-2">
          <a
            href="tel:+18042547700"
            style={{
              color: 'var(--off-white)',
              opacity: 0.75,
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
              textDecoration: 'none',
            }}
          >
            (804) 254-7700
          </a>
          <p
            style={{
              color: 'var(--off-white)',
              opacity: 0.3,
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
              margin: 0,
            }}
          >
            © {new Date().getFullYear()} Cavalier Flooring Systems
          </p>
        </div>
      </div>
    </footer>
  )
}
