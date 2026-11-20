import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { readPreload } from '../preload'

const API_BASE = import.meta.env.VITE_API_URL || ''

const PROJECT_TYPES = [
  'All',
  'Healthcare',
  'Retail',
  'Multi-family',
  'Office / Corporate',
  'Higher Education',
]

export default function ProjectsPage() {
  // Saved into the page at build time (so the list is in the HTML for search
  // engines); still refreshed from the API below.
  const preloaded = readPreload('/projects')?.projects
  const [projects, setProjects] = useState(preloaded || [])
  const [loading, setLoading] = useState(!preloaded)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/projects`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (!cancelled) {
          setProjects(data.projects || [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Keep the list saved into the page at build time, if there is one.
          if (!preloaded) setError('Failed to load projects.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on load; `preloaded` is fixed for the page
  }, [])

  const filtered = projects.filter((p) => {
    if (filter !== 'All' && p.project_type !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      const inName = (p.name || '').toLowerCase().includes(q)
      const inDesc = (p.short_description || '').toLowerCase().includes(q)
      const inLocation = (p.location || '').toLowerCase().includes(q)
      return inName || inDesc || inLocation
    }
    return true
  })

  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-24">
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(2.5rem, 7vw, 5rem)',
          letterSpacing: '-0.02em',
          color: 'var(--off-white)',
          lineHeight: 0.95,
        }}
      >
        Projects
      </h1>

      <div className="mt-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex flex-wrap gap-3">
          {PROJECT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              aria-pressed={filter === type}
              className={`filter-chip ${filter === type ? 'filter-chip-active' : ''}`}
            >
              {type}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="search-input"
        />
      </div>

      <div className="mt-16">
        {loading && (
          <p style={{ color: 'var(--off-white)', opacity: 0.55 }}>Loading projects…</p>
        )}
        {error && (
          <p style={{ color: 'var(--maroon-text)' }}>{error}</p>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p style={{ color: 'var(--off-white)', opacity: 0.55 }}>
            No projects match those filters.
          </p>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// Cover photo, or a small slideshow when the project has several photos.
// Clicking the photo opens the project; the arrows (and swiping on a phone)
// step through the photos instead.
function ProjectThumb({ project }) {
  const images = project.image_urls || []
  const [index, setIndex] = useState(0)
  const touchX = useRef(null)
  const swiped = useRef(false)
  const count = images.length
  const go = (delta) => setIndex((i) => (i + delta + count) % count)
  const url = images[index]

  return (
    <div
      className="project-thumb-wrap"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
        swiped.current = false
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null || count < 2) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 40) {
          swiped.current = true
          go(dx < 0 ? 1 : -1)
        }
      }}
    >
      {/* The text link below is the one keyboards and screen readers use. */}
      <Link
        to={`/projects/${project.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        onClick={(e) => {
          if (swiped.current) {
            e.preventDefault() // a swipe changed the photo; don't open the project
            swiped.current = false
          }
        }}
      >
        <div className="project-thumb" style={url ? { backgroundImage: `url(${url})` } : undefined} />
      </Link>
      {count > 1 && (
        <>
          <button
            type="button"
            className="project-arrow project-arrow-prev"
            aria-label={`Previous photo of ${project.name}`}
            onClick={() => go(-1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button
            type="button"
            className="project-arrow project-arrow-next"
            aria-label={`Next photo of ${project.name}`}
            onClick={() => go(1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="project-dots" aria-hidden="true">
            {images.map((u, n) => (
              <span key={n} className={n === index ? 'active' : undefined} />
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            Photo {index + 1} of {count}
          </span>
        </>
      )}
    </div>
  )
}

function ProjectCard({ project }) {
  return (
    <div className="project-card">
      <ProjectThumb project={project} />
      <Link to={`/projects/${project.slug}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <p
        className="uppercase"
        style={{
          color: 'var(--maroon-text)',
          letterSpacing: '0.16em',
          fontSize: '0.7rem',
          opacity: 1,
          margin: 0,
        }}
      >
        {project.project_type}
      </p>
      <h2
        className="font-display project-card-name"
        style={{
          fontSize: '1.5rem',
          marginTop: '0.4rem',
          color: 'var(--off-white)',
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
        }}
      >
        {project.name}
      </h2>
      {project.location && (
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--off-white)',
            opacity: 0.55,
            marginTop: '0.4rem',
            letterSpacing: '0.04em',
          }}
        >
          {project.location}
        </p>
      )}
      {project.short_description && (
        <p
          style={{
            fontSize: '0.85rem',
            lineHeight: 1.7,
            color: 'var(--off-white)',
            opacity: 0.65,
            marginTop: '0.75rem',
          }}
        >
          {project.short_description}
        </p>
      )}
      </Link>
    </div>
  )
}
