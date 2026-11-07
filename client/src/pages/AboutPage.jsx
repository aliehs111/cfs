import { Link } from 'react-router-dom'
// Background: web copy of "assets/Modern Library Lobby with Geometric Carpet.png".
// Colour treatment is set by --about-photo-filter / --about-photo-tint in index.css.
import libraryPhoto from '../../assets/about_library.jpg'

export default function AboutPage() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: 'var(--cream)' }}
    >
      {/* Mobile: image strip at top, fades into cream below */}
      <div className="md:hidden relative" style={{ height: '320px' }}>
        <img
          src={libraryPhoto}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '62% 50%',
            filter: 'var(--about-photo-filter)',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'var(--about-photo-tint)', mixBlendMode: 'multiply' }} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(249,245,239,0) 40%, rgba(249,245,239,0.25) 60%, rgba(249,245,239,0.62) 78%, rgba(249,245,239,0.9) 91%, var(--cream) 100%)',
          }}
        />
      </div>

      {/* Desktop: image bleeds across right side, full page height,
          heavy cream wash on the left half so copy reads cleanly */}
      <div
        className="hidden md:block absolute right-0 top-0 bottom-0 pointer-events-none"
        style={{ width: '55%', zIndex: 0 }}
      >
        <img
          src={libraryPhoto}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '72% 55%',
            filter: 'var(--about-photo-filter)',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'var(--about-photo-tint)', mixBlendMode: 'multiply' }} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background:
              // Solid where the text column overlaps the photo, then an eased
              // fade so more of the tile shows on the right.
              'linear-gradient(to right, var(--cream) 0%, rgba(249,245,239,0.98) 12%, rgba(249,245,239,0.9) 22%, rgba(249,245,239,0.72) 34%, rgba(249,245,239,0.48) 50%, rgba(249,245,239,0.24) 70%, rgba(249,245,239,0.08) 100%)',
          }}
        />
      </div>

      {/* All content sits on the left, layered above the image */}
      <div className="relative z-10 px-8 md:px-14 pt-2 pb-24 md:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="md:max-w-xl">
            <p
              className="font-body text-xs font-medium tracking-widest uppercase mb-12"
              style={{ color: 'var(--maroon)', letterSpacing: '0.16em' }}
            >
              About
            </p>

            <h1
              className="font-display mb-12"
              style={{
                color: 'var(--charcoal)',
                fontSize: 'clamp(2.25rem, 5vw, 4rem)',
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              Commercial flooring, since 1981.
            </h1>

            <div className="hairline-dark mb-10" />

<p
              className="font-body mb-6"
              style={{
                color: 'rgba(26,24,22,0.78)',
                fontSize: '17px',
                lineHeight: 1.85,
                fontWeight: 300,
              }}
            >
              Cavalier Flooring Systems has provided commercial flooring installation services throughout Virginia since 1981, working with general contractors, architects, construction managers, and building owners across a wide range of commercial and institutional projects.
            </p>
            <p
              className="font-body mb-6"
              style={{
                color: 'rgba(26,24,22,0.78)',
                fontSize: '17px',
                lineHeight: 1.85,
                fontWeight: 300,
              }}
            >
              Commercial flooring involves far more than the finished surface. Successful installations begin with an understanding of substrate conditions, moisture, material specifications, and the technical requirements of each flooring system.
            </p>
            <p
              className="font-body mb-8"
              style={{
                color: 'rgba(26,24,22,0.78)',
                fontSize: '17px',
                lineHeight: 1.85,
                fontWeight: 300,
              }}
            >
              From substrate evaluation and floor preparation to the installation of carpet, resilient flooring, ceramic tile, and specialty flooring systems, Cavalier brings decades of practical experience to every phase of the process.
            </p>
            <p
              className="font-body mb-20"
              style={{
                color: 'var(--charcoal)',
                fontSize: '17px',
                lineHeight: 1.85,
                fontWeight: 500,
              }}
            >
              The details matter. Especially the ones you never see.
            </p>

            <div className="hairline-dark mb-12" />

            <Link
              to="/contact"
              className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
              style={{
                color: 'var(--charcoal)',
                letterSpacing: '0.14em',
                borderBottom: '1px solid var(--charcoal)',
                paddingBottom: '3px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Start a conversation →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
