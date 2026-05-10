import { useState, useRef, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hi — I can answer questions about Cavalier Flooring Systems, what we install, and how we work. What would you like to know?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input.trim() }
    const next = [...messages, userMessage]
    setMessages(next)
    setInput('')
    setLoading(true)

    const assistantMessage = { role: 'assistant', content: '' }
    setMessages([...next, assistantMessage])

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })

      if (res.status === 429) throw new Error('rate_limit')
      if (!res.ok) throw new Error('unknown')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullText += chunk
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }

      if (
        fullText.includes('__CREDITS_EXHAUSTED__') ||
        fullText.includes('__SERVICE_ERROR__')
      ) {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content:
              "This is temporarily unavailable. Please reach out via the contact page or call (804) 254-7700.",
          }
          return updated
        })
      }
    } catch (e) {
      if (e.message === 'rate_limit') {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content:
              "You've reached today's limit for this chat. Please come back tomorrow, reach out via the contact page, or call (804) 254-7700.",
          }
          return updated
        })
      } else {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Something went wrong. Please try again.',
          }
          return updated
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ position: 'fixed', bottom: '28px', right: '28px', zIndex: 1000 }}>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '64px',
            right: 0,
            width: 'min(340px, calc(100vw - 40px))',
            maxHeight: '480px',
            backgroundColor: 'var(--charcoal)',
            border: '1px solid rgba(236,228,215,0.1)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(236,228,215,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <p
                className="font-body"
                style={{ color: 'var(--off-white)', fontSize: '13px', fontWeight: 500 }}
              >
                Ask about Cavalier
              </p>
              <p
                className="font-body"
                style={{
                  color: 'rgba(236,228,215,0.3)',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                }}
              >
                Cavalier Flooring Systems
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(236,228,215,0.3)',
                fontSize: '18px',
                lineHeight: 1,
              }}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  backgroundColor:
                    m.role === 'user' ? 'var(--maroon)' : 'rgba(236,228,215,0.06)',
                  padding: '10px 14px',
                }}
              >
                <p
                  className="font-body"
                  style={{
                    color: m.role === 'user' ? 'var(--off-white)' : 'rgba(236,228,215,0.8)',
                    fontSize: '13px',
                    lineHeight: 1.7,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.content}
                  {m.role === 'assistant' &&
                    loading &&
                    i === messages.length - 1 &&
                    m.content === '' && <span style={{ opacity: 0.4 }}>...</span>}
                </p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderTop: '1px solid rgba(236,228,215,0.08)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end',
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question..."
              rows={1}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(236,228,215,0.12)',
                padding: '6px 0',
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: 300,
                color: 'var(--off-white)',
                outline: 'none',
                resize: 'none',
                caretColor: 'var(--maroon)',
                lineHeight: 1.6,
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="font-body"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--maroon)',
                fontSize: '18px',
                lineHeight: 1,
                opacity: !input.trim() || loading ? 0.25 : 1,
                transition: 'opacity 0.2s',
                paddingBottom: '4px',
              }}
              aria-label="Send"
            >
              →
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--maroon)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(123,30,44,0.45)',
          transition: 'transform 0.2s, opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? (
          <span style={{ color: 'var(--off-white)', fontSize: '20px', lineHeight: 1 }}>×</span>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--off-white)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  )
}
