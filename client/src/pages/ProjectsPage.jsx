import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

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
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
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
          setError('Failed to load projects.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
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
          <p style={{ color: 'var(--off-white)', opacity: 0.5 }}>Loading projects…</p>
        )}
        {error && (
          <p style={{ color: 'var(--maroon)' }}>{error}</p>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p style={{ color: 'var(--off-white)', opacity: 0.5 }}>
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

function ProjectCard({ project }) {
  const thumb = project.image_urls?.[0]
  return (
    <Link to={`/projects/${project.slug}`} className="project-card">
      <div
        className="project-thumb"
        style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
      />
      <p
        className="uppercase"
        style={{
          color: 'var(--maroon)',
          letterSpacing: '0.16em',
          fontSize: '0.7rem',
          opacity: 0.85,
          margin: 0,
        }}
      >
        {project.project_type}
      </p>
      <h3
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
      </h3>
      {project.location && (
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--off-white)',
            opacity: 0.45,
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
  )
}
