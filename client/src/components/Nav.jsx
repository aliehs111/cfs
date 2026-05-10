import { NavLink } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/', label: 'Home', exact: true },
  { to: '/projects', label: 'Projects' },
  { to: '/discuss', label: 'How can we help?' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export default function Nav() {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        backgroundColor: 'var(--charcoal)',
        borderBottom: '1px solid rgba(236, 228, 215, 0.08)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-6">
        <NavLink
          to="/"
          className="no-underline"
          style={{
            display: 'inline-block',
            borderBottom: '1px solid var(--maroon)',
            paddingBottom: '4px',
          }}
        >
          <span
            style={{
              display: 'block',
              color: 'var(--off-white)',
              fontFamily: 'var(--font-body, "DM Sans"), system-ui, sans-serif',
              fontSize: '1.05rem',
              fontWeight: 500,
              letterSpacing: '0.04em',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            Cavalier
          </span>
          <span
            style={{
              display: 'block',
              color: 'var(--off-white)',
              fontFamily: 'var(--font-body, "DM Sans"), system-ui, sans-serif',
              fontSize: '0.55rem',
              fontWeight: 500,
              letterSpacing: '0.28em',
              opacity: 0.85,
              marginTop: '3px',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            Flooring Systems
          </span>
        </NavLink>
        <nav className="flex gap-8">
          {NAV_LINKS.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `nav-link text-xs uppercase tracking-[0.18em] no-underline ${
                  isActive ? 'nav-link-active' : ''
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
