import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import ContactModal from '../components/ContactModal'
import { isAdmin, useCurrentUser } from '../lib/auth'
import Seo from '../components/Seo'
import { readPreload } from '../preload'
import { metaForProject, SITE_NAME } from '../seo'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function ProjectDetailPage() {
  const { slug } = useParams()
  // Which slug the loaded result belongs to; anything else means "loading".
  // Starts from data saved into the page at build time, when there is any.
  const [result, setResult] = useState(() => {
    const project = readPreload(`/projects/${slug}`)?.project
    return project ? { slug, project, error: null } : { slug: null, project: null, error: null }
  })
  const [contactOpen, setContactOpen] = useState(false)
  // Index of the photo open in the full-size viewer, or null when closed.
  const [viewing, setViewing] = useState(null)
  const { user } = useCurrentUser()
  const loading = result.slug !== slug
  const project = loading ? null : result.project
  const error = loading ? null : result.error

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/projects/${slug}`)
      .then((r) => {
        if (r.status === 404) return Promise.reject('not_found')
        if (!r.ok) return Promise.reject('failed')
        return r.json()
      })
      .then((data) => {
        if (!cancelled) setResult({ slug, project: data.project, error: null })
      })
      .catch((reason) => {
        if (cancelled) return
        if (reason === 'not_found') {
          setResult({ slug, project: null, error: 'not_found' })
        } else {
          // Network/server hiccup: keep the project saved into the page at
          // build time if we have it, rather than replacing it with an error.
          setResult((prev) => (prev.slug === slug && prev.project ? prev : { slug, project: null, error: 'failed' }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <section className="w-full max-w-7xl mx-auto px-6 py-24">
        <Seo title={`Project | ${SITE_NAME}`} description={`Commercial flooring project by ${SITE_NAME}.`} path={`/projects/${slug}`} />
        <p style={{ color: 'var(--off-white)', opacity: 0.55 }}>Loading project…</p>
      </section>
    )
  }

  if (error === 'not_found') {
    return (
      <section className="w-full max-w-7xl mx-auto px-6 py-24">
        <Seo title={`Project not found | ${SITE_NAME}`} description={`Commercial flooring projects by ${SITE_NAME}.`} noindex />
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
        <Seo title={`Project | ${SITE_NAME}`} description={`Commercial flooring project by ${SITE_NAME}.`} path={`/projects/${slug}`} />
        <p style={{ color: 'var(--maroon-text)' }}>Failed to load project.</p>
      </section>
    )
  }

  const heroImage = project.image_urls?.[0]
  const galleryImages = project.image_urls?.slice(1) || []

  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-24">
      <Seo {...metaForProject(project)} />
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
      {isAdmin(user) && (
        <Link
          to={`/admin?tab=projects&edit=${project.id}`}
          className="uppercase"
          style={{ marginLeft: '2rem', color: 'var(--maroon-text)', letterSpacing: '0.14em', fontSize: '0.7rem', textDecoration: 'none', borderBottom: '1px solid rgba(217,86,107,0.4)', paddingBottom: '0.15rem' }}
        >
          Edit this project
        </Link>
      )}

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
          style={{ aspectRatio: '16 / 9', border: '1px solid rgba(236, 228, 215, 0.08)' }}
        >
          <PhotoButton url={heroImage} alt={photoAlt(project, 0)} onOpen={() => setViewing(0)} eager />
        </div>
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
        <div>
          <MetaList project={project} />
        </div>
      </div>

      {galleryImages.length > 0 && (
        <div className="mt-20">
          <p
            className="uppercase"
            style={{
              color: 'var(--maroon-text)',
              letterSpacing: '0.16em',
              fontSize: '0.7rem',
              opacity: 1,
              marginBottom: '1.5rem',
            }}
          >
            Gallery
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {galleryImages.map((url, i) => (
              <div
                key={i}
                style={{ aspectRatio: '4 / 3', border: '1px solid rgba(236, 228, 215, 0.08)' }}
              >
                <PhotoButton url={url} alt={photoAlt(project, i + 1)} onOpen={() => setViewing(i + 1)} />
              </div>
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
      {viewing !== null && (
        <PhotoViewer
          project={project}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  )
}

function photoAlt(project, i) {
  const count = project.image_urls?.length || 0
  return count > 1 ? `${project.name}, photo ${i + 1} of ${count}` : project.name
}

// A project photo; clicking it opens the full-size viewer.
function PhotoButton({ url, alt, onOpen, eager = false }) {
  return (
    <button type="button" className="photo-open" onClick={onOpen} aria-label={`View larger: ${alt}`}>
      <img src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </button>
  )
}

// Full-size photo viewer: Escape or a click outside the photo closes it;
// arrows (buttons or keys) step through the project's photos. Focus moves
// into the viewer and back to the photo that opened it.
function PhotoViewer({ project, index, onIndex, onClose }) {
  const images = project.image_urls || []
  const count = images.length
  const box = useRef(null)
  const closeRef = useRef(onClose)
  const indexRef = useRef({ index, count, onIndex })
  useEffect(() => {
    closeRef.current = onClose
    indexRef.current = { index, count, onIndex }
  })

  useEffect(() => {
    const opener = document.activeElement
    box.current?.querySelector('.lightbox-close')?.focus()
    const onKey = (e) => {
      const { index: i, count: n, onIndex: setI } = indexRef.current
      if (e.key === 'Escape') closeRef.current()
      else if (e.key === 'ArrowRight' && n > 1) setI((i + 1) % n)
      else if (e.key === 'ArrowLeft' && n > 1) setI((i - 1 + n) % n)
      else if (e.key === 'Tab' && box.current) {
        // Keep Tab inside the viewer.
        const items = box.current.querySelectorAll('button')
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  const go = (delta) => onIndex((index + delta + count) % count)

  return (
    <div
      ref={box}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${project.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <img src={images[index]} alt={photoAlt(project, index)} />
      {count > 1 && (
        <p className="lightbox-count" aria-live="polite">
          {index + 1} / {count}
        </p>
      )}
      <button type="button" className="lightbox-btn lightbox-close" onClick={onClose} aria-label="Close photo viewer">
        ×
      </button>
      {count > 1 && (
        <>
          <button type="button" className="lightbox-btn lightbox-prev" onClick={() => go(-1)} aria-label="Previous photo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" className="lightbox-btn lightbox-next" onClick={() => go(1)} aria-label="Next photo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}
    </div>
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
              opacity: 0.55,
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
