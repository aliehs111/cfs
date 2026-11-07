import { useRef, useState } from 'react'
import { apiFetch, readError } from '../lib/auth'
import { fileType, prepareImage, putWithProgress } from '../lib/upload'

// Edit / Delete controls for one In the Field post. Shown to the poster on
// their own posts and to admins on every post (the server enforces the same).
// Used on the public feed and on the posting page.

const MAX_FILES = 10
const MAX_VIDEO_MB = 50

const inputStyle = {
  width: '100%',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.2)',
  padding: '10px 0',
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: '16px', // 16px+ stops iOS from zooming into the field
  fontWeight: 300,
  color: 'var(--off-white)',
  outline: 'none',
  caretColor: 'var(--maroon)',
  borderRadius: 0,
}
const textButton = {
  color: 'var(--off-white)',
  letterSpacing: '0.14em',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.3)',
  cursor: 'pointer',
  padding: '0 0 3px',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
}
const label = {
  display: 'block',
  fontSize: '0.65rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--off-white)',
  opacity: 0.6,
  marginTop: '1rem',
}

export default function FieldPostEditor({ post, onSaved, onDeleted, onUnauthorized }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const remove = async () => {
    if (!window.confirm('Delete this post from the website? Its photos, videos and comments are removed too.')) return
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`/api/field/posts/${post.id}`, { method: 'DELETE' })
      if (res.status === 401) return onUnauthorized?.()
      if (!res.ok) throw new Error(await readError(res, 'Could not delete that post.'))
      onDeleted(post.id)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <EditForm
        post={post}
        onCancel={() => setEditing(false)}
        onUnauthorized={onUnauthorized}
        onSaved={(p) => {
          setEditing(false)
          onSaved(p)
        }}
      />
    )
  }

  return (
    <div style={{ marginTop: '0.9rem' }}>
      <div className="flex gap-6">
        <button type="button" onClick={() => setEditing(true)} disabled={busy} style={textButton}>
          Edit
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          style={{ ...textButton, color: 'var(--maroon-text)', borderBottomColor: 'rgba(217,86,107,0.4)' }}
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--maroon-text)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>}
    </div>
  )
}

function EditForm({ post, onSaved, onCancel, onUnauthorized }) {
  const [caption, setCaption] = useState(post.caption || '')
  const [location, setLocation] = useState(post.location || '')
  // { key, path, url, type: 'image' | 'video', status: 'done' | 'uploading' | 'error', note }
  const [media, setMedia] = useState(() =>
    (post.media || []).map((m) => ({ key: m.path, path: m.path, url: m.url, type: m.type, status: 'done' }))
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef(null)

  const update = (key, changes) => setMedia((list) => list.map((m) => (m.key === key ? { ...m, ...changes } : m)))

  const upload = async (key, file, type) => {
    try {
      const { blob, type: sendType } = type.startsWith('image/') ? await prepareImage(file) : { blob: file, type }
      const res = await apiFetch('/api/field/upload-url', { method: 'POST', body: JSON.stringify({ content_type: sendType }) })
      if (res.status === 401 || res.status === 403) return onUnauthorized?.()
      if (!res.ok) throw new Error(await readError(res, 'Upload failed.'))
      const { path, upload_url } = await res.json()
      await putWithProgress(upload_url, blob, sendType, (p) => update(key, { note: `${Math.round(p * 100)}%` }))
      update(key, { path, status: 'done', note: '' })
    } catch (e) {
      update(key, { status: 'error', note: e.message === 'network' ? 'Upload failed' : e.message })
    }
  }

  const addFiles = (files) => {
    setError('')
    const room = MAX_FILES - media.length
    const accepted = []
    for (const file of files) {
      if (accepted.length >= room) {
        setError(`Up to ${MAX_FILES} photos/videos per post.`)
        break
      }
      const type = fileType(file)
      if (!type.startsWith('image/') && !type.startsWith('video/')) {
        setError(`${file.name} isn't a photo or video.`)
        continue
      }
      if (type.startsWith('video/') && file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setError(`${file.name} is over ${MAX_VIDEO_MB} MB. Trim the clip and try again.`)
        continue
      }
      accepted.push({ key: crypto.randomUUID(), file, type })
    }
    if (!accepted.length) return
    setMedia((list) => [
      ...list,
      ...accepted.map(({ key, file, type }) => ({
        key,
        path: null,
        url: URL.createObjectURL(file),
        type: type.startsWith('video/') ? 'video' : 'image',
        status: 'uploading',
        note: '',
      })),
    ])
    accepted.forEach(({ key, file, type }) => upload(key, file, type))
  }

  const uploading = media.some((m) => m.status === 'uploading')

  const save = async (e) => {
    e.preventDefault()
    setError('')
    if (!media.length) return setError('A post needs at least one photo or video. Use Delete to remove the whole post.')
    if (media.some((m) => m.status === 'error')) return setError('Remove the files that failed to upload first.')
    setBusy(true)
    try {
      const res = await apiFetch(`/api/field/posts/${post.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption, location, media: media.map((m) => ({ path: m.path })) }),
      })
      if (res.status === 401) return onUnauthorized?.()
      if (!res.ok) throw new Error(await readError(res, 'Could not save.'))
      onSaved((await res.json()).post)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} style={{ marginTop: '1rem', padding: '1rem', border: '1px solid rgba(236,228,215,0.12)' }}>
      <span style={{ ...label, marginTop: 0 }}>Photos & videos</span>
      <div className="grid grid-cols-3 gap-2" style={{ marginTop: '0.5rem' }}>
        {media.map((m) => (
          <div key={m.key} className="relative" style={{ aspectRatio: '1', backgroundColor: 'rgba(236,228,215,0.06)' }}>
            {m.type === 'video' ? (
              <video src={m.url} muted playsInline preload="metadata" className="w-full h-full" style={{ objectFit: 'cover' }} />
            ) : (
              <img src={m.url} alt="" className="w-full h-full" style={{ objectFit: 'cover', opacity: m.status === 'done' ? 1 : 0.4 }} />
            )}
            {m.status !== 'done' && (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-center px-1" style={{ color: m.status === 'error' ? '#ff8a9a' : '#fff', textShadow: '0 0 4px #000' }}>
                {m.status === 'error' ? m.note || 'Failed' : `Uploading ${m.note || ''}`}
              </span>
            )}
            <button
              type="button"
              aria-label={m.type === 'video' ? 'Remove video' : 'Remove photo'}
              onClick={() => setMedia((list) => list.filter((x) => x.key !== m.key))}
              className="absolute"
              style={{ top: 4, right: 4, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontSize: 13 }}
            >
              ✕
            </button>
          </div>
        ))}
        {media.length < MAX_FILES && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            style={{ aspectRatio: '1', border: '1px dashed rgba(236,228,215,0.3)', background: 'transparent', color: 'var(--off-white)', cursor: 'pointer', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}
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

      <label style={label} htmlFor={`cap-${post.id}`}>Caption</label>
      <textarea id={`cap-${post.id}`} value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={2000} style={{ ...inputStyle, resize: 'vertical' }} />
      <label style={label} htmlFor={`loc-${post.id}`}>Location</label>
      <input id={`loc-${post.id}`} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} style={inputStyle} />

      {error && <p role="alert" style={{ color: 'var(--maroon-text)', fontSize: '0.8rem', marginTop: '0.75rem' }}>{error}</p>}
      <div className="flex gap-6" style={{ marginTop: '1rem' }}>
        <button type="submit" disabled={busy || uploading} style={{ ...textButton, opacity: busy || uploading ? 0.5 : 1 }}>
          {busy ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} style={{ ...textButton, borderBottom: 'none', opacity: 0.7 }}>
          Cancel
        </button>
      </div>
    </form>
  )
}
