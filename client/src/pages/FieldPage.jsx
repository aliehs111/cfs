import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import FieldComments from '../components/FieldComments'
import FieldPostEditor from '../components/FieldPostEditor'
import { apiFetch, canPost, isAdmin, readError, useCurrentUser } from '../lib/auth'
import { FIELD_SECTIONS, SECTION_PATHS } from '../fieldSections'

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

export default function FieldPage({ section = 'field' }) {
  const copy = FIELD_SECTIONS[section] || FIELD_SECTIONS.field
  const postPath = `/in-the-field/post?section=${section}`
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  // The open photo/video viewer: { media, index, caption }, or null.
  const [lightbox, setLightbox] = useState(null)
  const openMedia = (post, index) => setLightbox({ postId: post.id, index })
  const closeLightbox = useCallback(() => setLightbox(null), [])
  const { user, signOut } = useCurrentUser()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // The sign-in expired (30 days) while editing: sign out and come back here
  // after signing in again.
  const onUnauthorized = () => {
    signOut()
    navigate(`/login?next=${encodeURIComponent(pathname)}`)
  }
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

  // Featured video posts (admins choose them). They show in the large spot at
  // the top and are left out of the grid, except in search results.
  const [featured, setFeatured] = useState([])
  // What's typed in the search box, and the same text once typing pauses.
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  // Bumped on every new list request, so a slow, older response is ignored.
  const requestId = useRef(0)

  const load = async (before, q) => {
    const url = new URL(`${API_BASE}/api/field/posts`, window.location.origin)
    url.searchParams.set('section', section)
    if (before) url.searchParams.set('before', before)
    if (q) url.searchParams.set('q', q)
    const res = await fetch(url)
    if (!res.ok) throw new Error('failed')
    return res.json()
  }

  useEffect(() => {
    let cancelled = false
    const url = new URL(`${API_BASE}/api/field/featured`, window.location.origin)
    url.searchParams.set('section', section)
    fetch(url)
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data) => !cancelled && setFeatured(data.posts || []))
      .catch(() => {}) // the featured spot is optional; the grid still loads
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the route remounts this page per section (key in App.jsx)
  }, [])

  // Search once typing pauses for 300 ms.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim()
      if (q === query) return
      setLoading(true)
      setError(null)
      setQuery(q)
    }, 300)
    return () => clearTimeout(t)
  }, [search, query])

  // Load the first page on arrival and again whenever the search changes.
  useEffect(() => {
    const id = ++requestId.current
    load(undefined, query)
      .then((data) => {
        if (id !== requestId.current) return
        setPosts(data.posts || [])
        setHasMore(!!data.has_more)
      })
      .catch(() => id === requestId.current && setError('Could not load posts.'))
      .finally(() => id === requestId.current && setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load only reads `section`, fixed for this page
  }, [query])

  const loadMore = async () => {
    // Never mix pages from two searches: a new search is loading its first page.
    if (loading) return
    const id = requestId.current
    setLoadingMore(true)
    try {
      const data = await load(posts[posts.length - 1]?.created_at, query)
      if (id !== requestId.current) return
      setPosts((prev) => [...prev, ...(data.posts || [])])
      setHasMore(!!data.has_more)
    } catch {
      if (id === requestId.current) setError('Could not load more posts.')
    } finally {
      setLoadingMore(false)
    }
  }

  const mergePost = (updated) => (list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))

  // Admins only (the server checks too). Moves the post between the featured
  // spot and the grid without reloading the page.
  const toggleFeature = async (post, on) => {
    const res = await apiFetch(`/api/field/posts/${post.id}/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: on }),
    })
    if (res.status === 401) {
      onUnauthorized()
      throw new Error('Your sign-in expired. Sign in again.')
    }
    if (!res.ok) throw new Error(await readError(res, 'Could not change that post.'))
    const updated = (await res.json()).post
    if (on) {
      setFeatured((prev) => [updated, ...prev.filter((p) => p.id !== updated.id)])
      setPosts((prev) => (query ? mergePost(updated)(prev) : prev.filter((p) => p.id !== updated.id)))
      return
    }
    setFeatured((prev) => prev.filter((p) => p.id !== updated.id))
    setPosts((prev) => {
      if (query || prev.some((p) => p.id === updated.id)) return mergePost(updated)(prev)
      // Older than everything loaded so far: it'll come in with "Load more".
      // (Adding it now would make Load more skip the posts in between.)
      const last = prev[prev.length - 1]
      if (hasMore && last && updated.created_at < last.created_at) return prev
      return [...prev, updated].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    })
  }

  const renderFooter = (post) => (
    <>
      {user && (isAdmin(user) || post.user_id === user.id) && (
        <FieldPostEditor
          post={post}
          onSaved={(updated) => {
            setPosts(mergePost(updated))
            setFeatured(mergePost(updated))
          }}
          onDeleted={(id) => {
            setPosts((prev) => prev.filter((p) => p.id !== id))
            setFeatured((prev) => prev.filter((p) => p.id !== id))
          }}
          onUnauthorized={onUnauthorized}
          featured={!!post.featured_at}
          // Feature: video posts only. Unfeature stays available on a featured
          // post even after its video is edited out, so it can't get stuck.
          onToggleFeature={
            isAdmin(user) && (hasVideo(post) || post.featured_at) ? (on) => toggleFeature(post, on) : undefined
          }
        />
      )}
      <FieldComments key={user?.id || 'anon'} post={post} user={user} />
    </>
  )

  return (
    // Stone background with white text; see .field-stone in index.css.
    <div className="field-stone" style={{ minHeight: 'calc(100vh - 74px)' }}>
    <section className="w-full max-w-7xl mx-auto px-6 pt-12 md:pt-16 pb-24">
      {/* Heading and the staff controls share one row, so there's no empty
          band above the title (Nov 19 2026). */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {copy.eyebrow && (
            <p
              className="uppercase"
              style={{ color: 'var(--maroon-text)', letterSpacing: '0.16em', fontSize: '0.7rem', margin: '0 0 1rem' }}
            >
              {copy.eyebrow}
            </p>
          )}
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(2.5rem, 7vw, 5rem)',
              letterSpacing: '-0.02em',
              color: 'var(--off-white)',
              lineHeight: 0.95,
              margin: 0,
            }}
          >
            {/* One page, two tabs: the heading stays "In the Field". */}
            {FIELD_SECTIONS.field.title}
          </h1>
        </div>
        <div className="flex items-center gap-5 shrink-0" style={{ paddingTop: '0.6rem' }}>
          {user && (
            <span style={{ fontSize: '0.75rem', color: 'var(--off-white)', opacity: 0.55 }}>
              {user.name} ·{' '}
              <button
                type="button"
                onClick={signOut}
                className="field-tap"
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Sign out
              </button>
            </span>
          )}
          {/* Staff entrance: quiet but always visible, since phones can't hover */}
          {(!user || canPost(user)) && (
            <Link
              to={user ? postPath : `/login?next=${encodeURIComponent(postPath)}`}
              aria-label={user ? `Post to ${copy.title}` : 'Team sign-in'}
              title={user ? 'New post' : 'Team sign-in'}
              className="hard-hat-link"
            >
              <HardHatIcon />
            </Link>
          )}
        </div>
      </div>
      {copy.intro && (
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
          {copy.intro}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5 mt-8">
        <SectionTabs />
        <div className="flex items-center gap-5 w-full sm:w-auto">
          <SearchBox value={search} onChange={setSearch} />
          <ViewToggle view={view} onChange={chooseView} />
        </div>
      </div>
      <div className="hairline mt-4" />

      {/* Hidden while searching, so the results come first. */}
      {!query && featured.length > 0 && (
        <FeaturedSection
          posts={featured}
          onOpenMedia={openMedia}
          renderFooter={renderFooter}
          compact={view === 'feed'}
        />
      )}

      <div className="mt-14">
        {loading && <p style={{ color: 'var(--off-white)', opacity: 0.55 }}>Loading…</p>}
        {error && <p style={{ color: 'var(--maroon-text)' }}>{error}</p>}
        {!loading && !error && posts.length === 0 && (
          <p style={{ color: 'var(--off-white)', opacity: 0.55 }}>
            {query ? `No posts match “${query}”.` : copy.empty}
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
                onOpenMedia={openMedia}
                footer={renderFooter(post)}
              />
              )
            })}
          </div>
        )}
        {hasMore && !loading && (
          <div className="mt-16 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="field-tap text-xs uppercase transition-opacity duration-300 hover:opacity-50"
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

      {lightbox && (
        <MediaLightbox
          // Posts in the order they appear on the page (featured first), so
          // "Previous post" / "Next post" in the viewer follow the page.
          posts={[...(query ? [] : featured), ...posts].filter(
            (p, i, all) => p.media?.length && all.findIndex((x) => x.id === p.id) === i,
          )}
          startPostId={lightbox.postId}
          start={lightbox.index}
          onClose={closeLightbox}
        />
      )}
    </section>
    </div>
  )
}

// The page's two tabs. Each is its own address (/in-the-field and
// /day-in-the-life) so either can be linked to and found in search.
function SectionTabs() {
  return (
    <nav aria-label="In the Field sections" className="flex gap-6">
      {Object.entries(SECTION_PATHS).map(([key, to]) => (
        <NavLink
          key={key}
          to={to}
          className={({ isActive }) => `nav-link text-xs uppercase no-underline whitespace-nowrap ${isActive ? 'nav-link-active' : ''}`}
          style={{ letterSpacing: '0.16em', paddingBottom: '4px' }}
        >
          {FIELD_SECTIONS[key].title}
        </NavLink>
      ))}
    </nav>
  )
}

// Swipeable photos/videos for one post, with dots and arrows when there's
// more than one. fit="contain" shows the whole frame (letterboxed), so tall
// phone videos aren't cropped in the wide featured spot.
// With onOpenMedia, each photo/video is a button that opens the large viewer
// (videos play there). Without it (the staff posting page), videos play inline.
function MediaCarousel({ post, onOpenMedia, aspect, fit = 'cover' }) {
  const media = post.media || []
  const count = media.length
  const [index, setIndex] = useState(0)
  const trackRef = useRef(null)

  const onScroll = () => {
    const el = trackRef.current
    if (!el) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const goTo = (i) => {
    const el = trackRef.current
    if (el) el.scrollTo({ left: ((i + count) % count) * el.clientWidth, behavior: 'smooth' })
  }

  // #t=0.001 makes iOS Safari render the first frame as a thumbnail
  // (otherwise it shows black until play with preload="metadata").
  const thumbSrc = (url) => (url.includes('#') ? url : `${url}#t=0.001`)
  const position = (i) => (count > 1 ? ` ${i + 1} of ${count}` : '')

  return (
    <div className="field-carousel relative" style={{ border: '1px solid rgba(236, 228, 215, 0.08)' }}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex overflow-x-auto"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {media.map((m, i) => (
          <div
            key={m.path || m.url}
            className="shrink-0 w-full"
            style={{
              scrollSnapAlign: 'start',
              aspectRatio: aspect,
              backgroundColor: 'rgba(236, 228, 215, 0.04)',
            }}
          >
            {onOpenMedia ? (
              <button
                type="button"
                className="field-media-open"
                onClick={() => onOpenMedia(post, i)}
                aria-label={m.type === 'video' ? `Play video${position(i)} in a larger player` : `Open photo${position(i)} larger`}
              >
                {m.type === 'video' ? (
                  <>
                    <video
                      src={thumbSrc(m.url)}
                      muted
                      playsInline
                      preload="metadata"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="w-full h-full"
                      style={{ objectFit: fit, backgroundColor: '#000', pointerEvents: 'none' }}
                    />
                    <span className="field-play" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  </>
                ) : (
                  <img
                    src={m.url}
                    alt={post.caption || 'Cavalier crew at work'}
                    loading="lazy"
                    className="w-full h-full"
                    style={{ objectFit: fit }}
                  />
                )}
              </button>
            ) : m.type === 'video' ? (
              <video
                src={thumbSrc(m.url)}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full"
                style={{ objectFit: fit, backgroundColor: '#000' }}
              />
            ) : (
              <img
                src={m.url}
                alt={post.caption || 'Cavalier crew at work'}
                loading="lazy"
                className="w-full h-full"
                style={{ objectFit: fit }}
              />
            )}
          </div>
        ))}
      </div>
      {count > 1 && (
        <>
          {/* Same arrows as the project cards: on hover/keyboard focus, and
              always on touch screens. */}
          <button
            type="button"
            className="project-arrow project-arrow-prev"
            aria-label="Previous photo or video"
            onClick={() => goTo(index - 1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button
            type="button"
            className="project-arrow project-arrow-next"
            aria-label="Next photo or video"
            onClick={() => goTo(index + 1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="absolute flex" style={{ bottom: 0, left: '50%', transform: 'translateX(-50%)' }}>
            {media.map((m, i) => (
              <button
                key={m.path || m.url}
                type="button"
                aria-label={`Show item ${i + 1} of ${count}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => goTo(i)}
                className="flex items-center justify-center"
                // A bigger tap area around the small dot.
                style={{ width: 22, height: 36, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.45)',
                    boxShadow: '0 0 3px rgba(0,0,0,0.5)',
                  }}
                />
              </button>
            ))}
          </div>
          <span
            className="absolute text-xs"
            aria-hidden="true"
            style={{ top: '0.6rem', right: '0.6rem', padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', color: '#fff' }}
          >
            {index + 1}/{count}
          </span>
        </>
      )}
    </div>
  )
}

// Grid cards show the same number of caption lines. Longer captions get a
// More / Less toggle, which only appears when the text is actually cut off.
const CAPTION_LINES = 5

// prefix: shown in bold before the text (the poster's name in feed view).
function ClampedCaption({ text, prefix, lines = CAPTION_LINES, fontSize = '0.9rem', style }) {
  const ref = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    // Re-check when the card width changes (window resize, grid columns).
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, expanded, lines])

  return (
    <>
      <p
        ref={ref}
        style={{
          fontSize,
          lineHeight: 1.75,
          color: 'var(--off-white)',
          opacity: 0.8,
          marginTop: '0.6rem',
          marginBottom: 0,
          whiteSpace: 'pre-line',
          ...style,
          ...(expanded
            ? {}
            : {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: lines,
                overflow: 'hidden',
              }),
        }}
      >
        {prefix && <span style={{ fontWeight: 500 }}>{prefix} </span>}
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="field-tap text-xs uppercase transition-opacity duration-300 hover:opacity-50"
          style={{
            color: 'var(--off-white)',
            letterSpacing: '0.14em',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid rgba(236,228,215,0.3)',
            cursor: 'pointer',
            padding: '0 0 3px',
            marginTop: '0.6rem',
          }}
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </>
  )
}

const dateLabelStyle = {
  color: 'var(--maroon-text)',
  letterSpacing: '0.16em',
  fontSize: '0.7rem',
  marginTop: '1.25rem',
  marginBottom: 0,
}

const hasVideo = (post) => (post.media || []).some((m) => m.type === 'video')

// Featured spot (layout A, Nov 2026): a wide video with the caption beside it
// on large screens, stacked on phones and in feed view. Dots switch between
// featured posts when there's more than one.
function FeaturedSection({ posts, onOpenMedia, renderFooter, compact }) {
  const [index, setIndex] = useState(0)
  const i = Math.min(index, posts.length - 1)
  const post = posts[i]
  return (
    <section aria-label="Featured" className={compact ? 'mt-14 max-w-xl mx-auto' : 'mt-14'}>
      <p className="uppercase" style={{ ...dateLabelStyle, marginTop: 0 }}>Featured</p>
      <div className={compact ? 'mt-4' : 'mt-4 grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-5 items-start'}>
        <div className={compact ? '' : 'lg:col-span-2'}>
          <MediaCarousel key={post.id} post={post} onOpenMedia={onOpenMedia} aspect="16 / 9" fit="contain" />
        </div>
        <div className={compact ? 'mt-5' : ''}>
          <p className="uppercase" style={{ ...dateLabelStyle, marginTop: 0 }}>
            {formatPostDate(post.created_at)}
            {post.location ? ` · ${post.location}` : ''}
          </p>
          {post.caption && <ClampedCaption key={post.id} text={post.caption} lines={8} fontSize="1rem" />}
          {post.author && (
            <p style={{ fontSize: '0.8rem', color: 'var(--off-white)', opacity: 0.55, marginTop: '0.5rem', letterSpacing: '0.04em' }}>
              — {post.author}
            </p>
          )}
          {posts.length > 1 && (
            <div className="flex" style={{ marginTop: '0.5rem', marginLeft: '-10px' }}>
              {posts.map((p, n) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`Show featured video ${n + 1} of ${posts.length}`}
                  aria-current={n === i ? 'true' : undefined}
                  onClick={() => setIndex(n)}
                  className="flex items-center justify-center"
                  style={{ width: 28, height: 44, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: n === i ? 'var(--off-white)' : 'rgba(255,255,255,0.4)',
                    }}
                  />
                </button>
              ))}
            </div>
          )}
          {renderFooter(post)}
        </div>
      </div>
      <div className="hairline mt-14" />
    </section>
  )
}

function SearchBox({ value, onChange }) {
  return (
    <div
      className="flex items-center gap-2 flex-1 sm:flex-none sm:w-56"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.75)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ color: 'var(--off-white)', flexShrink: 0 }}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
      <label htmlFor="field-search" className="sr-only">Search posts</label>
      <input
        id="field-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search"
        maxLength={100}
        autoComplete="off"
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '6px 0',
          fontFamily: 'inherit',
          fontSize: '16px', // 16px+ stops iOS from zooming into the field
          fontWeight: 300,
          color: 'var(--off-white)',
          colorScheme: 'dark', // light-colored clear (×) button
        }}
      />
    </div>
  )
}

// Grid view: compact card.
export function FieldPostCard({ post, onOpenMedia, footer }) {
  return (
    <article>
      <MediaCarousel post={post} onOpenMedia={onOpenMedia} aspect="4 / 3" />
      <p className="uppercase" style={dateLabelStyle}>
        {formatPostDate(post.created_at)}
        {post.location ? ` · ${post.location}` : ''}
      </p>
      {post.caption && <ClampedCaption text={post.caption} />}
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
function FeedPostCard({ post, onOpenMedia, footer }) {
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
      <MediaCarousel post={post} onOpenMedia={onOpenMedia} aspect="1 / 1" />
      {/* Clamped like the grid, so a long caption doesn't push the next post
          far down the page; More shows the rest. */}
      {post.caption && (
        <ClampedCaption
          text={post.caption}
          prefix={name}
          lines={3}
          fontSize="0.92rem"
          style={{ lineHeight: 1.7, marginTop: '0.9rem', opacity: 0.9 }}
        />
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
      className="view-toggle-btn flex items-center justify-center"
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

// Large viewer for one post's photos and videos. Opens on the item clicked;
// arrows, arrow keys and swiping step through the rest, and "Previous post" /
// "Next post" at the bottom move to the neighbouring posts on the page.
// Escape, Close or a click on the dark backdrop closes it, and focus goes
// back to the item that opened it. Drawn on <body>, above the chat button
// (z-index 1000).
function MediaLightbox({ posts, startPostId, start = 0, onClose }) {
  const [spot, setSpot] = useState({ postId: startPostId, index: start })
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const touchX = useRef(null)
  const postIndex = Math.max(0, posts.findIndex((p) => p.id === spot.postId))
  const post = posts[postIndex]
  const media = post?.media || []
  const caption = post?.caption
  const index = Math.min(spot.index, Math.max(0, media.length - 1))
  const prevPost = postIndex > 0 ? posts[postIndex - 1] : null
  const nextPost = postIndex < posts.length - 1 ? posts[postIndex + 1] : null
  const jumpTo = (p) => setSpot({ postId: p.id, index: 0 })
  const count = media.length
  const item = media[index]
  const go = useCallback(
    (delta) => setSpot((s) => ({ ...s, index: (Math.min(s.index, count - 1) + delta + count) % count })),
    [count],
  )

  // Move focus in, stop the page scrolling behind, and give focus back on close.
  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      if (opener && typeof opener.focus === 'function') opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && count > 1 && e.target.tagName !== 'VIDEO') {
        // (On a focused video the arrow keys seek instead.)
        e.preventDefault()
        go(e.key === 'ArrowLeft' ? -1 : 1)
      } else if (e.key === 'Tab') {
        // Keep keyboard focus inside the viewer.
        const nodes = dialogRef.current?.querySelectorAll('button, video[controls]')
        if (!nodes || !nodes.length) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, go, count])

  const closeOnBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const arrow = (dir) => (
    <button
      type="button"
      className={`field-lightbox-arrow ${dir < 0 ? 'prev' : 'next'}`}
      aria-label={dir < 0 ? 'Previous' : 'Next'}
      onClick={() => go(dir)}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d={dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  )

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={item?.type === 'video' ? 'Video player' : 'Photo viewer'}
      className="field-lightbox"
      onClick={closeOnBackdrop}
    >
      <div className="field-lightbox-bar">
        <span aria-live="polite">{count > 1 ? `${index + 1} / ${count}` : ''}</span>
        <button ref={closeRef} type="button" onClick={onClose} className="field-lightbox-close">
          Close ✕
        </button>
      </div>
      <div
        className="field-lightbox-stage"
        onClick={closeOnBackdrop}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null || count < 2) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        }}
      >
        {item?.type === 'video' ? (
          <video key={item.url} src={item.url} controls autoPlay playsInline className="field-lightbox-media" />
        ) : (
          <img key={item?.url} src={item?.url} alt={caption || 'Cavalier crew at work'} className="field-lightbox-media" />
        )}
        {count > 1 && arrow(-1)}
        {count > 1 && arrow(1)}
      </div>
      {(prevPost || nextPost) && (
        <div className="viewer-jumps">
          {prevPost ? (
            <button type="button" className="viewer-jump" onClick={() => jumpTo(prevPost)}>
              ← Previous post
            </button>
          ) : (
            <span />
          )}
          {nextPost && (
            <button type="button" className="viewer-jump" onClick={() => jumpTo(nextPost)}>
              Next post →
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}
