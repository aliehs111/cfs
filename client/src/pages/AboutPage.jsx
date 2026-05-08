export default function AboutPage() {
  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-32">
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(2.5rem, 7vw, 5rem)',
          letterSpacing: '-0.02em',
          color: 'var(--off-white)',
        }}
      >
        About
      </h1>
      <p className="mt-6" style={{ color: 'var(--off-white)', opacity: 0.6 }}>
        Coming soon.
      </p>
    </section>
  )
}
