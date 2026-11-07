import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/', label: 'Home', exact: true },
  { to: '/projects', label: 'Projects' },
  { to: '/in-the-field', label: 'In the Field' },
  { to: '/discuss', label: 'How can we help?' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

// Six links need ~800px in one row, so the menu button is used below `lg`
// (1024px), which also covers tablets in portrait.
export default function Nav() {
  const { pathname } = useLocation()
  // The menu belongs to the page it was opened on, so any navigation
  // (a link tap, the back button) closes it without extra bookkeeping.
  const [openOn, setOpenOn] = useState(null)
  const open = openOn === pathname
  const close = useCallback(() => setOpenOn(null), [])
  const menuButton = useRef(null)

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
          onClick={close}
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

        <nav className="hidden lg:flex gap-8" aria-label="Main">
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

        <MenuButton ref={menuButton} open={open} onToggle={() => setOpenOn(open ? null : pathname)} />
      </div>

      {open && <MobileMenu onClose={close} returnFocusTo={menuButton} />}
    </header>
  )
}

function MenuButton({ ref, open, onToggle }) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="mobile-menu"
      className="lg:hidden flex items-center gap-3 text-xs uppercase"
      style={{
        color: 'var(--off-white)',
        letterSpacing: '0.18em',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '10px',
        margin: '-10px', // bigger tap target without shifting the layout
      }}
    >
      {open ? 'Close' : 'Menu'}
      <span aria-hidden="true" className="relative inline-block" style={{ width: 18, height: 12 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute left-0"
            style={{
              width: 18,
              height: 1,
              backgroundColor: 'var(--off-white)',
              top: open ? 6 : i * 5.5,
              opacity: open && i === 1 ? 0 : 1,
              transform: open ? `rotate(${i === 0 ? 45 : -45}deg)` : 'none',
              transition: 'transform 0.2s ease, top 0.2s ease, opacity 0.2s ease',
            }}
          />
        ))}
      </span>
    </button>
  )
}

function MobileMenu({ onClose, returnFocusTo }) {
  const firstLink = useRef(null)

  useEffect(() => {
    const button = returnFocusTo.current
    firstLink.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      button?.focus()
    }
  }, [onClose, returnFocusTo])

  return (
    <div className="lg:hidden">
      {/* Tapping anywhere outside the links closes the menu. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-x-0 top-full"
        style={{ height: '100dvh', backgroundColor: 'rgba(0,0,0,0.5)' }}
      />
      <nav
        id="mobile-menu"
        aria-label="Main"
        className="absolute inset-x-0 top-full"
        style={{
          backgroundColor: 'var(--charcoal)',
          borderBottom: '1px solid rgba(236, 228, 215, 0.08)',
          maxHeight: 'calc(100dvh - 80px)', // header is ~72px tall
          overflowY: 'auto',
        }}
      >
        <ul className="max-w-7xl mx-auto px-6 pb-6" style={{ listStyle: 'none', margin: 0 }}>
          {NAV_LINKS.map(({ to, label, exact }, i) => (
            <li key={to} style={{ borderTop: '1px solid rgba(236, 228, 215, 0.08)' }}>
              <NavLink
                ref={i === 0 ? firstLink : undefined}
                to={to}
                end={exact}
                onClick={onClose}
                className="flex items-center justify-between text-sm uppercase no-underline"
                style={{
                  color: 'var(--off-white)',
                  letterSpacing: '0.18em',
                  padding: '18px 0', // ~56px rows: easy to tap with a thumb or a glove
                }}
              >
                {({ isActive }) => (
                  <>
                    <span style={{ opacity: isActive ? 1 : 0.8 }}>{label}</span>
                    {isActive && (
                      <span aria-hidden="true" style={{ width: 24, height: 1, backgroundColor: 'var(--maroon)' }} />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
