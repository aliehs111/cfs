import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLogs from './AdminLogs'
import AdminNotifications from './AdminNotifications'
import AdminProjects from './AdminProjects'
import AdminUsers from './AdminUsers'
import { apiFetch, getToken, homeFor, isAdmin, ROLE_LABELS as ACCOUNT_ROLES, setToken } from '../lib/auth'

const TABS = {
  SUBMISSIONS: 'submissions',
  INTAKES: 'intakes',
  PROJECTS: 'projects',
  USERS: 'users',
  NOTIFICATIONS: 'notifications',
  LOGS: 'logs',
}

const ROLE_LABELS = {
  owner: 'Owner / Facility',
  specifier: 'GC / Specifier',
}

const quietButton = {
  color: 'rgba(236,228,215,0.4)',
  letterSpacing: '0.14em',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [me, setMe] = useState(null)
  // null = checking; true = signed in as an admin; 'forbidden' = signed in without admin access
  const [authed, setAuthed] = useState(null)
  const [tab, setTab] = useState(TABS.SUBMISSIONS)
  const [contacts, setContacts] = useState([])
  const [intakes, setIntakes] = useState([])
  const [error, setError] = useState('')
  const [listState, setListState] = useState({ tab: null, error: '' }) // which list finished loading
  const [expanded, setExpanded] = useState(null)

  const goToLogin = useCallback(() => navigate('/login?next=/admin', { replace: true }), [navigate])

  useEffect(() => {
    if (!getToken()) return goToLogin()
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) return goToLogin()
        const { user } = await res.json()
        if (user.must_change_password) return goToLogin()
        setMe(user)
        setAuthed(isAdmin(user) ? true : 'forbidden')
      })
      .catch(() => setError('Could not reach the server.'))
  }, [goToLogin])

  const handleUnauthorized = useCallback(() => goToLogin(), [goToLogin])

  useEffect(() => {
    if (authed !== true) return
    const lists = {
      [TABS.SUBMISSIONS]: ['/api/admin/contacts', 'contacts', setContacts, 'Could not load submissions.'],
      [TABS.INTAKES]: ['/api/admin/intakes', 'intakes', setIntakes, 'Could not load project intakes.'],
    }
    if (!lists[tab]) return
    const [path, key, setter, failMessage] = lists[tab]
    let cancelled = false
    apiFetch(path)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return goToLogin()
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (cancelled) return
        setter(data[key] || [])
        setListState({ tab, error: '' })
      })
      .catch(() => !cancelled && setListState({ tab, error: failMessage }))
    return () => {
      cancelled = true
      setListState({ tab: null, error: '' })
    }
  }, [authed, tab, goToLogin])

  const isListTab = tab === TABS.SUBMISSIONS || tab === TABS.INTAKES
  const loading = isListTab && listState.tab !== tab
  const listError = listState.tab === tab ? listState.error : ''

  const handleLogout = () => {
    setToken(null)
    navigate('/login', { replace: true })
  }

  return (
    <div
      className="min-h-screen px-8 md:px-14 pt-16 md:pt-24 pb-20"
      style={{ backgroundColor: 'var(--charcoal)' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-8">
          <p
            className="font-body text-xs font-medium tracking-widest uppercase"
            style={{ color: 'var(--off-white)', letterSpacing: '0.16em' }}
          >
            Admin
          </p>
          {me && (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <span className="font-body" style={{ color: 'rgba(236,228,215,0.6)', fontSize: '13px', fontWeight: 300 }}>
                {me.name} · {ACCOUNT_ROLES[me.role]}
              </span>
              <Link
                to="/login?change=1&next=/admin"
                className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
                style={quietButton}
              >
                Change password
              </Link>
              <button
                onClick={handleLogout}
                className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
                style={quietButton}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {authed === null && (
          <p className="font-body text-xs" style={{ color: 'rgba(236,228,215,0.4)' }}>
            {error || 'Loading...'}
          </p>
        )}

        {authed === 'forbidden' && (
          <p className="font-body" style={{ color: 'rgba(236,228,215,0.7)', fontSize: '15px', fontWeight: 300 }}>
            Your account doesn&apos;t have admin access.{' '}
            <Link to={homeFor(me)} style={{ color: 'var(--maroon)' }}>
              Continue to the site →
            </Link>
          </p>
        )}

        {authed === true && (
          <div>
            <div className="mb-12">
              <nav className="flex flex-wrap gap-x-8 gap-y-3">
                {Object.entries({
                  [TABS.SUBMISSIONS]: 'Submissions',
                  [TABS.INTAKES]: 'Project Intakes',
                  [TABS.PROJECTS]: 'Projects',
                  [TABS.USERS]: 'Users',
                  [TABS.NOTIFICATIONS]: 'Notifications',
                  [TABS.LOGS]: 'Logs',
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
            </div>

            {tab === TABS.PROJECTS && <AdminProjects onUnauthorized={handleUnauthorized} />}
            {tab === TABS.USERS && <AdminUsers me={me} onUnauthorized={handleUnauthorized} />}
            {tab === TABS.LOGS && <AdminLogs me={me} onUnauthorized={handleUnauthorized} />}

            {loading && (
              <p
                className="font-body text-xs"
                style={{ color: 'rgba(236,228,215,0.4)' }}
              >
                Loading...
              </p>
            )}
            {listError && (
              <p
                className="font-body text-xs mb-6"
                style={{ color: 'var(--maroon)' }}
              >
                {listError}
              </p>
            )}

            {tab === TABS.SUBMISSIONS && !loading && (
              <>
                {contacts.length === 0 && !listError && (
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

            {tab === TABS.NOTIFICATIONS && (
              <AdminNotifications onUnauthorized={handleUnauthorized} />
            )}

            {tab === TABS.INTAKES && !loading && (
              <>
                {intakes.length === 0 && !listError && (
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
                            {i.status === 'in_progress' && (
                              <p
                                className="font-body text-xs mt-1"
                                style={{ color: 'rgba(236,228,215,0.5)' }}
                              >
                                Left without finishing
                              </p>
                            )}
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
                        {isOpen && Array.isArray(i.transcript) && i.transcript.length > 0 && (
                          <div className="mt-6" style={{ maxWidth: '44rem' }}>
                            {i.transcript.map((m, idx) => (
                              <div key={idx} className="mb-5">
                                <p
                                  className="font-body text-xs font-medium tracking-widest uppercase mb-2"
                                  style={{
                                    color: m.role === 'user' ? 'rgba(236,228,215,0.4)' : 'var(--maroon)',
                                    letterSpacing: '0.12em',
                                  }}
                                >
                                  {m.role === 'user' ? 'Visitor' : "Cavalier's read"}
                                </p>
                                <pre
                                  className="font-body p-4 whitespace-pre-wrap break-words"
                                  style={{
                                    color: 'rgba(236,228,215,0.7)',
                                    fontSize: '13px',
                                    lineHeight: 1.8,
                                    fontWeight: 300,
                                    backgroundColor: 'rgba(236,228,215,0.04)',
                                    fontFamily: '"DM Sans", system-ui, sans-serif',
                                  }}
                                >
                                  {m.content}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                        {isOpen && !(Array.isArray(i.transcript) && i.transcript.length > 0) && (
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
