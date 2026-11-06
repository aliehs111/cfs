import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FieldPostCard } from './FieldPage'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Supabase free plan caps each file at 50 MB. Raise this (and the bucket's
// file_size_limit in schema.sql) if the project moves to a paid plan.
const MAX_VIDEO_MB = 50
const MAX_FILES = 10
const MAX_IMAGE_DIMENSION = 2400
const NAME_KEY = 'cavalier_field_author'

const EXT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

function fileType(file) {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  return EXT_TYPES[ext] || ''
}

function readStored(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode etc. — not important */
  }
}

// Shrink phone photos (often 4000px+, 5–12 MB) before upload so posting
// works on a weak job-site signal. Falls back to the original if the
// browser can't decode it.
async function prepareImage(file) {
  const type = fileType(file)
  if (type === 'image/gif') return { blob: file, type }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale === 1 && file.size < 2.5 * 1024 * 1024) return { blob: file, type }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ? { blob, type: 'image/jpeg' } : { blob: file, type }
  } catch {
    return { blob: file, type }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function putWithProgress(url, blob, type, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', type)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(blob)
  })
}

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
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/field/session`, { credentials: 'include' })
      .then((res) => setAuthed(res.ok))
      .catch(() => setAuthed(false))
  }, [])

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/field/logout`, { method: 'POST', credentials: 'include' })
    } catch {
      /* ignore */
    }
    setAuthed(false)
  }

  return (
    <section className="w-full max-w-2xl mx-auto px-6 pt-16 pb-24">
      <div className="flex items-center justify-between">
        <p
          className="uppercase"
          style={{ color: 'var(--maroon)', letterSpacing: '0.16em', fontSize: '0.7rem', margin: 0 }}
        >
          In the Field · Staff
        </p>
        {authed && (
          <button type="button" onClick={logout} className="text-xs uppercase" style={textButton}>
            Sign out
          </button>
        )}
      </div>

      {authed === null && <p style={{ opacity: 0.4, marginTop: '2rem' }}>Loading…</p>}
      {authed === false && <LoginForm onSuccess={() => setAuthed(true)} />}
      {authed === true && <PostManager onUnauthorized={() => setAuthed(false)} />}
    </section>
  )
}

function LoginForm({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/field/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 401) return setError('Incorrect password.')
      if (res.status === 429) return setError('Too many attempts. Wait a minute and try again.')
      if (!res.ok) throw new Error('failed')
      onSuccess()
    } catch {
      setError('Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm">
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(2rem, 6vw, 3rem)',
          color: 'var(--off-white)',
          letterSpacing: '-0.02em',
          margin: '1.5rem 0 2rem',
        }}
      >
        Sign in to post
      </h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Team password"
        autoFocus
        autoComplete="current-password"
        style={inputStyle}
      />
      {error && <p className="text-xs mt-4" style={{ color: 'var(--maroon)' }}>{error}</p>}
      <button type="submit" disabled={busy} className="text-xs uppercase mt-8" style={textButton}>
        {busy ? 'Signing in…' : 'Enter →'}
      </button>
    </form>
  )
}

function PostManager({ onUnauthorized }) {
  const [items, setItems] = useState([]) // { id, file, type, preview }
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [author, setAuthor] = useState(() => readStored(NAME_KEY))
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
    fetch(`${API_BASE}/api/field/posts`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRecent(d.posts || []))
      .catch(() => {})

  useEffect(() => {
    loadRecent()
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
    writeStored(NAME_KEY, author.trim())

    try {
      const media = []
      for (const [n, item] of items.entries()) {
        const label = `${n + 1} of ${items.length}`
        setProgress(`Preparing ${label}…`)
        const { blob, type } = item.type.startsWith('image/')
          ? await prepareImage(item.file)
          : { blob: item.file, type: item.type }

        const urlRes = await fetch(`${API_BASE}/api/field/upload-url`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_type: type }),
        })
        if (urlRes.status === 401) return onUnauthorized()
        if (urlRes.status === 400) throw new Error(`${item.file.name}: that file type isn't supported.`)
        if (!urlRes.ok) throw new Error('Could not start the upload.')
        const { path, upload_url } = await urlRes.json()

        await putWithProgress(upload_url, blob, type, (p) =>
          setProgress(`Uploading ${label} — ${Math.round(p * 100)}%`),
        )
        media.push({ path })
      }

      setProgress('Publishing…')
      const res = await fetch(`${API_BASE}/api/field/posts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, location, author, media }),
      })
      if (res.status === 401) return onUnauthorized()
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

  const deletePost = async (id) => {
    if (!window.confirm('Delete this post from the website?')) return
    const res = await fetch(`${API_BASE}/api/field/posts/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.status === 401) return onUnauthorized()
    if (res.ok) setRecent((prev) => prev.filter((p) => p.id !== id))
    else window.alert('Could not delete that post.')
  }

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
        <p style={{ fontSize: '0.75rem', opacity: 0.45, marginTop: '0.6rem' }}>
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

        <label style={labelStyle} htmlFor="field-author">Your name (optional)</label>
        <input
          id="field-author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={100}
          autoComplete="name"
          disabled={uploading}
          style={inputStyle}
        />

        {error && <p className="text-sm mt-6" style={{ color: 'var(--maroon)' }}>{error}</p>}
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
                  <button
                    type="button"
                    onClick={() => deletePost(post.id)}
                    className="text-xs uppercase mt-4"
                    style={{ ...textButton, color: 'var(--maroon)', borderBottomColor: 'rgba(168,36,58,0.4)' }}
                  >
                    Delete
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
