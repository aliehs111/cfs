import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FieldComments from '../components/FieldComments'
import { canPost, useCurrentUser } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_URL || ''

function formatPostDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function FieldPage() {
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const { user, signOut } = useCurrentUser()

  const load = async (before) => {
    const url = new URL(`${API_BASE}/api/field/posts`, window.location.origin)
    if (before) url.searchParams.set('before', before)
    const res = await fetch(url)
    if (!res.ok) throw new Error('failed')
    return res.json()
  }

  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => {
        if (cancelled) return
        setPosts(data.posts || [])
        setHasMore(!!data.has_more)
      })
      .catch(() => !cancelled && setError('Could not load posts.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await load(posts[posts.length - 1]?.created_at)
      setPosts((prev) => [...prev, ...(data.posts || [])])
      setHasMore(!!data.has_more)
    } catch {
      setError('Could not load more posts.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-24">
      <div className="flex items-start justify-between">
        <p
          className="uppercase"
          style={{ color: 'var(--maroon-text)', letterSpacing: '0.16em', fontSize: '0.7rem', margin: 0 }}
        >
          From our crews
        </p>
        <div className="flex items-center gap-5">
          {user && (
            <span style={{ fontSize: '0.75rem', color: 'var(--off-white)', opacity: 0.55 }}>
              {user.name} ·{' '}
              <button
                type="button"
                onClick={signOut}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Sign out
              </button>
            </span>
          )}
          {/* Staff entrance: quiet but always visible, since phones can't hover */}
          {(!user || canPost(user)) && (
            <Link
              to={user ? '/in-the-field/post' : '/login?next=/in-the-field/post'}
              aria-label={user ? 'Post to In the Field' : 'Team sign-in'}
              title={user ? 'New post' : 'Team sign-in'}
              className="hard-hat-link"
            >
              <HardHatIcon />
            </Link>
          )}
        </div>
      </div>
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(2.5rem, 7vw, 5rem)',
          letterSpacing: '-0.02em',
          color: 'var(--off-white)',
          lineHeight: 0.95,
          marginTop: '1rem',
        }}
      >
        In the Field
      </h1>
      <p
        style={{
          maxWidth: '38rem',
          marginTop: '1.5rem',
          fontSize: '0.95rem',
          lineHeight: 1.8,
          color: 'var(--off-white)',
          opacity: 0.7,
        }}
      >
        What we're working on right now, posted by the people doing the work.
      </p>

      <div className="hairline mt-14" />

      <div className="mt-14">
        {loading && <p style={{ color: 'var(--off-white)', opacity: 0.55 }}>Loading…</p>}
        {error && <p style={{ color: 'var(--maroon-text)' }}>{error}</p>}
        {!loading && !error && posts.length === 0 && (
          <p style={{ color: 'var(--off-white)', opacity: 0.55 }}>
            Nothing posted yet. Check back soon.
          </p>
        )}
        {posts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
            {posts.map((post) => (
              <FieldPostCard
                key={post.id}
                post={post}
                onOpenImage={setLightbox}
                footer={<FieldComments key={user?.id || 'anon'} post={post} user={user} />}
              />
            ))}
          </div>
        )}
        {hasMore && (
          <div className="mt-16 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs uppercase transition-opacity duration-300 hover:opacity-50"
              style={{
                color: 'var(--off-white)',
                letterSpacing: '0.14em',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid rgba(236,228,215,0.3)',
                cursor: 'pointer',
                padding: '0 0 3px',
              }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  )
}

export function FieldPostCard({ post, onOpenImage, footer }) {
  const media = post.media || []
  const [index, setIndex] = useState(0)
  const trackRef = useRef(null)

  const onScroll = () => {
    const el = trackRef.current
    if (!el) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const goTo = (i) => {
    const el = trackRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <article>
      <div className="relative" style={{ border: '1px solid rgba(236, 228, 215, 0.08)' }}>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex overflow-x-auto"
          style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        >
          {media.map((m) => (
            <div
              key={m.path || m.url}
              className="shrink-0 w-full"
              style={{
                scrollSnapAlign: 'start',
                aspectRatio: '4 / 3',
                backgroundColor: 'rgba(236, 228, 215, 0.04)',
              }}
            >
              {m.type === 'video' ? (
                <video
                  src={m.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full"
                  style={{ objectFit: 'cover', backgroundColor: '#000' }}
                />
              ) : (
                <img
                  src={m.url}
                  alt={post.caption || 'Cavalier crew at work'}
                  loading="lazy"
                  onClick={() => onOpenImage?.(m.url)}
                  className="w-full h-full"
                  style={{ objectFit: 'cover', cursor: onOpenImage ? 'zoom-in' : 'default' }}
                />
              )}
            </div>
          ))}
        </div>
        {media.length > 1 && (
          <div
            className="absolute flex gap-1.5"
            style={{ bottom: '0.75rem', left: '50%', transform: 'translateX(-50%)' }}
          >
            {media.map((m, i) => (
              <button
                key={m.path || m.url}
                type="button"
                aria-label={`Show item ${i + 1} of ${media.length}`}
                onClick={() => goTo(i)}
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  backgroundColor: i === index ? 'var(--off-white)' : 'rgba(236,228,215,0.4)',
                  boxShadow: '0 0 3px rgba(0,0,0,0.5)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      <p
        className="uppercase"
        style={{
          color: 'var(--maroon-text)',
          letterSpacing: '0.16em',
          fontSize: '0.7rem',
          marginTop: '1.25rem',
          marginBottom: 0,
        }}
      >
        {formatPostDate(post.created_at)}
        {post.location ? ` · ${post.location}` : ''}
      </p>
      {post.caption && (
        <p
          style={{
            fontSize: '0.9rem',
            lineHeight: 1.75,
            color: 'var(--off-white)',
            opacity: 0.8,
            marginTop: '0.6rem',
            whiteSpace: 'pre-line',
          }}
        >
          {post.caption}
        </p>
      )}
      {post.author && (
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--off-white)',
            opacity: 0.55,
            marginTop: '0.5rem',
            letterSpacing: '0.04em',
          }}
        >
          — {post.author}
        </p>
      )}
      {footer}
    </article>
  )
}

function HardHatIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* brim */}
      <path d="M2 18h20" />
      {/* shell */}
      <path d="M4 18v-2a8 8 0 0 1 16 0v2" />
      {/* center ridge */}
      <path d="M10 8.3V6.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.8" />
      <path d="M10 8.3V13M14 8.3V13" />
    </svg>
  )
}

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 100, cursor: 'zoom-out' }}
    >
      <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute text-xs uppercase"
        style={{
          top: '1.25rem',
          right: '1.5rem',
          color: 'var(--off-white)',
          letterSpacing: '0.14em',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Close ✕
      </button>
    </div>
  )
}
