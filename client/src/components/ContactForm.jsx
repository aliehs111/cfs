import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

const formatLeadContext = (ctx) => {
  if (!ctx?.intake) return ''
  const { role, description, ai_output } = ctx.intake
  const roleLabel =
    role === 'specifier'
      ? 'Bidding or specifying a project'
      : role === 'owner'
      ? 'Planning a project for our space'
      : 'Not specified'
  return `\n\n— From the project intake tool —\n\nRole: ${roleLabel}\n\nProject description:\n${description || ''}\n\nCavalier's read:\n${ai_output || ''}`
}

const indicatorText = (ctx) => {
  if (!ctx?.intake) return null
  return 'Your project intake will be included with this message.'
}

export default function ContactForm({ theme = 'light', onSuccess }) {
  const isDark = theme === 'dark'
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    message: '',
  })
  const [status, setStatus] = useState('idle')
  const [leadContext, setLeadContext] = useState(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cavalier_lead_context')
      if (raw) setLeadContext(JSON.parse(raw))
    } catch {
      // ignore parse errors
    }
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email) return
    setStatus('submitting')
    try {
      const messageWithContext = (form.message || '') + formatLeadContext(leadContext)
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, message: messageWithContext }),
      })
      if (!res.ok) throw new Error('Failed')
      sessionStorage.removeItem('cavalier_lead_context')
      setStatus('success')
      onSuccess?.()
    } catch {
      setStatus('error')
    }
  }

  const labelColor = isDark ? 'rgba(236,228,215,0.5)' : 'rgba(26,24,22,0.5)'
  const fieldColor = isDark ? 'var(--off-white)' : 'var(--charcoal)'
  const fieldUnderline = isDark ? 'rgba(236,228,215,0.15)' : 'rgba(26,24,22,0.15)'
  const fieldUnderlineFocus = isDark ? 'var(--off-white)' : 'var(--charcoal)'
  const successHeadingColor = isDark ? 'var(--off-white)' : 'var(--charcoal)'
  const successBodyColor = isDark ? 'rgba(236,228,215,0.55)' : 'rgba(26,24,22,0.65)'
  const indicatorColor = isDark ? 'rgba(236,228,215,0.45)' : 'rgba(26,24,22,0.5)'
  const buttonColor = isDark ? 'var(--off-white)' : 'var(--charcoal)'
  const buttonBorder = isDark ? 'var(--off-white)' : 'var(--charcoal)'

  const fieldStyle = {
    width: '100%',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${fieldUnderline}`,
    padding: '12px 0',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: '15px',
    fontWeight: 300,
    color: fieldColor,
    outline: 'none',
    transition: 'border-color 0.3s',
    borderRadius: 0,
    caretColor: 'var(--maroon)',
  }

  const labelStyle = {
    display: 'block',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: labelColor,
    marginBottom: '4px',
  }

  if (status === 'success') {
    return (
      <div className="pt-4">
        <p
          className="font-display mb-4"
          style={{ color: successHeadingColor, fontSize: '32px', fontWeight: 500 }}
        >
          Got it.
        </p>
        <p
          className="font-body mb-4"
          style={{ color: successBodyColor, fontSize: '14px', lineHeight: 1.9, fontWeight: 300 }}
        >
          We'll be in touch within one business day. No automated sequence — just a real response.
        </p>
        <p
          className="font-body"
          style={{ color: successBodyColor, fontSize: '14px', lineHeight: 1.9, fontWeight: 300 }}
        >
          If you don't see a reply, check your spam folder — our emails sometimes land there.
        </p>
      </div>
    )
  }

  const indicator = indicatorText(leadContext)

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            type="text"
            name="name"
            required
            value={form.name}
            onChange={handleChange}
            style={fieldStyle}
            onFocus={(e) => (e.target.style.borderBottomColor = fieldUnderlineFocus)}
            onBlur={(e) => (e.target.style.borderBottomColor = fieldUnderline)}
          />
        </div>
        <div>
          <label style={labelStyle}>Company</label>
          <input
            type="text"
            name="company"
            value={form.company}
            onChange={handleChange}
            style={fieldStyle}
            onFocus={(e) => (e.target.style.borderBottomColor = fieldUnderlineFocus)}
            onBlur={(e) => (e.target.style.borderBottomColor = fieldUnderline)}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Email *</label>
        <input
          type="email"
          name="email"
          required
          value={form.email}
          onChange={handleChange}
          style={fieldStyle}
          onFocus={(e) => (e.target.style.borderBottomColor = fieldUnderlineFocus)}
          onBlur={(e) => (e.target.style.borderBottomColor = fieldUnderline)}
        />
      </div>

      <div>
        <label style={labelStyle}>Phone (Optional — in case our email lands in your spam)</label>
        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          style={fieldStyle}
          onFocus={(e) => (e.target.style.borderBottomColor = fieldUnderlineFocus)}
          onBlur={(e) => (e.target.style.borderBottomColor = fieldUnderline)}
        />
      </div>

      <div>
        <label style={labelStyle}>What can we help with? (Optional)</label>
        <textarea
          name="message"
          rows={4}
          value={form.message}
          onChange={handleChange}
          style={{ ...fieldStyle, resize: 'none' }}
          onFocus={(e) => (e.target.style.borderBottomColor = fieldUnderlineFocus)}
          onBlur={(e) => (e.target.style.borderBottomColor = fieldUnderline)}
        />
      </div>

      {indicator && (
        <p
          className="font-body text-xs"
          style={{ color: indicatorColor, fontSize: '12px', lineHeight: 1.7, fontWeight: 300 }}
        >
          {indicator}
        </p>
      )}

      {status === 'error' && (
        <p className="font-body text-xs" style={{ color: 'var(--maroon)' }}>
          Something went wrong. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50 disabled:opacity-30"
        style={{
          color: buttonColor,
          letterSpacing: '0.14em',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          paddingBottom: '3px',
          borderBottom: `1px solid ${buttonBorder}`,
        }}
      >
        {status === 'submitting' ? 'Sending...' : 'Send Message →'}
      </button>
    </form>
  )
}
