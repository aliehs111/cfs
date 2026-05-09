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
          className="font-display no-underline"
          style={{
            color: 'var(--off-white)',
            fontSize: '1.1rem',
            letterSpacing: '0.02em',
          }}
        >
          Cavalier Flooring Systems
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
