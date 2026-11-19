import { Link } from 'react-router-dom'

// Expertise (Nov 19 2026): an outline of Cavalier's services, mainly for
// search. Each service has its own <h2> and an anchor id (e.g.
// /expertise#resilient) so menus and other pages can link straight to it.
//
// Source: server/knowledge_base.md (the chatbot's ground truth). Nothing here
// should go beyond it. TODO(founder): review the service names and wording;
// the flooring vocabulary still needs a founder audit (Nov 2026).
// Note: K-12 schools are deliberately not listed (Cavalier doesn't usually
// do them); higher education is.

const SERVICES = [
  {
    id: 'carpet',
    name: 'Carpet',
    summary:
      'Carpet tile is the most common floor on commercial projects, and a core part of our work in offices, multi-family buildings and corridors.',
    items: ['Carpet tile', 'Carpet'],
  },
  {
    id: 'resilient',
    name: 'Resilient flooring',
    summary:
      'Durable, low-maintenance floors for heavy traffic. LVT has largely replaced VCT in commercial work because it holds up better and needs no stripping and waxing, but VCT is still the right call in cost-sensitive spaces, and we install both.',
    items: ['Luxury vinyl tile (LVT)', 'Vinyl composition tile (VCT)', 'Sheet vinyl', 'Rubber flooring'],
  },
  {
    id: 'tile',
    name: 'Floor and wall tile',
    summary: 'Hard tile for floors and walls, from lobbies and restrooms to corridors and amenity spaces.',
    items: ['Ceramic tile', 'Porcelain tile', 'Wall tile'],
  },
  {
    id: 'wall-panels',
    name: 'Specialty wall panels',
    summary: 'Specialty wall panel systems installed alongside the flooring package.',
    items: ['Specialty wall panels'],
  },
  {
    id: 'subfloor',
    name: 'Subfloor preparation',
    summary:
      'A floor is only as good as the slab under it. We assess and prepare concrete slabs before installation, so moisture and unevenness don’t become flooring failures later.',
    items: ['Moisture mitigation', 'Floor leveling', 'Slab rehab and preparation'],
  },
  {
    id: 'furnish-install',
    name: 'Furnish and install',
    summary:
      'You or your architect select the materials; we purchase them from the manufacturer or distributor on your behalf and install them with our own crews, or with trusted installation partners when a project’s scale or location calls for it. One company furnishing and installing keeps the supply chain documented and the manufacturer’s warranty intact.',
    items: ['Material purchasing', 'In-house installation crews', 'Manufacturer warranty preservation'],
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
        Cavalier Flooring Systems furnishes and installs commercial flooring and surfaces across Virginia, working as
        a subcontractor to general contractors and directly with owners, property managers, architects and designers.
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
            Based west of Richmond, we serve Charlottesville, Central Virginia up to Fredericksburg, and the Tidewater
            region, including Virginia Beach and Norfolk.
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
