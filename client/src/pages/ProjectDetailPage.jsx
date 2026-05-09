import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import ContactModal from '../components/ContactModal'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function ProjectDetailPage() {
  const { slug } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setProject(null)
    fetch(`${API_BASE}/api/projects/${slug}`)
      .then((r) => {
        if (r.status === 404) return Promise.reject('not_found')
        if (!r.ok) return Promise.reject('failed')
        return r.json()
      })
      .then((data) => {
        if (!cancelled) {
          setProject(data.project)
          setLoading(false)
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason === 'not_found' ? 'not_found' : 'failed')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <section className="w-full max-w-7xl mx-auto px-6 py-24">
        <p style={{ color: 'var(--off-white)', opacity: 0.5 }}>Loading project…</p>
      </section>
    )
  }

  if (error === 'not_found') {
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
          Project not found
        </h1>
        <p
          style={{
            color: 'var(--off-white)',
            opacity: 0.6,
            marginTop: '1.5rem',
            fontSize: '1rem',
          }}
        >
          We couldn't find a project at that address.
        </p>
        <Link
          to="/projects"
          className="nav-link"
          style={{
            display: 'inline-block',
            marginTop: '2rem',
            fontSize: '0.85rem',
            letterSpacing: '0.04em',
            borderBottom: '1px solid rgba(236, 228, 215, 0.25)',
            paddingBottom: '0.15rem',
          }}
        >
          ← Back to projects
        </Link>
      </section>
    )
  }

  if (error) {
    return (
      <section className="w-full max-w-7xl mx-auto px-6 py-24">
        <p style={{ color: 'var(--maroon)' }}>Failed to load project.</p>
      </section>
    )
  }

  const heroImage = project.image_urls?.[0]
  const galleryImages = project.image_urls?.slice(1) || []

  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-24">
      <Link
        to="/projects"
        className="nav-link"
        style={{
          display: 'inline-block',
          fontSize: '0.85rem',
          letterSpacing: '0.04em',
          marginBottom: '3rem',
          borderBottom: '1px solid rgba(236, 228, 215, 0.15)',
          paddingBottom: '0.15rem',
        }}
      >
        ← Back to projects
      </Link>

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
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(2.5rem, 7vw, 5rem)',
          letterSpacing: '-0.02em',
          color: 'var(--off-white)',
          lineHeight: 0.95,
          marginTop: '0.6rem',
        }}
      >
        {project.name}
      </h1>
      {project.location && (
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--off-white)',
            opacity: 0.55,
            marginTop: '0.85rem',
            letterSpacing: '0.04em',
          }}
        >
          {project.location}
        </p>
      )}

      {heroImage && (
        <div
          className="mt-12"
          style={{
            aspectRatio: '16 / 9',
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px solid rgba(236, 228, 215, 0.08)',
          }}
        />
      )}

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2">
          {project.long_description && (
            <p
              style={{
                fontSize: '1.05rem',
                lineHeight: 1.85,
                color: 'var(--off-white)',
                opacity: 0.85,
                whiteSpace: 'pre-line',
                margin: 0,
              }}
            >
              {project.long_description}
            </p>
          )}
        </div>
        <aside>
          <MetaList project={project} />
        </aside>
      </div>

      {galleryImages.length > 0 && (
        <div className="mt-20">
          <p
            className="uppercase"
            style={{
              color: 'var(--maroon)',
              letterSpacing: '0.16em',
              fontSize: '0.7rem',
              opacity: 0.85,
              marginBottom: '1.5rem',
            }}
          >
            Gallery
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {galleryImages.map((url, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '4 / 3',
                  backgroundImage: `url(${url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: '1px solid rgba(236, 228, 215, 0.08)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="hairline mt-24" />
      <div className="mt-12">
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="nav-link font-display"
          style={{
            fontSize: '1.4rem',
            display: 'inline-block',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(236, 228, 215, 0.25)',
            borderRadius: 0,
            padding: 0,
            paddingBottom: '0.15rem',
            letterSpacing: '-0.01em',
            cursor: 'pointer',
          }}
        >
          Discuss a similar project →
        </button>
      </div>
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </section>
  )
}

function MetaList({ project }) {
  const rows = [
    { label: 'Location', value: project.location },
    { label: 'Year', value: project.year },
    {
      label: 'Square footage',
      value: project.square_footage
        ? `${project.square_footage.toLocaleString()} sq ft`
        : null,
    },
    { label: 'Flooring', value: project.flooring_type },
  ].filter((r) => r.value != null && r.value !== '')

  if (rows.length === 0) return null

  return (
    <dl style={{ margin: 0 }}>
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            paddingTop: '1rem',
            paddingBottom: '1rem',
            borderTop: i === 0 ? '1px solid rgba(236, 228, 215, 0.08)' : 'none',
            borderBottom: '1px solid rgba(236, 228, 215, 0.08)',
          }}
        >
          <dt
            className="uppercase"
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.16em',
              color: 'var(--off-white)',
              opacity: 0.45,
              marginBottom: '0.35rem',
            }}
          >
            {row.label}
          </dt>
          <dd
            style={{
              margin: 0,
              fontSize: '0.95rem',
              color: 'var(--off-white)',
              opacity: 0.9,
            }}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
