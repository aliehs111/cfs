// Search and link-preview settings for every public page, in one place.
// Used by the live site (components/Seo.jsx) and by the build step that
// saves each page as ready-made HTML (scripts/prerender.mjs).
//
// Audience: general contractors, architects, owners and property managers.
// Wording targets commercial work on purpose ("commercial", "subcontractor",
// sectors, F&I) and avoids homeowner phrasing ("home", "near me", "free
// estimates"). It never says "no residential": multi-family is commercial
// and nobody is turned away (see specs.md §3).

// The site's real address, e.g. https://www.example.com (no trailing slash).
// Set VITE_SITE_URL on the Railway frontend service at the domain move.
// Until it's set, canonical links, og:url and the sitemap are left out.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/+$/, '')

export const SITE_NAME = 'Cavalier Flooring Systems'

// Default link-preview image (1200 × 630), in client/public.
export const DEFAULT_IMAGE = '/og-image.jpg'

// Public pages: path → title and description. Titles stay under ~65
// characters and descriptions under ~160 so Google shows them in full.
export const PAGES = {
  '/': {
    title: 'Cavalier Flooring Systems | Commercial Flooring Contractor in Virginia',
    description:
      'Commercial flooring subcontractor since 1981. Carpet tile, LVT, VCT, sheet vinyl, tile and slab prep for general contractors and owners across Virginia.',
  },
  '/projects': {
    title: 'Commercial Flooring Projects | Cavalier Flooring Systems',
    description:
      'Healthcare, higher education, multi-family, office and retail flooring projects furnished and installed by Cavalier Flooring Systems across Virginia.',
  },
  '/about': {
    title: 'About Cavalier Flooring Systems | Commercial Flooring Since 1981',
    description:
      'Founded by Randy Basso in 1981, Cavalier Flooring Systems is a commercial flooring contractor known across Richmond and Virginia for decades of experience.',
  },
  '/expertise': {
    title: 'Commercial Flooring Services in Virginia | Cavalier Flooring Systems',
    description:
      'Carpet tile, LVT, VCT, sheet vinyl, rubber, ceramic and porcelain tile, wall panels, and concrete slab moisture mitigation and leveling, furnished and installed.',
  },
  '/contact': {
    title: 'Contact | Cavalier Flooring Systems',
    description:
      'Talk to Cavalier Flooring Systems about your commercial flooring project: bids, specifications, schedules and slab conditions. Call (804) 254-7700.',
  },
  '/discuss': {
    title: 'Describe Your Flooring Project | Cavalier Flooring Systems',
    description:
      'Tell us about your commercial flooring project and get a quick read on scope, products and slab conditions before you talk to our team.',
  },
  '/in-the-field': {
    title: 'In the Field | Cavalier Flooring Systems',
    description:
      'Photos and video from Cavalier Flooring Systems crews on commercial flooring jobs across Virginia.',
  },
  '/day-in-the-life': {
    title: 'A Day in the Life | Cavalier Flooring Systems',
    description:
      'The side of commercial flooring nobody puts in a brochure: site conditions, conflicting drawings and last-minute requests, posted with a smile by Cavalier crews.',
  },
  '/privacy': {
    title: 'Privacy Policy | Cavalier Flooring Systems',
    description: 'How Cavalier Flooring Systems collects, uses and protects information submitted through this website.',
  },
}

// Staff-only pages: kept out of search results.
const STAFF_PREFIXES = ['/admin', '/login', '/my-alerts', '/in-the-field/post']

const NOT_FOUND = {
  title: 'Page not found | Cavalier Flooring Systems',
  description: PAGES['/'].description,
  noindex: true,
}

// Settings for a path that isn't a project page.
export function metaForPath(rawPath) {
  // "/about/" and "/about" are the same page; canonical uses no slash.
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath
  if (PAGES[path]) return { ...PAGES[path], path }
  if (STAFF_PREFIXES.some((p) => path.startsWith(p))) {
    return { title: SITE_NAME, description: PAGES['/'].description, path, noindex: true }
  }
  return { ...NOT_FOUND, path }
}

// Settings for a project page, from the project's own details.
export function metaForProject(project) {
  const where = project.location ? ` in ${project.location}` : ''
  const title = `${project.name}${project.location ? ` | ${project.location}` : ''} | ${SITE_NAME}`
  const fallback = `${project.flooring_type ? `${project.flooring_type} ` : 'Commercial flooring '}furnished and installed by ${SITE_NAME}${where}.`
  return {
    title,
    description: clip(project.short_description || fallback, 160),
    path: `/projects/${project.slug}`,
    image: project.image_urls?.[0] || DEFAULT_IMAGE,
    type: 'article',
  }
}

// Absolute URL for a path or image (link previews need full addresses).
export function absolute(pathOrUrl) {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  return SITE_URL ? `${SITE_URL}${pathOrUrl}` : ''
}

function clip(text, max) {
  const t = String(text).replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

// Business details for Google (structured data on the home page).
// Name, address and phone must match the footer and the Google Business
// Profile exactly (address supplied Nov 19 2026).
export const BUSINESS = {
  '@context': 'https://schema.org',
  '@type': 'HomeAndConstructionBusiness',
  name: SITE_NAME,
  description:
    'Family-owned commercial flooring and surfaces subcontractor based west of Richmond, Virginia. Furnishes and installs carpet, resilient flooring, floor and wall tile, and specialty wall panels, and performs concrete slab moisture mitigation and leveling.',
  foundingDate: '1981',
  founder: { '@type': 'Person', name: 'Randy Basso' },
  telephone: '+1-804-254-7700',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '2020 Tomlynn Street',
    addressLocality: 'Richmond',
    addressRegion: 'VA',
    postalCode: '23230',
    addressCountry: 'US',
  },
  areaServed: [
    { '@type': 'City', name: 'Richmond, VA' },
    { '@type': 'City', name: 'Charlottesville, VA' },
    { '@type': 'City', name: 'Fredericksburg, VA' },
    { '@type': 'City', name: 'Virginia Beach, VA' },
    { '@type': 'City', name: 'Norfolk, VA' },
    { '@type': 'State', name: 'Virginia' },
  ],
  knowsAbout: [
    'Commercial flooring',
    'Carpet tile',
    'Luxury vinyl tile (LVT)',
    'Vinyl composition tile (VCT)',
    'Sheet vinyl',
    'Rubber flooring',
    'Ceramic and porcelain tile',
    'Wall tile',
    'Specialty wall panels',
    'Concrete slab moisture mitigation',
    'Floor leveling',
  ],
  ...(SITE_URL ? { url: SITE_URL, image: `${SITE_URL}${DEFAULT_IMAGE}` } : {}),
}
