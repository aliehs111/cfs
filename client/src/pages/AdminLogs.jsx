import { useEffect, useMemo, useState } from 'react'
import { apiFetch, readError } from '../lib/auth'

const muted = 'rgba(236,228,215,0.4)'
const soft = 'rgba(236,228,215,0.7)'
const hairline = '1px solid rgba(236,228,215,0.08)'

const CATEGORIES = [
  ['activity', 'Everything except page visits'],
  ['all', 'Everything'],
  ['leads', 'Leads (contact form, intakes)'],
  ['field', 'In the Field (posts, comments)'],
  ['accounts', 'Sign-ins and user accounts'],
  ['visits', 'Page visits'],
  ['chat', 'Chat'],
  ['email', 'Email alerts'],
  ['admin', 'Admin settings'],
  ['protection', 'Spam and rate limits'],
  ['errors', 'Server errors'],
]

// Plain-English names for event codes. Unknown codes show as-is.
const EVENT_LABELS = {
  'page.visit': 'Page visit',
  'contact.submitted': 'Contact form sent',
  'intake.started': 'Project intake started',
  'intake.turn': 'Project intake reply',
  'intake.completed': 'Project intake finished',
  'intake.abandoned': 'Project intake left unfinished',
  'chat.started': 'Chat started',
  'chat.message': 'Chat message',
  'field_post.created': 'Post created',
  'field_post.edited': 'Post edited',
  'field_post.deleted': 'Post deleted',
  'comment.created': 'Comment',
  'comment.edited': 'Comment edited',
  'comment.deleted': 'Comment deleted',
  'auth.signed_in': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.password_changed': 'Password changed',
  'user.created': 'User created',
  'user.updated': 'User changed',
  'user.password_reset': 'Password reset',
  'notifications.updated': 'Alert settings changed',
  'alert.sent': 'Alert email sent',
  'alert.test_sent': 'Test email sent',
  'alert.failed': 'Alert email failed',
  'alert.skipped': 'Alert email skipped',
  'rate_limit.hit': 'Rate limit hit',
  'spam.rejected': 'Spam blocked',
  'server.error': 'Server error',
}

const LEVEL_COLORS = { error: 'var(--maroon)', warning: '#c9a24a', info: muted }

const fieldStyle = {
  backgroundColor: 'var(--charcoal)',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.2)',
  padding: '8px 0',
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: '14px',
  fontWeight: 300,
  color: 'var(--off-white)',
  outline: 'none',
  width: '100%',
  minWidth: 0,
  colorScheme: 'dark',
}

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: muted,
  marginBottom: '2px',
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

// <input type="date"> gives YYYY-MM-DD; treat it as Eastern midnight.
function easternMidnight(dateStr, addDays = 0) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + addDays)
  const ymd = d.toISOString().slice(0, 10)
  const offset = new Date(`${ymd}T12:00:00Z`).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
  const match = offset.match(/GMT([+-]\d+)/)
  const hours = match ? parseInt(match[1], 10) : -5
  const sign = hours <= 0 ? '-' : '+'
  return `${ymd}T00:00:00${sign}${String(Math.abs(hours)).padStart(2, '0')}:00`
}

function who(log) {
  if (log.actor_name) return log.actor_name
  if (log.actor_id) return 'Former user'
  if (['page.visit', 'contact.submitted', 'chat.started', 'chat.message', 'spam.rejected', 'rate_limit.hit'].includes(log.event) || log.event.startsWith('intake.'))
    return 'Visitor'
  return 'System'
}

function summaryOf(log) {
  const m = log.metadata || {}
  if (log.event === 'page.visit') {
    const parts = [m.path, m.device, m.browser]
    const ref = m.referrer && !m.referrer.includes(window.location.host) ? `from ${m.referrer}` : null
    return [...parts, ref].filter(Boolean).join(' · ')
  }
  return log.message || log.route || ''
}

export default function AdminLogs({ me, onUnauthorized }) {
  const [filters, setFilters] = useState({ category: 'activity', level: '', actor_id: '', from: '', to: '', q: '' })
  const [search, setSearch] = useState('')
  const [result, setResult] = useState({ key: null, logs: [], hasMore: false, error: '' })
  const [more, setMore] = useState(false)
  const [summary, setSummary] = useState(null)
  const [people, setPeople] = useState([])
  const [open, setOpen] = useState(null)

  const params = useMemo(() => {
    const p = new URLSearchParams({ category: filters.category })
    if (filters.level) p.set('level', filters.level)
    if (filters.actor_id) p.set('actor_id', filters.actor_id)
    if (filters.from) p.set('since', easternMidnight(filters.from))
    if (filters.to) p.set('until', easternMidnight(filters.to, 1))
    if (filters.q) p.set('q', filters.q)
    return p
  }, [filters])
  const key = params.toString()

  useEffect(() => {
    let cancelled = false
    apiFetch(`/api/admin/logs?${key}`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return onUnauthorized()
        if (!res.ok) throw new Error(await readError(res, 'Could not load logs.'))
        const data = await res.json()
        if (!cancelled) setResult({ key, logs: data.logs, hasMore: data.has_more, error: '' })
      })
      .catch((e) => !cancelled && setResult({ key, logs: [], hasMore: false, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [key, onUnauthorized])

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/admin/logs/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setSummary(d))
      .catch(() => {})
    apiFetch('/api/admin/users')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setPeople(d.users))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Search waits until typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() })), 400)
    return () => clearTimeout(t)
  }, [search])

  const loadMore = async () => {
    const last = result.logs[result.logs.length - 1]
    if (!last) return
    setMore(true)
    try {
      const p = new URLSearchParams(params)
      p.set('before', last.created_at)
      const res = await apiFetch(`/api/admin/logs?${p}`)
      if (!res.ok) throw new Error(await readError(res, 'Could not load more.'))
      const data = await res.json()
      setResult((r) => ({ ...r, logs: [...r.logs, ...data.logs], hasMore: data.has_more }))
    } catch (e) {
      setResult((r) => ({ ...r, error: e.message }))
    } finally {
      setMore(false)
    }
  }

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const loading = result.key !== key
  const filtered = filters.level || filters.actor_id || filters.from || filters.to || filters.q || filters.category !== 'activity'

  return (
    <div>
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px mb-12" style={{ backgroundColor: 'rgba(236,228,215,0.08)' }}>
          {[
            ['Visits', summary.visits_week, 'last 7 days'],
            ['Contact leads', summary.leads_month, 'this month'],
            ['Project intakes', summary.intakes_month, 'this month'],
            ['Field posts', summary.posts_month, 'this month'],
            ['Errors', summary.errors_day, 'last 24 hours'],
          ].map(([label, value, sub]) => (
            <div key={label} className="p-5" style={{ backgroundColor: 'var(--charcoal)' }}>
              <p style={labelStyle}>{label}</p>
              <p
                className="font-display"
                style={{
                  color: label === 'Errors' && value > 0 ? 'var(--maroon)' : 'var(--off-white)',
                  fontSize: '28px',
                  fontWeight: 500,
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {value.toLocaleString()}
              </p>
              <p style={{ color: muted, fontSize: '12px', fontWeight: 300 }}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-x-6 gap-y-5 mb-10">
        <div className="col-span-2">
          <label style={labelStyle} htmlFor="log-category">Show</label>
          <select id="log-category" value={filters.category} onChange={set('category')} style={fieldStyle}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="log-level">Level</label>
          <select id="log-level" value={filters.level} onChange={set('level')} style={fieldStyle}>
            <option value="">Any</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="log-person">Person</label>
          <select id="log-person" value={filters.actor_id} onChange={set('actor_id')} style={fieldStyle}>
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="log-from">From</label>
          <input id="log-from" type="date" value={filters.from} onChange={set('from')} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="log-to">To</label>
          <input id="log-to" type="date" value={filters.to} onChange={set('to')} style={fieldStyle} />
        </div>
        <div className="col-span-2 md:col-span-5">
          <label style={labelStyle} htmlFor="log-search">Search</label>
          <input
            id="log-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Names, captions, error messages…"
            style={fieldStyle}
          />
        </div>
        <div className="flex items-end">
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFilters({ category: 'activity', level: '', actor_id: '', from: '', to: '', q: '' })
              }}
              className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50"
              style={{ color: muted, letterSpacing: '0.12em', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading && <p className="font-body text-xs" style={{ color: muted }}>Loading...</p>}
      {result.error && (
        <p className="font-body text-xs mb-6" style={{ color: 'var(--maroon)' }}>
          {result.error}
        </p>
      )}
      {!loading && !result.error && result.logs.length === 0 && (
        <p className="font-body" style={{ color: muted, fontSize: '15px', fontWeight: 300 }}>
          Nothing matches these filters.
        </p>
      )}

      {!loading && (
        <div>
          {result.logs.map((log) => {
            const isOpen = open === log.id
            const meta = log.metadata && Object.keys(log.metadata).length ? log.metadata : null
            return (
              <div key={log.id} style={{ borderTop: hairline }}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : log.id)}
                  aria-expanded={isOpen}
                  className="w-full text-left grid grid-cols-12 gap-x-4 gap-y-1 py-3"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                >
                  <span className="col-span-6 md:col-span-2 font-body" style={{ color: muted, fontSize: '12px', fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(log.created_at)}
                  </span>
                  <span className="col-span-6 md:col-span-2 font-body md:order-none text-right md:text-left" style={{ color: soft, fontSize: '13px', fontWeight: 300 }}>
                    {who(log)}
                  </span>
                  <span className="col-span-12 md:col-span-3 font-body" style={{ fontSize: '13px', fontWeight: 400, color: 'var(--off-white)' }}>
                    {log.level !== 'info' && (
                      <span aria-label={log.level} style={{ color: LEVEL_COLORS[log.level], marginRight: '6px' }}>
                        ●
                      </span>
                    )}
                    {EVENT_LABELS[log.event] || log.event}
                  </span>
                  <span className="col-span-12 md:col-span-5 font-body" style={{ color: soft, fontSize: '13px', fontWeight: 300, overflowWrap: 'anywhere' }}>
                    {summaryOf(log)}
                  </span>
                </button>
                {isOpen && (
                  <div className="pb-4 font-body" style={{ fontSize: '12px', color: soft, fontWeight: 300 }}>
                    <p style={{ color: muted }}>
                      {log.event}
                      {log.route ? ` · ${log.route}` : ''}
                      {log.entity_type ? ` · ${log.entity_type} ${log.entity_id || ''}` : ''}
                    </p>
                    {meta && (
                      <pre
                        className="mt-2 p-4 whitespace-pre-wrap break-words"
                        style={{ backgroundColor: 'rgba(236,228,215,0.04)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', lineHeight: 1.6 }}
                      >
                        {JSON.stringify(meta, null, 2)}
                      </pre>
                    )}
                    {me?.role !== 'dev_admin' && (log.event === 'server.error' || log.event === 'auth.login_failed') && (
                      <p className="mt-2" style={{ color: muted }}>
                        Technical details are visible to the developer account only.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && result.hasMore && (
        <div className="mt-10">
          <button
            type="button"
            onClick={loadMore}
            disabled={more}
            className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50"
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
            {more ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
