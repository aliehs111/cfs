import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import FieldComments from '../components/FieldComments'
import FieldPostEditor from '../components/FieldPostEditor'
import { canPost, isAdmin, useCurrentUser } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_URL || ''

function formatPostDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const VIEW_KEY = 'cavalier_field_view'

export default function FieldPage() {
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const { user, signOut } = useCurrentUser()
  // Grid or Instagram-style feed; remembered on this device only.
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'feed' ? 'feed' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const chooseView = (v) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private mode: fine, it just won't be remembered */
    }
  }

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
    // Stone background with white text; see .field-stone in index.css.
    <div className="field-stone" style={{ minHeight: 'calc(100vh - 74px)' }}>
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

      <div className="flex justify-end mt-10">
        <ViewToggle view={view} onChange={chooseView} />
      </div>
      <div className="hairline mt-4" />

      <div className="mt-14">
        {loading && <p style={{ color: 'var(--off-white)', opacity: 0.55 }}>Loading…</p>}
        {error && <p style={{ color: 'var(--maroon-text)' }}>{error}</p>}
        {!loading && !error && posts.length === 0 && (
          <p style={{ color: 'var(--off-white)', opacity: 0.55 }}>
            Nothing posted yet. Check back soon.
          </p>
        )}
        {posts.length > 0 && (
          <div
            className={
              view === 'feed'
                ? 'max-w-xl mx-auto flex flex-col gap-y-10'
                : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14'
            }
          >
            {posts.map((post) => {
              const Card = view === 'feed' ? FeedPostCard : FieldPostCard
              return (
              <Card
                key={post.id}
                post={post}
                onOpenImage={setLightbox}
                footer={
                  <>
                    {user && (isAdmin(user) || post.user_id === user.id) && (
                      <FieldPostEditor
                        post={post}
                        onSaved={(updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))}
                        onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                      />
                    )}
                    <FieldComments key={user?.id || 'anon'} post={post} user={user} />
                  </>
                }
              />
              )
            })}
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
    </div>
  )
}

// Swipeable photos/videos for one post, with dots when there's more than one.
function MediaCarousel({ post, onOpenImage, aspect }) {
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
              aspectRatio: aspect,
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
              aria-current={i === index ? 'true' : undefined}
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
      {media.length > 1 && (
        <span
          className="absolute text-xs"
          aria-hidden="true"
          style={{ top: '0.6rem', right: '0.6rem', padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', color: '#fff' }}
        >
          {index + 1}/{media.length}
        </span>
      )}
    </div>
  )
}

// Grid view: compact card.
export function FieldPostCard({ post, onOpenImage, footer }) {
  return (
    <article>
      <MediaCarousel post={post} onOpenImage={onOpenImage} aspect="4 / 3" />
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

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'C'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

// Feed view: one post at a time, larger square media, poster up top.
function FeedPostCard({ post, onOpenImage, footer }) {
  const name = post.author || 'Cavalier crew'
  return (
    <article style={{ paddingBottom: '2.5rem', borderBottom: '1px solid rgba(236,228,215,0.08)' }}>
      <header className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
        <span
          aria-hidden="true"
          className="flex items-center justify-center shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'var(--maroon)',
            color: 'var(--white)',
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.04em',
          }}
        >
          {initials(post.author)}
        </span>
        <span className="min-w-0">
          <span className="block" style={{ color: 'var(--off-white)', fontSize: '0.9rem', fontWeight: 500 }}>
            {name}
          </span>
          {post.location && (
            <span className="block" style={{ color: 'var(--off-white)', opacity: 0.6, fontSize: '0.75rem' }}>
              {post.location}
            </span>
          )}
        </span>
      </header>
      <MediaCarousel post={post} onOpenImage={onOpenImage} aspect="1 / 1" />
      {post.caption && (
        <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: 'var(--off-white)', marginTop: '0.9rem', whiteSpace: 'pre-line' }}>
          <span style={{ fontWeight: 500 }}>{name}</span>{' '}
          <span style={{ opacity: 0.85 }}>{post.caption}</span>
        </p>
      )}
      <p
        className="uppercase"
        style={{ color: 'var(--off-white)', opacity: 0.55, letterSpacing: '0.12em', fontSize: '0.65rem', marginTop: '0.6rem' }}
      >
        {formatPostDate(post.created_at)}
      </p>
      {footer}
    </article>
  )
}

function ViewToggle({ view, onChange }) {
  const button = (value, label, icon) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={view === value}
      aria-label={label}
      title={label}
      className="flex items-center justify-center"
      style={{
        width: 40,
        height: 36,
        background: view === value ? 'rgba(236,228,215,0.1)' : 'transparent',
        border: 'none',
        color: 'var(--off-white)',
        opacity: view === value ? 1 : 0.6,
        cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  )
  return (
    <div role="group" aria-label="Layout" className="flex" style={{ border: '1px solid rgba(236,228,215,0.2)' }}>
      {button(
        'grid',
        'Grid view',
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="1" y="1" width="6" height="6" /><rect x="9" y="1" width="6" height="6" />
          <rect x="1" y="9" width="6" height="6" /><rect x="9" y="9" width="6" height="6" />
        </svg>
      )}
      {button(
        'feed',
        'Feed view',
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2.5" y="1.5" width="11" height="9" /><path d="M2.5 13h11M2.5 15h7" />
        </svg>
      )}
    </div>
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
