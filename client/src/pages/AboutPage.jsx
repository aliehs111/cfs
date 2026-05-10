import { Link } from 'react-router-dom'
import subwayTile from '../../assets/subway_tile_column.jpg'

export default function AboutPage() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: 'var(--cream)' }}
    >
      {/* Mobile: image strip at top, fades into cream below */}
      <div className="md:hidden relative" style={{ height: '320px' }}>
        <img
          src={subwayTile}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(249,245,239,0) 30%, var(--cream) 100%)',
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
          src={subwayTile}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background:
              'linear-gradient(to right, var(--cream) 0%, rgba(249,245,239,0.95) 30%, rgba(249,245,239,0.6) 60%, rgba(249,245,239,0.2) 100%)',
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
              className="font-body mb-20"
              style={{
                color: 'rgba(26,24,22,0.78)',
                fontSize: '17px',
                lineHeight: 1.85,
                fontWeight: 300,
              }}
            >
              Cavalier Flooring Systems has been installing commercial floors across Virginia under the same ownership since 1981. We work with general contractors, architects, designers, facility managers, and end-user owners on commercial projects across central Virginia and the Tidewater region.
            </p>

            <p
              className="font-body text-xs font-medium tracking-widest uppercase mb-5"
              style={{ color: 'rgba(26,24,22,0.4)', letterSpacing: '0.16em' }}
            >
              Sectors
            </p>
            <p
              className="font-body mb-14"
              style={{
                color: 'rgba(26,24,22,0.78)',
                fontSize: '17px',
                lineHeight: 1.85,
                fontWeight: 300,
              }}
            >
              Healthcare. Retail. Multi-family. Office and corporate. Higher education.
            </p>

            <div className="hairline-dark mb-14" />

            <p
              className="font-body text-xs font-medium tracking-widest uppercase mb-5"
              style={{ color: 'rgba(26,24,22,0.4)', letterSpacing: '0.16em' }}
            >
              What we install
            </p>
            <p
              className="font-body mb-14"
              style={{
                color: 'rgba(26,24,22,0.78)',
                fontSize: '17px',
                lineHeight: 1.85,
                fontWeight: 300,
              }}
            >
              LVT. VCT. Carpet tile. Sheet vinyl. Ceramic tile.
            </p>

            <div className="hairline-dark mb-14" />

            <p
              className="font-body text-xs font-medium tracking-widest uppercase mb-5"
              style={{ color: 'rgba(26,24,22,0.4)', letterSpacing: '0.16em' }}
            >
              Where we work
            </p>
            <p
              className="font-body mb-20"
              style={{
                color: 'rgba(26,24,22,0.78)',
                fontSize: '17px',
                lineHeight: 1.85,
                fontWeight: 300,
              }}
            >
              Charlottesville. Central Virginia up to Fredericksburg. The Tidewater region — Virginia Beach, Norfolk, and the wider Hampton Roads area.
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
