import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FieldPostCard } from './FieldPage'
import FieldPostEditor from '../components/FieldPostEditor'
import { apiFetch, canPost, isAdmin, useCurrentUser } from '../lib/auth'
import { fileType, prepareImage, putWithProgress } from '../lib/upload'

const LOGIN_PATH = '/login?next=/in-the-field/post'

// Supabase free plan caps each file at 50 MB. Raise this (and the bucket's
// file_size_limit in schema.sql) if the project moves to a paid plan.
const MAX_VIDEO_MB = 50
const MAX_FILES = 10

const inputStyle = {
  width: '100%',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.2)',
  padding: '12px 0',
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: '16px', // 16px+ stops iOS from zooming into the field
  fontWeight: 300,
  color: 'var(--off-white)',
  outline: 'none',
  caretColor: 'var(--maroon)',
  borderRadius: 0,
}

const labelStyle = {
  display: 'block',
  fontSize: '0.7rem',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--off-white)',
  opacity: 0.6,
  marginTop: '2rem',
}

const textButton = {
  color: 'var(--off-white)',
  letterSpacing: '0.14em',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.3)',
  cursor: 'pointer',
  padding: '0 0 3px',
}

export default function FieldPostPage() {
  const { user, loading, signOut } = useCurrentUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) navigate(LOGIN_PATH, { replace: true })
  }, [loading, user, navigate])

  const leave = () => {
    signOut()
    navigate('/in-the-field', { replace: true })
  }

  return (
    <section className="w-full max-w-2xl mx-auto px-6 pt-16 pb-24">
      <div className="flex items-center justify-between gap-4">
        <p
          className="uppercase"
          style={{ color: 'var(--maroon-text)', letterSpacing: '0.16em', fontSize: '0.7rem', margin: 0 }}
        >
          In the Field · Staff
        </p>
        {user && (
          <span className="flex items-center gap-4" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            {user.name}
            <button type="button" onClick={leave} className="text-xs uppercase" style={textButton}>
              Sign out
            </button>
          </span>
        )}
      </div>

      {loading && <p style={{ opacity: 0.55, marginTop: '2rem' }}>Loading…</p>}
      {user && !canPost(user) && (
        <p style={{ marginTop: '2rem', fontSize: '0.95rem', lineHeight: 1.7, opacity: 0.8 }}>
          Your account can comment on posts but not create them. Ask an admin if you need posting access.{' '}
          <Link to="/in-the-field" style={{ color: 'var(--off-white)', borderBottom: '1px solid var(--maroon)', textDecoration: 'none' }}>
            Go to In the Field →
          </Link>
        </p>
      )}
      {user && canPost(user) && (
        <PostManager user={user} onUnauthorized={() => navigate(LOGIN_PATH, { replace: true })} />
      )}
    </section>
  )
}

function PostManager({ user, onUnauthorized }) {
  const [items, setItems] = useState([]) // { id, file, type, preview }
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState('idle') // idle | uploading | done
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [recent, setRecent] = useState([])
  const fileInput = useRef(null)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Free preview memory when leaving the page.
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), [])

  const loadRecent = () =>
    apiFetch('/api/field/posts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRecent(d.posts || []))
      .catch(() => {})

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/field/posts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setRecent(d.posts || []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const addFiles = (fileList) => {
    setError('')
    const next = [...items]
    for (const file of fileList) {
      if (next.length >= MAX_FILES) {
        setError(`Up to ${MAX_FILES} photos/videos per post.`)
        break
      }
      const type = fileType(file)
      if (!type.startsWith('image/') && !type.startsWith('video/')) {
        setError(`${file.name} isn't a photo or video.`)
        continue
      }
      if (type === 'image/heic' || type === 'image/heif') {
        setError(`${file.name} is a HEIC photo, which most browsers can't show. Post it from your phone's photo library, or export it as JPEG.`)
        continue
      }
      if (type.startsWith('video/') && file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setError(`${file.name} is over ${MAX_VIDEO_MB} MB. Trim the clip and try again.`)
        continue
      }
      next.push({ id: crypto.randomUUID(), file, type, preview: URL.createObjectURL(file) })
    }
    setItems(next)
  }

  const removeItem = (id) => {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id)
      if (gone) URL.revokeObjectURL(gone.preview)
      return prev.filter((i) => i.id !== id)
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!items.length) return setError('Add at least one photo or video.')
    setError('')
    setStatus('uploading')

    try {
      const media = []
      for (const [n, item] of items.entries()) {
        const label = `${n + 1} of ${items.length}`
        setProgress(`Preparing ${label}…`)
        const { blob, type } = item.type.startsWith('image/')
          ? await prepareImage(item.file)
          : { blob: item.file, type: item.type }

        const urlRes = await apiFetch('/api/field/upload-url', {
          method: 'POST',
          body: JSON.stringify({ content_type: type }),
        })
        if (urlRes.status === 401 || urlRes.status === 403) return onUnauthorized()
        if (urlRes.status === 400) throw new Error(`${item.file.name}: that file type isn't supported.`)
        if (!urlRes.ok) throw new Error('Could not start the upload.')
        const { path, upload_url } = await urlRes.json()

        await putWithProgress(upload_url, blob, type, (p) =>
          setProgress(`Uploading ${label} — ${Math.round(p * 100)}%`),
        )
        media.push({ path })
      }

      setProgress('Publishing…')
      const res = await apiFetch('/api/field/posts', {
        method: 'POST',
        body: JSON.stringify({ caption, location, media }),
      })
      if (res.status === 401 || res.status === 403) return onUnauthorized()
      if (!res.ok) throw new Error('Could not publish the post.')

      items.forEach((i) => URL.revokeObjectURL(i.preview))
      setItems([])
      setCaption('')
      setLocation('')
      setStatus('done')
      loadRecent()
    } catch (err) {
      setStatus('idle')
      setError(
        err.message === 'network' || err.message?.startsWith('upload')
          ? 'Upload failed. Check your signal and try again.'
          : err.message || 'Something went wrong.',
      )
    } finally {
      setProgress('')
    }
  }

  const canManage = (post) => isAdmin(user) || post.user_id === user.id

  const uploading = status === 'uploading'

  return (
    <>
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(2rem, 6vw, 3rem)',
          color: 'var(--off-white)',
          letterSpacing: '-0.02em',
          margin: '1.5rem 0 0',
        }}
      >
        New post
      </h1>

      {status === 'done' && (
        <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--off-white)' }}>
          Posted.{' '}
          <Link to="/in-the-field" style={{ color: 'var(--off-white)', borderBottom: '1px solid var(--maroon)', textDecoration: 'none' }}>
            See it on the site →
          </Link>
        </p>
      )}

      <form onSubmit={submit}>
        <span style={labelStyle}>Photos & videos</span>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative"
              style={{ aspectRatio: '1', backgroundColor: 'rgba(236,228,215,0.06)' }}
            >
              {item.type.startsWith('video/') ? (
                <video src={item.preview} muted playsInline preload="metadata" className="w-full h-full" style={{ objectFit: 'cover' }} />
              ) : (
                <img src={item.preview} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
              )}
              {item.type.startsWith('video/') && (
                <span
                  className="absolute text-xs"
                  style={{ left: 6, bottom: 4, color: '#fff', textShadow: '0 0 4px #000' }}
                >
                  ▶ video
                </span>
              )}
              {!uploading && (
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => removeItem(item.id)}
                  className="absolute"
                  style={{
                    top: 4,
                    right: 4,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {items.length < MAX_FILES && !uploading && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              style={{
                aspectRatio: '1',
                border: '1px dashed rgba(236,228,215,0.3)',
                background: 'transparent',
                color: 'var(--off-white)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              + Add
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(Array.from(e.target.files || []))
            e.target.value = ''
          }}
        />
        <p style={{ fontSize: '0.75rem', opacity: 0.55, marginTop: '0.6rem' }}>
          Up to {MAX_FILES} per post. Videos up to {MAX_VIDEO_MB} MB (about a minute of 1080p).
        </p>

        <label style={labelStyle} htmlFor="field-caption">What's happening</label>
        <textarea
          id="field-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. Leveling the second floor slab before LVT goes down."
          disabled={uploading}
          style={{ ...inputStyle, resize: 'vertical' }}
        />

        <label style={labelStyle} htmlFor="field-location">Where (optional)</label>
        <input
          id="field-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
          placeholder="e.g. Charlottesville, VA"
          disabled={uploading}
          style={inputStyle}
        />

        <p style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '1.5rem' }}>Posting as {user.name}.</p>

        {error && <p className="text-sm mt-6" style={{ color: 'var(--maroon-text)' }}>{error}</p>}
        {progress && <p className="text-sm mt-6" style={{ opacity: 0.7 }}>{progress}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="uppercase mt-10"
          style={{
            width: '100%',
            padding: '1rem',
            backgroundColor: uploading ? 'rgba(168,36,58,0.5)' : 'var(--maroon)',
            color: 'var(--white)',
            border: 'none',
            letterSpacing: '0.16em',
            fontSize: '0.8rem',
            cursor: uploading ? 'wait' : 'pointer',
          }}
        >
          {uploading ? 'Posting…' : 'Post to the website'}
        </button>
      </form>

      {recent.length > 0 && (
        <div className="mt-24">
          <div className="hairline mb-12" />
          <p
            className="uppercase"
            style={{ letterSpacing: '0.16em', fontSize: '0.7rem', opacity: 0.6, marginBottom: '2rem' }}
          >
            Recent posts
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-12">
            {recent.map((post) => (
              <FieldPostCard
                key={post.id}
                post={post}
                footer={
                  canManage(post) ? (
                    <FieldPostEditor
                      post={post}
                      onSaved={(updated) => setRecent((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))}
                      onDeleted={(id) => setRecent((prev) => prev.filter((p) => p.id !== id))}
                      onUnauthorized={onUnauthorized}
                    />
                  ) : null
                }
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

