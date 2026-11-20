import { Link } from 'react-router-dom'

// Expertise (Nov 19 2026): an outline of Cavalier's services, mainly for
// search. Each service has its own <h2> and an anchor id (e.g.
// /expertise#resilient) so menus and other pages can link straight to it.
//
// Source: server/knowledge_base.md (the chatbot's ground truth). Nothing here
// should go beyond it. Wording replaced Nov 20 2026 with copy supplied by the
// site owner.
// Note: K-12 schools are deliberately not listed (Cavalier doesn't usually
// do them); higher education is.

const SERVICES = [
  {
    id: 'carpet',
    name: 'Carpet',
    summary:
      'Carpet and carpet tile installations for offices, corporate interiors, multi-family properties, corridors, and common areas. We work with a wide range of commercial products, installation methods, and design layouts, from straightforward installations to projects involving multiple patterns, colors, and transitions.',
    items: ['Carpet tile', 'Carpet'],
  },
  {
    id: 'resilient',
    name: 'Resilient flooring',
    summary:
      'LVT, VCT, sheet vinyl, and rubber flooring for commercial environments ranging from offices and retail spaces to healthcare and educational facilities. Each material has its own installation requirements, and we work with the products specified for the project, including the necessary adhesives, transitions, and finishing details.',
    items: ['Luxury vinyl tile (LVT)', 'Vinyl composition tile (VCT)', 'Sheet vinyl', 'Rubber flooring'],
  },
  {
    id: 'tile',
    name: 'Floor and wall tile',
    summary:
      'Ceramic and porcelain tile installations for floors and walls in lobbies, restrooms, corridors, and other commercial spaces. Our work includes a variety of tile sizes, patterns, and layouts, with attention to substrate conditions, installation details, and transitions to adjoining finishes.',
    items: ['Ceramic tile', 'Porcelain tile', 'Wall tile'],
  },
  {
    id: 'wall-panels',
    name: 'Specialty wall panels',
    summary:
      'Specialty wall panel systems installed as part of commercial interior construction and renovation projects. We coordinate panel installation with surrounding finishes and other trades to accommodate the design and construction requirements of each space.',
    items: ['Specialty wall panels'],
  },
  {
    id: 'subfloor',
    name: 'Subfloor preparation',
    summary:
      'What goes beneath the finished floor matters. We assess existing substrate conditions and perform concrete slab preparation, floor leveling, and moisture mitigation as required for the specified flooring system. This work is especially important in renovations, where existing conditions may not be apparent until flooring is removed.',
    items: ['Moisture mitigation', 'Floor leveling', 'Slab rehab and preparation'],
  },
  {
    id: 'furnish-install',
    name: 'Furnish and install',
    summary:
      'Cavalier handles material procurement and installation as a coordinated flooring subcontract. We work with manufacturers and distributors to source specified products, manage material deliveries, and coordinate installation with the construction schedule. Our own crews and established installation partners allow us to accommodate projects of varying sizes and locations.',
    items: ['Material purchasing', 'In-house installation crews', 'Installation coordination'],
  },
]

const SECTORS = ['Offices and corporate interiors', 'Multi-family', 'Healthcare', 'Higher education', 'Retail', 'Corridors and common areas']

const label = {
  color: 'var(--maroon-text)',
  letterSpacing: '0.16em',
  fontSize: '0.7rem',
}
const body = {
  color: 'var(--off-white)',
  opacity: 0.8,
  fontSize: '16px',
  lineHeight: 1.75,
  fontWeight: 300,
}

export default function ExpertisePage() {
  return (
    <section className="w-full max-w-7xl mx-auto px-6 md:px-14 py-16 md:py-24">
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(2.5rem, 7vw, 5rem)',
          letterSpacing: '-0.02em',
          color: 'var(--off-white)',
          lineHeight: 0.95,
        }}
      >
        Expertise
      </h1>
      <p className="mt-6 max-w-2xl" style={{ ...body, fontSize: '17px' }}>
        Since 1981, Cavalier Flooring Systems has furnished and installed commercial flooring and specialty surfaces
        throughout Virginia. We work with general contractors, building owners, property managers, architects, and
        designers on new construction, renovations, and occupied facilities. From material procurement and subfloor
        preparation through installation, our work covers the full scope of a commercial flooring project.
      </p>

      <div className="mt-14 md:mt-20" style={{ borderTop: '1px solid rgba(236, 228, 215, 0.12)' }}>
        {SERVICES.map((s) => (
          <article
            key={s.id}
            id={s.id}
            className="grid md:grid-cols-12 gap-4 md:gap-8 py-10 md:py-12"
            style={{ borderBottom: '1px solid rgba(236, 228, 215, 0.12)', scrollMarginTop: '96px' }}
          >
            <h2
              className="md:col-span-4 font-display"
              style={{ color: 'var(--off-white)', fontSize: 'clamp(1.5rem, 2.4vw, 2rem)', fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.01em' }}
            >
              {s.name}
            </h2>
            <div className="md:col-span-8">
              <p style={body}>{s.summary}</p>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                {s.items.map((item) => (
                  <li key={item} className="uppercase" style={label}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <div className="grid md:grid-cols-12 gap-4 md:gap-8 mt-14 md:mt-20">
        <h2
          className="md:col-span-4 font-display"
          style={{ color: 'var(--off-white)', fontSize: 'clamp(1.5rem, 2.4vw, 2rem)', fontWeight: 500, lineHeight: 1.15 }}
        >
          Where we work
        </h2>
        <div className="md:col-span-8">
          <p style={body}>
            Based west of Richmond, Cavalier serves commercial projects throughout Central Virginia, including
            Charlottesville and Fredericksburg, as well as the Tidewater region, including Norfolk and Virginia Beach.
            Our experience spans corporate interiors, multi-family housing, healthcare, higher education, retail, and
            other commercial environments.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            {SECTORS.map((item) => (
              <li key={item} className="uppercase" style={label}>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
            <Link to="/projects" className="nav-link uppercase text-xs" style={{ letterSpacing: '0.14em', borderBottom: '1px solid rgba(236,228,215,0.35)', paddingBottom: '3px' }}>
              See our projects →
            </Link>
            <Link to="/contact" className="nav-link uppercase text-xs" style={{ letterSpacing: '0.14em', borderBottom: '1px solid rgba(236,228,215,0.35)', paddingBottom: '3px' }}>
              Start a conversation →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
