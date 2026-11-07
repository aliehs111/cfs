import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, getToken, homeFor, readError, setToken } from '../lib/auth'

const muted = 'rgba(236,228,215,0.55)'

const inputStyle = {
  width: '100%',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.2)',
  padding: '12px 0',
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: '15px',
  fontWeight: 300,
  color: 'var(--off-white)',
  outline: 'none',
  caretColor: 'var(--maroon)',
}

const buttonStyle = {
  color: 'var(--off-white)',
  letterSpacing: '0.14em',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.3)',
  cursor: 'pointer',
  padding: 0,
  paddingBottom: '3px',
}

// Only same-site paths, so ?next= can't send someone to another website.
const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : null)

export default function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const wantsChange = params.get('change') === '1'

  // null = checking, 'signin', 'change'
  const [mode, setMode] = useState(() => (getToken() ? null : 'signin'))
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!getToken()) return
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) return setMode('signin')
        const { user: me } = await res.json()
        setUser(me)
        if (me.must_change_password || wantsChange) setMode('change')
        else navigate(next || homeFor(me), { replace: true })
      })
      .catch(() => setMode('signin'))
  }, [navigate, next, wantsChange])

  const finish = (me) => navigate(next || homeFor(me), { replace: true })

  return (
    <div className="min-h-screen px-8 md:px-14 pt-16 md:pt-24 pb-20" style={{ backgroundColor: 'var(--charcoal)' }}>
      <div className="max-w-sm mx-auto md:mx-0 md:ml-[8vw]">
        <p
          className="font-body text-xs font-medium tracking-widest uppercase mb-8"
          style={{ color: 'var(--off-white)', letterSpacing: '0.16em' }}
        >
          Cavalier team
        </p>
        {mode === null && (
          <p className="font-body text-xs" style={{ color: muted }}>
            Loading...
          </p>
        )}
        {mode === 'signin' && (
          <SignInForm
            onSignedIn={(me) => {
              setUser(me)
              if (me.must_change_password) setMode('change')
              else finish(me)
            }}
          />
        )}
        {mode === 'change' && user && (
          <ChangePasswordForm
            user={user}
            firstTime={user.must_change_password}
            onDone={finish}
            onCancel={user.must_change_password ? null : () => finish(user)}
          />
        )}
      </div>
    </div>
  )
}

function Heading({ children }) {
  return (
    <h1
      className="font-display mb-8"
      style={{ color: 'var(--off-white)', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 500, lineHeight: 1.15 }}
    >
      {children}
    </h1>
  )
}

function SignInForm({ onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error(await readError(res, 'Could not sign in.'))
      const data = await res.json()
      setToken(data.token)
      onSignedIn(data.user)
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not reach the server. Check your connection.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Heading>Sign in</Heading>
      <label htmlFor="login-email" className="sr-only">
        Email
      </label>
      <input
        id="login-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="username"
        autoCapitalize="none"
        autoFocus
        required
        style={inputStyle}
      />
      <label htmlFor="login-password" className="sr-only">
        Password
      </label>
      <input
        id="login-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        required
        style={{ ...inputStyle, marginTop: '8px' }}
      />
      {error && (
        <p className="font-body text-xs mt-4" role="alert" style={{ color: 'var(--maroon-text)' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50 mt-8"
        style={{ ...buttonStyle, opacity: busy ? 0.5 : 1 }}
      >
        {busy ? 'Signing in…' : 'Sign in →'}
      </button>
      <p className="font-body mt-10" style={{ color: muted, fontSize: '13px', fontWeight: 300, lineHeight: 1.6 }}>
        Forgot your password? Ask an admin to reset it.
      </p>
    </form>
  )
}

export function ChangePasswordForm({ user, firstTime, onDone, onCancel }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (next.length < 10) return setError('Use at least 10 characters.')
    if (next !== confirm) return setError("The new passwords don't match.")
    setBusy(true)
    try {
      const res = await apiFetch('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      if (!res.ok) throw new Error(await readError(res, 'Could not change the password.'))
      const data = await res.json()
      setToken(data.token)
      onDone(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Heading>{firstTime ? 'Choose your password' : 'Change password'}</Heading>
      <p className="font-body mb-6" style={{ color: 'rgba(236,228,215,0.7)', fontSize: '14px', fontWeight: 300, lineHeight: 1.7 }}>
        {firstTime
          ? `Welcome, ${user.first_name}. Replace the temporary password with one only you know (at least 10 characters).`
          : 'At least 10 characters. Other devices will be signed out.'}
      </p>
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" value={user.email} autoComplete="username" readOnly hidden />
      <input
        type="password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder={firstTime ? 'Temporary password' : 'Current password'}
        aria-label={firstTime ? 'Temporary password' : 'Current password'}
        autoComplete="current-password"
        autoFocus
        required
        style={inputStyle}
      />
      <input
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        placeholder="New password"
        aria-label="New password"
        autoComplete="new-password"
        required
        style={{ ...inputStyle, marginTop: '8px' }}
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="New password again"
        aria-label="New password again"
        autoComplete="new-password"
        required
        style={{ ...inputStyle, marginTop: '8px' }}
      />
      {error && (
        <p className="font-body text-xs mt-4" role="alert" style={{ color: 'var(--maroon-text)' }}>
          {error}
        </p>
      )}
      <div className="flex gap-8 mt-8">
        <button
          type="submit"
          disabled={busy}
          className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
          style={{ ...buttonStyle, opacity: busy ? 0.5 : 1 }}
        >
          {busy ? 'Saving…' : 'Save password →'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
            style={{ ...buttonStyle, color: muted, borderBottom: 'none' }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
