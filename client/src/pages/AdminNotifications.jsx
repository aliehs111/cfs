import { useEffect, useState } from 'react'
import { apiFetch, readError } from '../lib/auth'

const muted = 'rgba(236,228,215,0.4)'
const soft = 'rgba(236,228,215,0.7)'
const hairline = '1px solid rgba(236,228,215,0.08)'

const labelStyle = {
  color: muted,
  letterSpacing: '0.12em',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
}

export default function AdminNotifications({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/admin/notifications')
      .then(async (res) => {
        if (res.status === 401) return onUnauthorized()
        if (!res.ok) throw new Error(await readError(res, 'Could not load notifications.'))
        const json = await res.json()
        if (!cancelled) setData(json)
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [onUnauthorized])

  const replaceAlert = (updated) =>
    setData((d) => ({
      ...d,
      alerts: d.alerts.map((a) => (a.alert_type === updated.alert_type ? { ...a, ...updated } : a)),
    }))

  if (error) {
    return (
      <p className="font-body text-xs" style={{ color: 'var(--maroon)' }}>
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
      <p className="font-body mb-10" style={{ color: soft, fontSize: '14px', fontWeight: 300, lineHeight: 1.7, maxWidth: '40rem' }}>
        Choose who gets an email for each event. Recipients don&apos;t need an account. Changes take effect
        immediately.
        {data.sender && (
          <>
            {' '}
            Alerts are sent from <span style={{ color: 'var(--off-white)' }}>{data.sender}</span>.
          </>
        )}
      </p>

      {!data.email_configured && (
        <p className="font-body text-xs mb-8" style={{ color: 'var(--maroon)' }}>
          Email isn&apos;t set up on the server yet (SMTP_USER and SMTP_PASS), so no alerts will be sent.
        </p>
      )}

      {data.alerts.map((a) => (
        <AlertRow key={a.alert_type} alert={a} onSaved={replaceAlert} onUnauthorized={onUnauthorized} />
      ))}
    </div>
  )
}

function AlertRow({ alert, onSaved, onUnauthorized }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null) // { kind: 'ok' | 'error', text }

  const save = async (enabled, recipients) => {
    setBusy(true)
    setStatus(null)
    try {
      const res = await apiFetch(`/api/admin/notifications/${alert.alert_type}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled, recipients }),
      })
      if (res.status === 401) return onUnauthorized()
      if (!res.ok) throw new Error(await readError(res, 'Could not save.'))
      onSaved(await res.json())
      return true
    } catch (e) {
      setStatus({ kind: 'error', text: e.message })
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async (e) => {
    e.preventDefault()
    const emails = draft
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!emails.length) return
    if (await save(alert.enabled, [...alert.recipients, ...emails])) setDraft('')
  }

  const remove = (email) => save(alert.enabled, alert.recipients.filter((r) => r !== email))
  const toggle = () => save(!alert.enabled, alert.recipients)

  const sendTest = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const res = await apiFetch(`/api/admin/notifications/${alert.alert_type}/test`, {
        method: 'POST',
      })
      if (res.status === 401) return onUnauthorized()
      if (!res.ok) throw new Error(await readError(res, 'Test failed.'))
      const json = await res.json()
      setStatus({ kind: 'ok', text: `Test sent to ${json.recipients.length} recipient${json.recipients.length === 1 ? '' : 's'}.` })
    } catch (e) {
      setStatus({ kind: 'error', text: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="py-8" style={{ borderTop: hairline, opacity: busy ? 0.6 : 1, transition: 'opacity 200ms' }}>
      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-5">
          <p className="font-display" style={{ color: 'var(--off-white)', fontSize: '16px', fontWeight: 500 }}>
            {alert.label}
          </p>
          <p className="font-body mt-1" style={{ color: muted, fontSize: '13px', fontWeight: 300, lineHeight: 1.6 }}>
            {alert.description}
          </p>
          <div className="flex gap-6 mt-4">
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              role="switch"
              aria-checked={alert.enabled}
              className="font-body text-xs font-medium tracking-widest uppercase"
              style={{ ...labelStyle, color: alert.enabled ? 'var(--off-white)' : 'var(--maroon)' }}
            >
              {alert.enabled ? '● On' : '○ Off'}
            </button>
            <button
              type="button"
              onClick={sendTest}
              disabled={busy || alert.recipients.length === 0}
              className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
              style={{ ...labelStyle, opacity: alert.recipients.length === 0 ? 0.4 : 1 }}
            >
              Send test
            </button>
          </div>
        </div>

        <div className="md:col-span-7">
          {alert.recipients.length === 0 && (
            <p className="font-body" style={{ color: muted, fontSize: '13px', fontWeight: 300 }}>
              No recipients, so this alert isn&apos;t sent.
            </p>
          )}
          <ul>
            {alert.recipients.map((email) => (
              <li key={email} className="flex items-center justify-between py-1" style={{ maxWidth: '28rem' }}>
                <span className="font-body" style={{ color: soft, fontSize: '13px', fontWeight: 300, wordBreak: 'break-all' }}>
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => remove(email)}
                  disabled={busy}
                  aria-label={`Remove ${email}`}
                  className="font-body text-xs transition-opacity duration-300 hover:opacity-50 ml-4"
                  style={labelStyle}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={add} className="flex items-end gap-4 mt-3" style={{ maxWidth: '28rem' }}>
            <label htmlFor={`add-${alert.alert_type}`} className="sr-only">
              Add recipient for {alert.label}
            </label>
            <input
              id={`add-${alert.alert_type}`}
              type="text"
              inputMode="email"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add email address"
              style={{
                flex: 1,
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
              }}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
              style={{ ...labelStyle, color: 'var(--off-white)', opacity: draft.trim() ? 1 : 0.4 }}
            >
              Add
            </button>
          </form>
          {status && (
            <p
              className="font-body text-xs mt-3"
              role="status"
              style={{ color: status.kind === 'ok' ? soft : 'var(--maroon)' }}
            >
              {status.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
