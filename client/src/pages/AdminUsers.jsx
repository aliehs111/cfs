import { useEffect, useState } from 'react'
import { apiFetch, readError, ROLE_LABELS } from '../lib/auth'

const muted = 'rgba(236,228,215,0.55)'
const soft = 'rgba(236,228,215,0.7)'
const hairline = '1px solid rgba(236,228,215,0.08)'

const ROLE_HELP = {
  dev_admin: 'Everything an admin can do, plus managing the developer account and seeing technical log details',
  admin: 'Admin page, manage users, post, comment',
  poster: 'Post to In the Field and comment',
  user: 'Comment only',
}

const actionStyle = {
  color: muted,
  letterSpacing: '0.12em',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
}

const fieldStyle = {
  width: '100%',
  minWidth: 0,
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.2)',
  padding: '8px 0',
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: '14px',
  fontWeight: 300,
  color: 'var(--off-white)',
  outline: 'none',
  caretColor: 'var(--maroon)',
}

const selectStyle = {
  ...fieldStyle,
  backgroundColor: 'var(--charcoal)',
  cursor: 'pointer',
}

function formatDate(ts) {
  if (!ts) return 'Never'
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function inviteText(user, me) {
  const origin = window.location.origin
  return [
    `Hi ${user.first_name},`,
    '',
    "I've set up an account for you on the Cavalier Flooring Systems website.",
    '',
    `Sign in here: ${origin}/login`,
    `Email: ${user.email}`,
    '',
    "I'll send your temporary password separately. You'll choose your own password the first time you sign in.",
    '',
    me?.first_name || '',
  ].join('\n')
}

function emailInvite(user, me) {
  const subject = encodeURIComponent('Your Cavalier website account')
  const body = encodeURIComponent(inviteText(user, me))
  window.location.href = `mailto:${encodeURIComponent(user.email)}?subject=${subject}&body=${body}`
}

async function textInvite(user, me) {
  const text = inviteText(user, me)
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return
    } catch (e) {
      if (e?.name === 'AbortError') return
    }
  }
  window.location.href = `sms:?&body=${encodeURIComponent(text)}`
}

export default function AdminUsers({ me, onUnauthorized }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState(null) // { user, password, reason }
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/admin/users')
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return onUnauthorized()
        if (!res.ok) throw new Error(await readError(res, 'Could not load users.'))
        const json = await res.json()
        if (!cancelled) setData(json)
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [onUnauthorized])

  const replaceUser = (user) =>
    setData((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? user : u)) }))

  if (error) {
    return (
      <p className="font-body text-xs" style={{ color: 'var(--maroon-text)' }}>
        {error}
      </p>
    )
  }
  if (!data) {
    return (
      <p className="font-body text-xs" style={{ color: muted }}>
        Loading...
      </p>
    )
  }

  return (
    <div>
      {credentials && (
        <CredentialsPanel {...credentials} me={me} onClose={() => setCredentials(null)} />
      )}

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50 mb-10"
          style={{ ...actionStyle, color: 'var(--off-white)', borderBottom: '1px solid rgba(236,228,215,0.3)', paddingBottom: '3px' }}
        >
          + Add user
        </button>
      ) : (
        <AddUserForm
          roles={data.grantable_roles}
          onCancel={() => setShowAdd(false)}
          onUnauthorized={onUnauthorized}
          onCreated={({ user, temporary_password }) => {
            setData((d) => ({ ...d, users: [...d.users, user].sort((a, b) => a.name.localeCompare(b.name)) }))
            setShowAdd(false)
            setCredentials({ user, password: temporary_password, reason: 'created' })
          }}
        />
      )}

      <div>
        {data.users.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            me={me}
            roles={data.grantable_roles}
            onSaved={replaceUser}
            onUnauthorized={onUnauthorized}
            onPasswordReset={({ user, temporary_password }) => {
              replaceUser(user)
              setCredentials({ user, password: temporary_password, reason: 'reset' })
            }}
          />
        ))}
      </div>
    </div>
  )
}

function CredentialsPanel({ user, password, reason, me, onClose }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="p-6 mb-10" role="status" style={{ border: '1px solid rgba(236,228,215,0.2)', backgroundColor: 'rgba(236,228,215,0.04)' }}>
      <p className="font-display" style={{ color: 'var(--off-white)', fontSize: '16px', fontWeight: 500 }}>
        {reason === 'created' ? `Account created for ${user.name}` : `Password reset for ${user.name}`}
      </p>
      <p className="font-body mt-2" style={{ color: soft, fontSize: '13px', fontWeight: 300, lineHeight: 1.7 }}>
        Temporary password, shown only this once. Give it to {user.first_name} separately from the invite (for example,
        read it to them or text it). They&apos;ll choose their own when they first sign in.
      </p>
      <p
        className="mt-4 select-all"
        style={{ color: 'var(--off-white)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '20px', letterSpacing: '0.04em' }}
      >
        {password}
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-3 mt-5">
        <button type="button" onClick={copy} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={{ ...actionStyle, color: 'var(--off-white)' }}>
          {copied ? 'Copied ✓' : 'Copy password'}
        </button>
        {reason === 'created' && (
          <>
            <button type="button" onClick={() => emailInvite(user, me)} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={{ ...actionStyle, color: 'var(--off-white)' }}>
              Email invite
            </button>
            <button type="button" onClick={() => textInvite(user, me)} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={{ ...actionStyle, color: 'var(--off-white)' }}>
              Text invite
            </button>
          </>
        )}
        <button type="button" onClick={onClose} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={actionStyle}>
          Done
        </button>
      </div>
    </div>
  )
}

function AddUserForm({ roles, onCreated, onCancel, onUnauthorized }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: 'poster' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(form) })
      if (res.status === 401) return onUnauthorized()
      if (!res.ok) throw new Error(await readError(res, 'Could not create the user.'))
      onCreated(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-12 p-6" style={{ border: hairline }}>
      <p className="font-display mb-4" style={{ color: 'var(--off-white)', fontSize: '16px', fontWeight: 500 }}>
        Add user
      </p>
      <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
        <input aria-label="First name" placeholder="First name" value={form.first_name} onChange={set('first_name')} required autoFocus style={fieldStyle} />
        <input aria-label="Last name" placeholder="Last name" value={form.last_name} onChange={set('last_name')} required style={fieldStyle} />
        <input aria-label="Email" placeholder="Email" type="email" autoCapitalize="none" value={form.email} onChange={set('email')} required style={fieldStyle} />
        <select aria-label="Role" value={form.role} onChange={set('role')} style={selectStyle}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]} — {ROLE_HELP[r]}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="font-body text-xs mt-4" role="alert" style={{ color: 'var(--maroon-text)' }}>
          {error}
        </p>
      )}
      <div className="flex gap-8 mt-6">
        <button type="submit" disabled={busy} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={{ ...actionStyle, color: 'var(--off-white)', opacity: busy ? 0.5 : 1 }}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <button type="button" onClick={onCancel} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={actionStyle}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function UserRow({ user, me, roles, onSaved, onPasswordReset, onUnauthorized }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, email: user.email })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isMe = user.id === me.id
  const locked = user.role === 'dev_admin' && me.role !== 'dev_admin'

  const call = async (path, options, onOk) => {
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(path, options)
      if (res.status === 401) return onUnauthorized()
      if (!res.ok) throw new Error(await readError(res, 'Could not save.'))
      onOk(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const patch = (changes, after) =>
    call(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(changes) }, (d) => {
      onSaved(d.user)
      after?.()
    })

  const changeRole = (e) => {
    const role = e.target.value
    if (role === user.role) return
    if (!window.confirm(`Change ${user.name} to ${ROLE_LABELS[role]}?`)) return
    patch({ role })
  }

  const toggleActive = () => {
    const verb = user.active ? 'Deactivate' : 'Reactivate'
    const note = user.active ? ' They will be signed out immediately and won’t be able to sign in.' : ''
    if (!window.confirm(`${verb} ${user.name}?${note}`)) return
    patch({ active: !user.active })
  }

  const resetPassword = () => {
    if (!window.confirm(`Reset ${user.name}'s password? They'll be signed out everywhere and need the new temporary password.`)) return
    call(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' }, onPasswordReset)
  }

  const status = !user.active ? 'Deactivated' : user.must_change_password ? 'Hasn’t signed in yet' : 'Active'
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="py-6" style={{ borderTop: hairline, opacity: user.active ? 1 : 0.55 }}>
      <div className="grid md:grid-cols-12 gap-4 items-start">
        <div className="md:col-span-4 min-w-0">
          {editing ? (
            <div className="grid gap-2">
              <input aria-label="First name" value={form.first_name} onChange={set('first_name')} style={fieldStyle} />
              <input aria-label="Last name" value={form.last_name} onChange={set('last_name')} style={fieldStyle} />
              <input aria-label="Email" type="email" value={form.email} onChange={set('email')} style={fieldStyle} />
            </div>
          ) : (
            <>
              <p className="font-display" style={{ color: 'var(--off-white)', fontSize: '16px', fontWeight: 500 }}>
                {user.name}
                {isMe && <span className="font-body" style={{ color: muted, fontSize: '12px', fontWeight: 300 }}> (you)</span>}
              </p>
              <p className="font-body" style={{ color: soft, fontSize: '13px', fontWeight: 300, wordBreak: 'break-all' }}>
                {user.email}
              </p>
            </>
          )}
        </div>

        <div className="md:col-span-3">
          {isMe || locked ? (
            <p className="font-body" style={{ color: soft, fontSize: '13px', fontWeight: 300, paddingTop: '8px' }}>
              {ROLE_LABELS[user.role]}
            </p>
          ) : (
            <select aria-label={`Role for ${user.name}`} value={user.role} onChange={changeRole} disabled={busy} style={{ ...selectStyle, fontSize: '13px' }}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="md:col-span-2">
          <p className="font-body" style={{ color: user.active ? soft : 'var(--maroon-text)', fontSize: '12px', fontWeight: 300 }}>
            {status}
          </p>
          <p className="font-body" style={{ color: muted, fontSize: '12px', fontWeight: 300 }}>
            Last sign-in: {formatDate(user.last_sign_in_at)}
          </p>
        </div>

        <div className="md:col-span-3 flex flex-wrap gap-x-5 gap-y-2 md:justify-end">
          {locked ? null : editing ? (
            <>
              <button type="button" disabled={busy} onClick={() => patch(form, () => setEditing(false))} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={{ ...actionStyle, color: 'var(--off-white)' }}>
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm({ first_name: user.first_name, last_name: user.last_name, email: user.email })
                  setEditing(false)
                  setError('')
                }}
                className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50"
                style={actionStyle}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={actionStyle}>
                Edit
              </button>
              {!isMe && (
                <button type="button" disabled={busy} onClick={resetPassword} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={actionStyle}>
                  Reset password
                </button>
              )}
              {!isMe && (
                <button type="button" disabled={busy} onClick={toggleActive} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={actionStyle}>
                  {user.active ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
              {user.active && user.must_change_password && !isMe && (
                <>
                  <button type="button" onClick={() => emailInvite(user, me)} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={actionStyle}>
                    Email invite
                  </button>
                  <button type="button" onClick={() => textInvite(user, me)} className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50" style={actionStyle}>
                    Text invite
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="font-body text-xs mt-3" role="alert" style={{ color: 'var(--maroon-text)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
