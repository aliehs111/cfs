import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// Top menu (Nov 19 2026). "Home" is the logo. Two dropdowns plus About.
// RULE: every public page must be reachable from here (directly or in a
// dropdown). The one exception is A Day in the Life, a tab on In the Field.
// Check this list against the routes in App.jsx whenever pages change.
const MENU = [
  {
    label: 'Projects',
    items: [
      { to: '/projects', label: 'Portfolio' },
      { to: '/expertise', label: 'Expertise' },
      // Also highlighted on its A Day in the Life tab.
      { to: '/in-the-field', label: 'In the Field', alsoActive: ['/day-in-the-life'] },
    ],
  },
  { to: '/about', label: 'About' },
  {
    label: 'How can we help?',
    items: [
      { to: '/discuss', label: 'Describe your project' },
      { to: '/contact', label: 'Contact form' },
    ],
  },
]
const isActivePath = (pathname, item) =>
  [item.to, ...(item.alsoActive || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`))
const isGroupActive = (pathname, group) => group.items.some((item) => isActivePath(pathname, item))

// The menu button is used below `lg` (1024px), which also covers tablets in
// portrait.
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

        {/* items-baseline: the dropdown labels are buttons, which otherwise sit a
            few px off the plain links. */}
        <nav className="hidden lg:flex items-baseline gap-8" aria-label="Main">
          {MENU.map((item, i) =>
            item.items ? (
              // The last dropdown opens to the left so it can't run off the screen.
              <DropdownMenu key={item.label} group={item} pathname={pathname} alignRight={i === MENU.length - 1} />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={`nav-link text-xs uppercase tracking-[0.18em] no-underline ${
                  isActivePath(pathname, item) ? 'nav-link-active' : ''
                }`}
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        <MenuButton ref={menuButton} open={open} onToggle={() => setOpenOn(open ? null : pathname)} />
      </div>

      {open && <MobileMenu onClose={close} returnFocusTo={menuButton} />}
    </header>
  )
}

// Desktop dropdown: the label alone (no arrow) opens it. Opens on click (or Enter/Space); closes on Escape, on a
// click outside it, and whenever the page changes. Underlined like an active
// link when the current page is one of its items.
function DropdownMenu({ group, pathname, alignRight = false }) {
  const [openOn, setOpenOn] = useState(null)
  const open = openOn === pathname
  const wrap = useRef(null)
  const button = useRef(null)
  const firstItem = useRef(null)
  // Move focus into the menu only when it was opened from the keyboard; a
  // mouse click shouldn't leave a focus outline on the first item.
  const fromKeyboard = useRef(false)
  const menuId = `menu-${group.label.toLowerCase().replace(/[^a-z]+/g, '-')}`
  const active = isGroupActive(pathname, group)

  useEffect(() => {
    if (!open) return
    if (fromKeyboard.current) firstItem.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpenOn(null)
        button.current?.focus()
      }
    }
    const onPointer = (e) => {
      if (!wrap.current?.contains(e.target)) setOpenOn(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          fromKeyboard.current = e.detail === 0 // Enter/Space clicks report detail 0
          setOpenOn(open ? null : pathname)
        }}
        className={`nav-link text-xs uppercase tracking-[0.18em] ${active ? 'nav-link-active' : ''}`}
        style={{ background: 'none', borderWidth: '0 0 1px 0', borderStyle: 'solid', cursor: 'pointer', padding: '0 0 2px', fontFamily: 'inherit' }}
      >
        {group.label}
      </button>
      {open && (
        <ul
          id={menuId}
          className={`absolute ${alignRight ? 'right-0' : 'left-0'}`}
          style={{
            top: 'calc(100% + 22px)', // drops just below the header bar
            minWidth: 220,
            listStyle: 'none',
            margin: 0,
            padding: '8px 0',
            backgroundColor: 'var(--charcoal)',
            border: '1px solid rgba(236, 228, 215, 0.1)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
          }}
        >
          {group.items.map((item, i) => {
            const itemActive = isActivePath(pathname, item)
            return (
              <li key={item.to}>
                <NavLink
                  ref={i === 0 ? firstItem : undefined}
                  to={item.to}
                  onClick={() => setOpenOn(null)}
                  className="dropdown-link block text-xs uppercase no-underline whitespace-nowrap"
                  style={{ letterSpacing: '0.18em', padding: '12px 22px' }}
                >
                  <span style={{ color: 'var(--off-white)', opacity: itemActive ? 1 : 0.75 }}>
                    {item.label}
                    {itemActive && (
                      <span
                        aria-hidden="true"
                        style={{ display: 'inline-block', width: 16, height: 1, marginLeft: 10, verticalAlign: 'middle', backgroundColor: 'var(--maroon)' }}
                      />
                    )}
                  </span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      )}
    </div>
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
  const { pathname } = useLocation()
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
        {/* Phones/tablets: every page listed; a dropdown's items sit under a
            small heading with its name. */}
        <ul className="max-w-7xl mx-auto px-6 pb-6" style={{ listStyle: 'none', margin: 0 }}>
          {MENU.map((entry, gi) =>
            entry.items ? (
              <li key={entry.label} style={{ borderTop: '1px solid rgba(236, 228, 215, 0.08)', paddingTop: '14px' }}>
                <span
                  className="uppercase"
                  style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.18em', color: 'var(--off-white)', opacity: 0.65 }} // ~6.5:1 on charcoal
                >
                  {entry.label}
                </span>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {entry.items.map((item, i) => (
                    <MobileLink
                      key={item.to}
                      item={item}
                      pathname={pathname}
                      onClose={onClose}
                      linkRef={gi === 0 && i === 0 ? firstLink : undefined}
                    />
                  ))}
                </ul>
              </li>
            ) : (
              <li key={entry.to} style={{ borderTop: '1px solid rgba(236, 228, 215, 0.08)' }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  <MobileLink item={entry} pathname={pathname} onClose={onClose} linkRef={gi === 0 ? firstLink : undefined} />
                </ul>
              </li>
            ),
          )}
          {/* Tap to call, phones only (same number as the footer). */}
          <li style={{ borderTop: '1px solid rgba(236, 228, 215, 0.08)' }}>
            <a
              href="tel:+18042547700"
              onClick={onClose}
              className="flex items-center justify-between text-sm uppercase no-underline"
              style={{ color: 'var(--off-white)', letterSpacing: '0.18em', padding: '14px 0' }}
            >
              <span style={{ opacity: 0.8 }}>Call (804) 254-7700</span>
            </a>
          </li>
        </ul>
      </nav>
    </div>
  )
}

function MobileLink({ item, pathname, onClose, linkRef }) {
  const isActive = isActivePath(pathname, item)
  return (
    <li>
      <NavLink
        ref={linkRef}
        to={item.to}
        onClick={onClose}
        className="flex items-center justify-between text-sm uppercase no-underline"
        style={{
          color: 'var(--off-white)',
          letterSpacing: '0.18em',
          padding: '14px 0', // ~48px rows: easy to tap with a thumb or a glove
        }}
      >
        <span style={{ opacity: isActive ? 1 : 0.8 }}>{item.label}</span>
        {isActive && <span aria-hidden="true" style={{ width: 24, height: 1, backgroundColor: 'var(--maroon)' }} />}
      </NavLink>
    </li>
  )
}
