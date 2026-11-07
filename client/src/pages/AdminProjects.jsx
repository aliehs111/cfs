import { useEffect, useRef, useState } from 'react'
import { apiFetch, readError } from '../lib/auth'
import { fileType, prepareImage, putWithProgress } from '../lib/upload'

const muted = 'rgba(236,228,215,0.55)'
const soft = 'rgba(236,228,215,0.7)'
const hairline = '1px solid rgba(236,228,215,0.08)'
const MAX_PHOTOS = 10

// Suggestions only: the founder hasn't signed off on a fixed list yet
// (see knowledge_base.md "What Cavalier does"), so any text is allowed.
const FLOORING_SUGGESTIONS = [
  'Carpet tile',
  'Broadloom carpet',
  'LVT',
  'VCT',
  'Sheet vinyl',
  'Rubber flooring',
  'Ceramic tile',
  'Porcelain tile',
  'Wall tile',
  'Specialty wall panels',
  'Concrete leveling',
  'Moisture mitigation',
]

const fieldStyle = {
  width: '100%',
  minWidth: 0,
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.2)',
  padding: '8px 0',
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: '16px', // 16px+ stops iOS from zooming into the field
  fontWeight: 300,
  color: 'var(--off-white)',
  outline: 'none',
  caretColor: 'var(--maroon)',
  borderRadius: 0,
}
const selectStyle = { ...fieldStyle, backgroundColor: 'var(--charcoal)', cursor: 'pointer' }
const labelStyle = {
  display: 'block',
  fontSize: '11px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: muted,
  marginBottom: '2px',
}
const action = {
  color: muted,
  letterSpacing: '0.12em',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
}
const primary = {
  ...action,
  color: 'var(--off-white)',
  borderBottom: '1px solid rgba(236,228,215,0.3)',
  paddingBottom: '3px',
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export default function AdminProjects({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | project

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/admin/projects')
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return onUnauthorized()
        if (!res.ok) throw new Error(await readError(res, 'Could not load projects.'))
        const json = await res.json()
        if (!cancelled) setData(json)
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [onUnauthorized])

  if (error) return <p className="font-body text-xs" style={{ color: 'var(--maroon-text)' }}>{error}</p>
  if (!data) return <p className="font-body text-xs" style={{ color: muted }}>Loading...</p>

  if (editing) {
    return (
      <ProjectEditor
        project={editing === 'new' ? null : editing}
        projectTypes={data.project_types}
        onUnauthorized={onUnauthorized}
        onCancel={() => setEditing(null)}
        onSaved={(p) => {
          setData((d) => ({
            ...d,
            projects: d.projects.some((x) => x.id === p.id)
              ? d.projects.map((x) => (x.id === p.id ? p : x))
              : [p, ...d.projects],
          }))
          setEditing(null)
        }}
        onDeleted={(id) => {
          setData((d) => ({ ...d, projects: d.projects.filter((x) => x.id !== id) }))
          setEditing(null)
        }}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-10">
        <p className="font-body" style={{ color: soft, fontSize: '14px', fontWeight: 300, maxWidth: '36rem', lineHeight: 1.7 }}>
          Projects shown in the gallery. Hidden projects stay here but don&apos;t appear on the site.
        </p>
        <button type="button" onClick={() => setEditing('new')} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={primary}>
          + Add project
        </button>
      </div>

      {data.projects.length === 0 && (
        <p className="font-body" style={{ color: muted, fontSize: '15px', fontWeight: 300 }}>No projects yet.</p>
      )}

      {data.projects.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setEditing(p)}
          className="w-full text-left flex items-center gap-5 py-4"
          style={{ borderTop: hairline, background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer', color: 'inherit' }}
        >
          <div className="shrink-0" style={{ width: 88, height: 66, backgroundColor: 'rgba(236,228,215,0.05)' }}>
            {p.image_urls?.[0] && <img src={p.image_urls[0]} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} loading="lazy" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display" style={{ color: 'var(--off-white)', fontSize: '16px', fontWeight: 500 }}>
              {p.name}
            </p>
            <p className="font-body" style={{ color: muted, fontSize: '13px', fontWeight: 300 }}>
              {[p.project_type, p.location, p.year].filter(Boolean).join(' · ') || '—'}
              {' · '}
              {p.image_urls?.length || 0} photo{p.image_urls?.length === 1 ? '' : 's'}
            </p>
          </div>
          <span
            className="font-body text-xs uppercase shrink-0"
            style={{ letterSpacing: '0.12em', color: p.is_public ? soft : 'var(--maroon-text)' }}
          >
            {p.is_public ? 'Public' : 'Hidden'}
          </span>
        </button>
      ))}
    </div>
  )
}

const emptyForm = {
  name: '',
  slug: '',
  project_type: '',
  flooring_type: '',
  location: '',
  year: '',
  square_footage: '',
  short_description: '',
  long_description: '',
  is_public: true,
}

function ProjectEditor({ project, projectTypes, onSaved, onCancel, onDeleted, onUnauthorized }) {
  const [form, setForm] = useState(() =>
    project
      ? Object.fromEntries(Object.keys(emptyForm).map((k) => [k, project[k] ?? emptyForm[k]]))
      : emptyForm
  )
  const [slugTouched, setSlugTouched] = useState(!!project)
  // { key, url, path, existing, status: 'uploading' | 'done' | 'error', note }
  const [photos, setPhotos] = useState(() =>
    (project?.images || []).map((img) => ({ key: img.url, url: img.url, path: img.path, existing: true, status: 'done' }))
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragKey, setDragKey] = useState(null)
  const fileInput = useRef(null)
  const uploadedHere = useRef([]) // paths uploaded in this form, to clean up on Cancel

  const set = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: value, ...(k === 'name' && !slugTouched ? { slug: slugify(value) } : {}) }))
  }

  const update = (key, changes) => setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...changes } : p)))

  const uploadOne = async (key, file) => {
    try {
      const { blob, type } = await prepareImage(file)
      const res = await apiFetch('/api/admin/projects/upload-url', {
        method: 'POST',
        body: JSON.stringify({ content_type: type }),
      })
      if (res.status === 401 || res.status === 403) return onUnauthorized()
      if (!res.ok) throw new Error(await readError(res, 'Upload failed.'))
      const { path, upload_url } = await res.json()
      await putWithProgress(upload_url, blob, type, (p) => update(key, { note: `${Math.round(p * 100)}%` }))
      uploadedHere.current.push(path)
      update(key, { path, status: 'done', note: '' })
    } catch (e) {
      update(key, { status: 'error', note: e.message === 'network' ? 'Upload failed' : e.message })
    }
  }

  const addFiles = (files) => {
    setError('')
    const room = MAX_PHOTOS - photos.length
    const accepted = []
    for (const file of files) {
      if (accepted.length >= room) {
        setError(`Up to ${MAX_PHOTOS} photos per project.`)
        break
      }
      if (!fileType(file).startsWith('image/')) {
        setError(`${file.name} isn't a photo.`)
        continue
      }
      accepted.push({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file), path: null, existing: false, status: 'uploading', note: '' })
    }
    if (!accepted.length) return
    setPhotos((list) => [...list, ...accepted.map((p) => ({ ...p, file: undefined }))])
    accepted.forEach((p) => uploadOne(p.key, p.file))
  }

  const move = (key, delta) =>
    setPhotos((list) => {
      const i = list.findIndex((p) => p.key === key)
      const j = i + delta
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const dropOn = (targetKey) => {
    if (!dragKey || dragKey === targetKey) return
    setPhotos((list) => {
      const from = list.findIndex((p) => p.key === dragKey)
      const to = list.findIndex((p) => p.key === targetKey)
      const next = [...list]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    setDragKey(null)
  }

  const remove = (key) => setPhotos((list) => list.filter((p) => p.key !== key))

  const uploading = photos.some((p) => p.status === 'uploading')

  const save = async (e) => {
    e.preventDefault()
    setError('')
    if (photos.some((p) => p.status === 'error')) return setError('Remove the photos that failed to upload, or add them again.')
    const num = (v) => (v === '' || v === null ? null : Number(String(v).replace(/[^\d]/g, '')) || null)
    const body = {
      ...form,
      project_type: form.project_type || null,
      year: num(form.year),
      square_footage: num(form.square_footage),
      images: photos.map((p) => (p.existing ? { url: p.url } : { path: p.path })),
    }
    setBusy(true)
    try {
      const res = await apiFetch(project ? `/api/admin/projects/${project.id}` : '/api/admin/projects', {
        method: project ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      })
      if (res.status === 401 || res.status === 403) return onUnauthorized()
      if (!res.ok) throw new Error(await readError(res, 'Could not save the project.'))
      onSaved((await res.json()).project)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    const unsaved = uploadedHere.current
    if (unsaved.length) {
      apiFetch('/api/admin/projects/discard-uploads', { method: 'POST', body: JSON.stringify({ paths: unsaved }) }).catch(() => {})
    }
    onCancel()
  }

  const destroy = async () => {
    if (!window.confirm(`Delete "${project.name}" and its photos? This can't be undone. (To take it off the site but keep it, untick "Show on the website" instead.)`)) return
    setBusy(true)
    try {
      const res = await apiFetch(`/api/admin/projects/${project.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await readError(res, 'Could not delete.'))
      onDeleted(project.id)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save}>
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-8">
        <p className="font-display" style={{ color: 'var(--off-white)', fontSize: '22px', fontWeight: 500 }}>
          {project ? `Edit: ${project.name}` : 'New project'}
        </p>
        {project?.is_public && (
          <a href={`/projects/${project.slug}`} target="_blank" rel="noreferrer" className="font-body text-xs uppercase hover:opacity-50" style={{ ...action, textDecoration: 'none' }}>
            View on site ↗
          </a>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-x-10 gap-y-6">
        <div className="md:col-span-2">
          <label style={labelStyle} htmlFor="p-name">Project name</label>
          <input id="p-name" value={form.name} onChange={set('name')} required maxLength={200} style={fieldStyle} placeholder="e.g. Riverside Medical Office Building" />
        </div>
        <div className="md:col-span-2">
          <label style={labelStyle} htmlFor="p-slug">Web address</label>
          <div className="flex items-baseline gap-1" style={{ color: muted, fontSize: '14px' }}>
            <span className="shrink-0">/projects/</span>
            <input
              id="p-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true)
                setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))
              }}
              required
              maxLength={120}
              style={fieldStyle}
            />
          </div>
          {project && form.slug !== project.slug && (
            <p className="font-body text-xs mt-1" style={{ color: 'var(--maroon-text)' }}>
              Changing this breaks any links already shared to the old address.
            </p>
          )}
        </div>
        <div>
          <label style={labelStyle} htmlFor="p-type">Project type</label>
          <select id="p-type" value={form.project_type} onChange={set('project_type')} style={selectStyle}>
            <option value="">—</option>
            {projectTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="p-flooring">Flooring</label>
          <input id="p-flooring" list="flooring-options" value={form.flooring_type} onChange={set('flooring_type')} maxLength={300} style={fieldStyle} placeholder="e.g. LVT, carpet tile" />
          <datalist id="flooring-options">
            {FLOORING_SUGGESTIONS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div>
          <label style={labelStyle} htmlFor="p-location">Location</label>
          <input id="p-location" value={form.location} onChange={set('location')} maxLength={200} style={fieldStyle} placeholder="e.g. Charlottesville, VA" />
        </div>
        <div className="grid grid-cols-2 gap-x-6">
          <div>
            <label style={labelStyle} htmlFor="p-year">Year</label>
            <input id="p-year" inputMode="numeric" value={form.year} onChange={set('year')} maxLength={4} style={fieldStyle} placeholder="2025" />
          </div>
          <div>
            <label style={labelStyle} htmlFor="p-sqft">Square feet</label>
            <input id="p-sqft" inputMode="numeric" value={form.square_footage} onChange={set('square_footage')} maxLength={12} style={fieldStyle} placeholder="18000" />
          </div>
        </div>
        <div className="md:col-span-2">
          <label style={labelStyle} htmlFor="p-short">Short description (gallery card)</label>
          <textarea id="p-short" value={form.short_description} onChange={set('short_description')} rows={2} maxLength={600} style={{ ...fieldStyle, resize: 'vertical' }} />
        </div>
        <div className="md:col-span-2">
          <label style={labelStyle} htmlFor="p-long">Full description (project page)</label>
          <textarea id="p-long" value={form.long_description} onChange={set('long_description')} rows={6} maxLength={10000} style={{ ...fieldStyle, resize: 'vertical' }} />
        </div>
      </div>

      <div className="mt-10">
        <p style={labelStyle}>Photos ({photos.length}/{MAX_PHOTOS}) — the first is the cover. Drag to reorder, or use the arrows.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-3">
          {photos.map((p, i) => (
            <div
              key={p.key}
              draggable={p.status === 'done'}
              onDragStart={() => setDragKey(p.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(p.key)}
              className="relative"
              style={{
                aspectRatio: '4 / 3',
                backgroundColor: 'rgba(236,228,215,0.05)',
                outline: dragKey === p.key ? '1px solid var(--maroon)' : i === 0 ? '1px solid rgba(236,228,215,0.4)' : 'none',
                cursor: p.status === 'done' ? 'grab' : 'default',
              }}
            >
              <img src={p.url} alt="" className="w-full h-full" style={{ objectFit: 'cover', opacity: p.status === 'done' ? 1 : 0.4 }} />
              {i === 0 && (
                <span className="absolute text-xs uppercase" style={{ left: 6, top: 4, color: '#fff', letterSpacing: '0.1em', textShadow: '0 0 4px #000' }}>
                  Cover
                </span>
              )}
              {p.status !== 'done' && (
                <span className="absolute inset-0 flex items-center justify-center text-xs text-center px-2" style={{ color: p.status === 'error' ? '#ff8a9a' : '#fff', textShadow: '0 0 4px #000' }}>
                  {p.status === 'error' ? p.note || 'Failed' : `Uploading ${p.note || ''}`}
                </span>
              )}
              <div className="absolute flex gap-1" style={{ right: 4, bottom: 4 }}>
                {[
                  ['←', 'Move earlier', () => move(p.key, -1), i > 0],
                  ['→', 'Move later', () => move(p.key, 1), i < photos.length - 1],
                  ['✕', 'Remove photo', () => remove(p.key), true],
                ].map(([label, aria, fn, show]) =>
                  show ? (
                    <button
                      key={aria}
                      type="button"
                      aria-label={aria}
                      onClick={fn}
                      style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontSize: 13 }}
                    >
                      {label}
                    </button>
                  ) : null
                )}
              </div>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              style={{ aspectRatio: '4 / 3', border: '1px dashed rgba(236,228,215,0.3)', background: 'transparent', color: 'var(--off-white)', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase' }}
            >
              + Add photos
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(Array.from(e.target.files || []))
            e.target.value = ''
          }}
        />
      </div>

      <label className="flex items-center gap-3 mt-10 font-body" style={{ color: soft, fontSize: '14px', fontWeight: 300, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_public} onChange={set('is_public')} style={{ width: 18, height: 18, accentColor: 'var(--maroon)' }} />
        Show on the website
      </label>

      {error && (
        <p className="font-body text-xs mt-6" role="alert" style={{ color: 'var(--maroon-text)' }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-8 mt-10">
        <button type="submit" disabled={busy || uploading} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={{ ...primary, opacity: busy || uploading ? 0.4 : 1 }}>
          {busy ? 'Saving…' : uploading ? 'Waiting for uploads…' : project ? 'Save changes' : 'Create project'}
        </button>
        <button type="button" onClick={cancel} disabled={busy} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={action}>
          Cancel
        </button>
        {project && (
          <button type="button" onClick={destroy} disabled={busy} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50 ml-auto" style={{ ...action, color: 'var(--maroon-text)' }}>
            Delete project
          </button>
        )}
      </div>
    </form>
  )
}
