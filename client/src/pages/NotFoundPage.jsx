import { Link } from 'react-router-dom'

const linkStyle = {
  color: 'var(--off-white)',
  textDecoration: 'none',
  borderBottom: '1px solid var(--maroon)',
  paddingBottom: '2px',
}

export default function NotFoundPage() {
  return (
    <section className="w-full max-w-3xl mx-auto px-6 py-32">
      <p
        className="uppercase"
        style={{ color: 'var(--maroon)', letterSpacing: '0.16em', fontSize: '0.7rem', margin: 0 }}
      >
        Page not found
      </p>
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
          letterSpacing: '-0.02em',
          color: 'var(--off-white)',
          lineHeight: 1,
          marginTop: '1rem',
        }}
      >
        We couldn't find that page.
      </h1>
      <p
        style={{
          marginTop: '1.5rem',
          fontSize: '0.95rem',
          lineHeight: 1.8,
          color: 'var(--off-white)',
          opacity: 0.7,
          maxWidth: '34rem',
        }}
      >
        It may have moved when we rebuilt the site. Try one of these instead.
      </p>
      <div className="flex flex-wrap gap-x-8 gap-y-4 mt-10 text-xs uppercase" style={{ letterSpacing: '0.14em' }}>
        <Link to="/" style={linkStyle}>Home</Link>
        <Link to="/projects" style={linkStyle}>Projects</Link>
        <Link to="/in-the-field" style={linkStyle}>In the Field</Link>
        <Link to="/contact" style={linkStyle}>Contact</Link>
      </div>
    </section>
  )
}
