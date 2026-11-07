import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, getToken, isAdmin, readError } from '../lib/auth'

// Each admin picks which email alerts go to their own address. Shared inboxes
// and other people are managed on Admin → Notifications.

const muted = 'rgba(236,228,215,0.55)'
const soft = 'rgba(236,228,215,0.75)'
const hairline = '1px solid rgba(236,228,215,0.08)'

export default function MyAlertsPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const toLogin = () => navigate('/login?next=/my-alerts', { replace: true })
    if (!getToken()) return toLogin()
    let cancelled = false
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) return toLogin()
        const { user } = await res.json()
        if (user.must_change_password) return toLogin()
        if (!isAdmin(user)) throw new Error('Email alerts are available to admins.')
        const r = await apiFetch('/api/me/alerts')
        if (!r.ok) throw new Error(await readError(r, 'Could not load your alerts.'))
        const json = await r.json()
        if (!cancelled) setData(json)
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [navigate])

  const setSubscribed = (alertType, subscribed) =>
    setData((d) => ({ ...d, alerts: d.alerts.map((a) => (a.alert_type === alertType ? { ...a, subscribed } : a)) }))

  const suggested = data?.alerts.filter((a) => a.suggested) || []
  const others = data?.alerts.filter((a) => !a.suggested) || []

  return (
    <div className="min-h-screen px-8 md:px-14 pt-16 md:pt-24 pb-20" style={{ backgroundColor: 'var(--charcoal)' }}>
      <div className="max-w-3xl mx-auto">
        <Link
          to="/admin"
          className="font-body text-xs font-medium tracking-widest uppercase hover:opacity-50"
          style={{ color: muted, letterSpacing: '0.14em', textDecoration: 'none' }}
        >
          ← Admin
        </Link>
        <h1 className="font-display mt-8 mb-3" style={{ color: 'var(--off-white)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 500, lineHeight: 1.1 }}>
          My email alerts
        </h1>

        {error && (
          <p role="alert" className="font-body text-sm mt-6" style={{ color: 'var(--maroon-text)' }}>
            {error}
          </p>
        )}
        {!data && !error && <p className="font-body text-xs mt-6" style={{ color: muted }}>Loading...</p>}

        {data && (
          <>
            <p className="font-body mb-12" style={{ color: soft, fontSize: '14px', fontWeight: 300, lineHeight: 1.7 }}>
              Choose what you&apos;d like to be emailed about. Alerts go to <span style={{ color: 'var(--off-white)' }}>{data.email}</span>.
              Changes save as you tick.
            </p>

            <Group title="Most people want these" alerts={suggested} onChange={setSubscribed} />
            <Group title="Other alerts" alerts={others} onChange={setSubscribed} />

            <p className="font-body mt-12" style={{ color: muted, fontSize: '13px', fontWeight: 300, lineHeight: 1.7 }}>
              To send alerts to a shared inbox or someone without an account, use{' '}
              <Link to="/admin?tab=notifications" style={{ color: 'var(--off-white)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                Admin → Notifications
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Group({ title, alerts, onChange }) {
  if (!alerts.length) return null
  return (
    <fieldset className="mb-12" style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className="font-body text-xs font-medium tracking-widest uppercase mb-4" style={{ color: muted, letterSpacing: '0.14em' }}>
        {title}
      </legend>
      {alerts.map((a) => (
        <AlertRow key={a.alert_type} alert={a} onChange={onChange} />
      ))}
    </fieldset>
  )
}

function AlertRow({ alert, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const id = `my-alert-${alert.alert_type}`

  const toggle = async (e) => {
    const subscribed = e.target.checked
    onChange(alert.alert_type, subscribed)
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`/api/me/alerts/${alert.alert_type}`, {
        method: 'PUT',
        body: JSON.stringify({ subscribed }),
      })
      if (!res.ok) throw new Error(await readError(res, 'Could not save.'))
    } catch (err) {
      onChange(alert.alert_type, !subscribed) // put it back
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="py-5" style={{ borderTop: hairline }}>
      <label htmlFor={id} className="flex items-start gap-4" style={{ cursor: busy ? 'wait' : 'pointer' }}>
        <input
          id={id}
          type="checkbox"
          checked={alert.subscribed}
          onChange={toggle}
          disabled={busy}
          style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--maroon)', flexShrink: 0 }}
        />
        <span>
          <span className="font-display block" style={{ color: 'var(--off-white)', fontSize: '16px', fontWeight: 500 }}>
            {alert.label}
          </span>
          <span className="font-body block mt-1" style={{ color: muted, fontSize: '13px', fontWeight: 300, lineHeight: 1.6 }}>
            {alert.description}
          </span>
          {!alert.enabled && (
            <span className="font-body block mt-1" style={{ color: 'var(--maroon-text)', fontSize: '12px' }}>
              This alert is switched off for everyone on Admin → Notifications, so nothing is sent until it&apos;s turned back on.
            </span>
          )}
        </span>
      </label>
      {error && (
        <p role="alert" className="font-body text-xs mt-2 ml-9" style={{ color: 'var(--maroon-text)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
