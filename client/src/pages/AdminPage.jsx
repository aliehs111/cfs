import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

const TABS = { SUBMISSIONS: 'submissions', INTAKES: 'intakes' }

const ROLE_LABELS = {
  owner: 'Owner / Facility',
  specifier: 'GC / Specifier',
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(null)
  const [tab, setTab] = useState(TABS.SUBMISSIONS)
  const [contacts, setContacts] = useState([])
  const [intakes, setIntakes] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/session`, { credentials: 'include' })
      .then((res) => setAuthed(res.ok))
      .catch(() => setAuthed(false))
  }, [])

  useEffect(() => {
    if (authed !== true) return
    if (tab === TABS.SUBMISSIONS) fetchContacts()
    if (tab === TABS.INTAKES) fetchIntakes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, tab])

  const fetchContacts = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts`, { credentials: 'include' })
      if (res.status === 401) {
        setAuthed(false)
        return
      }
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setContacts(data.contacts || [])
    } catch {
      setError('Could not load submissions.')
    } finally {
      setLoading(false)
    }
  }

  const fetchIntakes = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/intakes`, { credentials: 'include' })
      if (res.status === 401) {
        setAuthed(false)
        return
      }
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setIntakes(data.intakes || [])
    } catch {
      setError('Could not load project intakes.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 401) {
        setError('Incorrect password.')
        return
      }
      if (!res.ok) throw new Error('failed')
      setPassword('')
      setAuthed(true)
    } catch {
      setError('Could not sign in.')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/admin/logout`, { method: 'POST', credentials: 'include' })
    } catch {
      /* ignore */
    }
    setAuthed(false)
    setContacts([])
    setIntakes([])
  }

  return (
    <div
      className="min-h-screen px-8 md:px-14 pt-16 md:pt-24 pb-20"
      style={{ backgroundColor: 'var(--charcoal)' }}
    >
      <div className="max-w-5xl mx-auto">
        <p
          className="font-body text-xs font-medium tracking-widest uppercase mb-8"
          style={{ color: 'var(--off-white)', letterSpacing: '0.16em' }}
        >
          Admin
        </p>

        {authed === null && (
          <p
            className="font-body text-xs"
            style={{ color: 'rgba(236,228,215,0.4)' }}
          >
            Loading...
          </p>
        )}

        {authed === false && (
          <form onSubmit={handleLogin} className="max-w-sm">
            <h2
              className="font-display mb-8"
              style={{
                color: 'var(--off-white)',
                fontSize: 'clamp(24px, 3vw, 36px)',
                fontWeight: 500,
                lineHeight: 1.15,
              }}
            >
              Sign in
            </h2>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
              autoComplete="current-password"
              style={{
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
              }}
            />
            {error && (
              <p
                className="font-body text-xs mt-4"
                style={{ color: 'var(--maroon)' }}
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50 mt-8"
              style={{
                color: 'var(--off-white)',
                letterSpacing: '0.14em',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid rgba(236,228,215,0.3)',
                cursor: 'pointer',
                padding: 0,
                paddingBottom: '3px',
              }}
            >
              Enter →
            </button>
          </form>
        )}

        {authed === true && (
          <div>
            <div className="flex items-center justify-between mb-12">
              <nav className="flex gap-8">
                {Object.entries({
                  [TABS.SUBMISSIONS]: 'Submissions',
                  [TABS.INTAKES]: 'Project Intakes',
                }).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className="font-body text-xs font-medium tracking-widest uppercase transition-all duration-300"
                    style={{
                      color: tab === key ? 'var(--off-white)' : 'var(--maroon)',
                      letterSpacing: '0.14em',
                      background: 'none',
                      border: 'none',
                      borderBottom:
                        tab === key
                          ? '1px solid rgba(236,228,215,0.4)'
                          : '1px solid transparent',
                      paddingBottom: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <button
                onClick={handleLogout}
                className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
                style={{
                  color: 'rgba(236,228,215,0.4)',
                  letterSpacing: '0.14em',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Sign out
              </button>
            </div>

            {loading && (
              <p
                className="font-body text-xs"
                style={{ color: 'rgba(236,228,215,0.4)' }}
              >
                Loading...
              </p>
            )}
            {error && (
              <p
                className="font-body text-xs mb-6"
                style={{ color: 'var(--maroon)' }}
              >
                {error}
              </p>
            )}

            {tab === TABS.SUBMISSIONS && !loading && (
              <>
                {contacts.length === 0 && !error && (
                  <p
                    className="font-body"
                    style={{
                      color: 'rgba(236,228,215,0.4)',
                      fontSize: '15px',
                      fontWeight: 300,
                    }}
                  >
                    No submissions yet.
                  </p>
                )}
                <div>
                  {contacts.map((c) => {
                    const isOpen = expanded === c.id
                    const date = c.created_at
                      ? new Date(c.created_at).toLocaleString()
                      : ''
                    return (
                      <div
                        key={c.id}
                        className="py-6"
                        style={{ borderTop: '1px solid rgba(236,228,215,0.08)' }}
                      >
                        <div
                          className="grid md:grid-cols-12 gap-4 cursor-pointer"
                          onClick={() => setExpanded(isOpen ? null : c.id)}
                        >
                          <div className="md:col-span-3">
                            <p
                              className="font-display"
                              style={{
                                color: 'var(--off-white)',
                                fontSize: '16px',
                                fontWeight: 500,
                              }}
                            >
                              {c.name || '—'}
                            </p>
                            {c.company && (
                              <p
                                className="font-body"
                                style={{
                                  color: 'rgba(236,228,215,0.5)',
                                  fontSize: '13px',
                                  fontWeight: 300,
                                }}
                              >
                                {c.company}
                              </p>
                            )}
                          </div>
                          <div className="md:col-span-4">
                            <a
                              href={`mailto:${c.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-body hover:opacity-70"
                              style={{
                                color: 'var(--maroon)',
                                fontSize: '13px',
                                fontWeight: 400,
                              }}
                            >
                              {c.email}
                            </a>
                            {c.phone && (
                              <a
                                href={`tel:${c.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-body block hover:opacity-70"
                                style={{
                                  color: 'rgba(236,228,215,0.5)',
                                  fontSize: '13px',
                                  fontWeight: 300,
                                  marginTop: '2px',
                                }}
                              >
                                {c.phone}
                              </a>
                            )}
                          </div>
                          <div className="md:col-span-3">
                            <p
                              className="font-body"
                              style={{
                                color: 'rgba(236,228,215,0.4)',
                                fontSize: '12px',
                                fontWeight: 300,
                              }}
                            >
                              {date}
                            </p>
                          </div>
                          <div className="md:col-span-2 md:text-right">
                            <span
                              className="font-body text-xs font-medium tracking-widest uppercase"
                              style={{
                                color: 'rgba(236,228,215,0.4)',
                                letterSpacing: '0.12em',
                              }}
                            >
                              {isOpen ? 'Close' : 'Open'}
                            </span>
                          </div>
                        </div>
                        {isOpen && c.message && (
                          <pre
                            className="font-body mt-6 p-6 whitespace-pre-wrap break-words"
                            style={{
                              color: 'rgba(236,228,215,0.7)',
                              fontSize: '13px',
                              lineHeight: 1.8,
                              fontWeight: 300,
                              backgroundColor: 'rgba(236,228,215,0.04)',
                              fontFamily: '"DM Sans", system-ui, sans-serif',
                            }}
                          >
                            {c.message}
                          </pre>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {tab === TABS.INTAKES && !loading && (
              <>
                {intakes.length === 0 && !error && (
                  <p
                    className="font-body"
                    style={{
                      color: 'rgba(236,228,215,0.4)',
                      fontSize: '15px',
                      fontWeight: 300,
                    }}
                  >
                    No project intakes yet.
                  </p>
                )}
                <div>
                  {intakes.map((i) => {
                    const isOpen = expanded === `intake-${i.id}`
                    const date = i.created_at
                      ? new Date(i.created_at).toLocaleString()
                      : ''
                    const roleLabel = ROLE_LABELS[i.role] || '—'
                    const preview = (i.project_description || '')
                      .replace(/\s+/g, ' ')
                      .slice(0, 140)
                    return (
                      <div
                        key={i.id}
                        className="py-6"
                        style={{ borderTop: '1px solid rgba(236,228,215,0.08)' }}
                      >
                        <div
                          className="grid md:grid-cols-12 gap-4 cursor-pointer"
                          onClick={() =>
                            setExpanded(isOpen ? null : `intake-${i.id}`)
                          }
                        >
                          <div className="md:col-span-3">
                            <p
                              className="font-body"
                              style={{
                                color: 'rgba(236,228,215,0.4)',
                                fontSize: '12px',
                                fontWeight: 300,
                              }}
                            >
                              {date}
                            </p>
                            <p
                              className="font-body text-xs font-medium tracking-widest uppercase mt-1"
                              style={{
                                color: 'var(--maroon)',
                                letterSpacing: '0.12em',
                              }}
                            >
                              {roleLabel}
                            </p>
                          </div>
                          <div className="md:col-span-7">
                            <p
                              className="font-body"
                              style={{
                                color: 'rgba(236,228,215,0.7)',
                                fontSize: '13px',
                                lineHeight: 1.6,
                                fontWeight: 300,
                              }}
                            >
                              {preview}
                              {(i.project_description || '').length > 140
                                ? '…'
                                : ''}
                            </p>
                          </div>
                          <div className="md:col-span-2 md:text-right">
                            <span
                              className="font-body text-xs font-medium tracking-widest uppercase"
                              style={{
                                color: 'rgba(236,228,215,0.4)',
                                letterSpacing: '0.12em',
                              }}
                            >
                              {isOpen ? 'Close' : 'Open'}
                            </span>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="mt-6 grid md:grid-cols-2 gap-6">
                            <div>
                              <p
                                className="font-body text-xs font-medium tracking-widest uppercase mb-3"
                                style={{
                                  color: 'rgba(236,228,215,0.4)',
                                  letterSpacing: '0.12em',
                                }}
                              >
                                Project description
                              </p>
                              <pre
                                className="font-body p-4 whitespace-pre-wrap break-words"
                                style={{
                                  color: 'rgba(236,228,215,0.7)',
                                  fontSize: '13px',
                                  lineHeight: 1.8,
                                  fontWeight: 300,
                                  backgroundColor: 'rgba(236,228,215,0.04)',
                                  fontFamily:
                                    '"DM Sans", system-ui, sans-serif',
                                }}
                              >
                                {i.project_description || '—'}
                              </pre>
                            </div>
                            <div>
                              <p
                                className="font-body text-xs font-medium tracking-widest uppercase mb-3"
                                style={{
                                  color: 'rgba(236,228,215,0.4)',
                                  letterSpacing: '0.12em',
                                }}
                              >
                                Cavalier's read
                              </p>
                              <pre
                                className="font-body p-4 whitespace-pre-wrap break-words"
                                style={{
                                  color: 'rgba(236,228,215,0.7)',
                                  fontSize: '13px',
                                  lineHeight: 1.8,
                                  fontWeight: 300,
                                  backgroundColor: 'rgba(236,228,215,0.04)',
                                  fontFamily:
                                    '"DM Sans", system-ui, sans-serif',
                                }}
                              >
                                {i.ai_output || '—'}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
