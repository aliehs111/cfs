import { useState } from 'react'
import { Link } from 'react-router-dom'
import ContactModal from './ContactModal'
import { BOT_CHECK_FAILED, useTurnstile } from '../lib/turnstile'

const API_BASE = import.meta.env.VITE_API_URL || ''

const STATES = {
  INTRO: 'intro',
  INPUT: 'input',
  LOADING: 'loading',
  FOLLOWUP: 'followup',
  RESULT: 'result',
}

const ROLE_HINTS = {
  owner:
    "The more you can share, the more useful our reading. Things that help: the type of space, whether it's new construction or a renovation (and if renovation, what's down now and whether there's furniture or equipment to move), rough square footage, what it's used for, and your timeline.",
  specifier:
    "The more you can share, the more useful our reading. Things that help: the project type and scope, the bid schedule or target award date, the existing flooring or specs (or whether it's still being specified), the building's status (occupied vs. vacant), and any sequencing considerations.",
}

// Groups every turn of one conversation into one saved intake on the server.
const newConversationId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null

export default function ProjectIntake() {
  const [state, setState] = useState(STATES.INTRO)
  const [role, setRole] = useState(null)
  const [messages, setMessages] = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [followupInput, setFollowupInput] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const { containerRef: botCheckRef, getToken } = useTurnstile()

  const handleStart = (chosenRole) => {
    setRole(chosenRole)
    setState(STATES.INPUT)
  }

  const sendToServer = async (newMessages, convId = conversationId) => {
    setStreamingText('')
    setError('')
    setState(STATES.LOADING)

    try {
      let turnstileToken = null
      try {
        turnstileToken = await getToken()
      } catch {
        throw new Error('bot_check')
      }
      const res = await fetch(`${API_BASE}/api/project-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          role,
          turnstile_token: turnstileToken,
          ...(convId ? { conversation_id: convId } : {}),
        }),
      })

      if (res.status === 429) throw new Error('rate_limit')
      if (res.status === 400) {
        // The server says why (bot check failed, too long, empty). Show its
        // words; only a failed bot check gets the bot-check message.
        let detail = ''
        try {
          detail = (await res.json())?.detail || ''
        } catch {
          detail = ''
        }
        if (typeof detail !== 'string' || !detail || /bot/i.test(detail)) throw new Error('bot_check')
        const err = new Error('server_message')
        err.detail = detail
        throw err
      }
      if (!res.ok) throw new Error('unknown')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // stream: true keeps a character split across two chunks (é, —) intact.
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setStreamingText((prev) => prev + chunk)
      }
      const tail = decoder.decode()
      if (tail) {
        fullText += tail
        setStreamingText((prev) => prev + tail)
      }

      if (
        fullText.includes('__CREDITS_EXHAUSTED__') ||
        fullText.includes('__SERVICE_ERROR__')
      ) {
        setStreamingText('')
        setError(
          'Our project-intake tool is temporarily unavailable. Please reach out by phone or use the contact page.'
        )
        setState(newMessages.length === 1 ? STATES.INPUT : STATES.FOLLOWUP)
        return
      }

      const userTurnCount = newMessages.filter((m) => m.role === 'user').length
      const askedQuestion = fullText.trim().endsWith('?')
      const canAskAnother = userTurnCount < 3

      let finalText = fullText
      if (askedQuestion && !canAskAnother) {
        finalText =
          fullText.trimEnd() +
          " Either way, those are exactly the kinds of things we'd walk through together — the natural next step is a quick phone call."
      }

      const updatedMessages = [
        ...newMessages,
        { role: 'assistant', content: finalText },
      ]
      setMessages(updatedMessages)
      // Clear the answer box only once the answer went through, so a failed
      // send keeps what the visitor typed.
      setFollowupInput('')

      if (askedQuestion && canAskAnother) {
        setState(STATES.FOLLOWUP)
      } else {
        setState(STATES.RESULT)
      }
    } catch (e) {
      if (e.message === 'bot_check') {
        setError(BOT_CHECK_FAILED)
      } else if (e.message === 'server_message') {
        setError(e.detail)
      } else if (e.message === 'rate_limit') {
        setError(
          "You've reached today's limit. Please come back tomorrow or contact us directly."
        )
      } else {
        setError("Couldn't send. Please try again.")
      }
      setState(newMessages.length === 1 ? STATES.INPUT : STATES.FOLLOWUP)
    }
  }

  const handleSubmitInitial = () => {
    if (currentInput.trim().length < 10) return
    const newMessages = [{ role: 'user', content: currentInput.trim() }]
    // A retry after an error keeps the same conversation.
    const convId = conversationId || newConversationId()
    setConversationId(convId)
    sendToServer(newMessages, convId)
  }

  const handleSubmitFollowup = () => {
    if (followupInput.trim().length < 2) return
    // `messages` only gains this answer once the server replies, so a retry
    // after an error doesn't send the answer twice.
    const newMessages = [
      ...messages,
      { role: 'user', content: followupInput.trim() },
    ]
    sendToServer(newMessages)
  }

  const handleReset = () => {
    setState(STATES.INTRO)
    setRole(null)
    setMessages([])
    setConversationId(null)
    setCurrentInput('')
    setFollowupInput('')
    setStreamingText('')
    setError('')
  }

  const stashAndContinue = () => {
    const finalReflection =
      messages.length > 0 ? messages[messages.length - 1].content : ''
    const firstDescription =
      messages.find((m) => m.role === 'user')?.content || ''
    let existing = {}
    try {
      existing = JSON.parse(sessionStorage.getItem('cavalier_lead_context') || '{}')
    } catch {
      existing = {}
    }
    sessionStorage.setItem(
      'cavalier_lead_context',
      JSON.stringify({
        ...existing,
        intake: {
          role,
          description: firstDescription,
          ai_output: finalReflection,
        },
      })
    )
  }

  const textareaStyle = {
    width: '100%',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--field-line)',
    padding: '16px 0',
    fontFamily: 'var(--font-body, "DM Sans"), system-ui, sans-serif',
    fontSize: '15px',
    fontWeight: 300,
    color: 'var(--off-white)',
    outline: 'none',
    resize: 'none',
    caretColor: 'var(--maroon)',
    lineHeight: 1.8,
  }

  const ctaStyle = {
    color: 'var(--off-white)',
    letterSpacing: '0.14em',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid rgba(236,228,215,0.3)',
    cursor: 'pointer',
    padding: 0,
    paddingBottom: '3px',
  }


  const lastAssistantMessage =
    [...messages].reverse().find((m) => m.role === 'assistant')?.content || ''

  return (
    <section className="pt-16 pb-24 px-6 md:px-14 w-full">
      {/* Screen readers: announce progress and the finished reply (not each streamed word). */}
      <p className="sr-only" aria-live="polite">
        {state === STATES.LOADING
          ? 'Reading your project…'
          : state === STATES.FOLLOWUP || state === STATES.RESULT
          ? lastAssistantMessage
          : ''}
      </p>
      <div className="max-w-3xl mx-auto">
        {/* Bot check: invisible unless Cloudflare asks this visitor to tick a box. */}
        <div ref={botCheckRef} className="mb-4" />
        <p
          className="uppercase mb-6"
          style={{
            color: 'var(--maroon-text)',
            letterSpacing: '0.16em',
            fontSize: '0.7rem',
            opacity: 1,
          }}
        >
          How can we help?
        </p>

        <h1
          className="font-display mb-8"
          style={{
            color: 'var(--off-white)',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          Tell us about your project.
        </h1>

        <div className="hairline mb-10" />

        {state === STATES.INTRO && (
          <div>
            <p
              className="mb-12"
              style={{
                color: 'var(--off-white)',
                opacity: 0.55,
                fontSize: '15px',
                lineHeight: 1.9,
                fontWeight: 300,
              }}
            >
              Describe what you're working on. We'll read it carefully and tell you
              what we see — the likely product fit (or, for spec'd jobs, where Cavalier
              fits), a thing or two to think about, and the natural next step.
            </p>

            <p
              className="text-xs uppercase mb-5"
              style={{
                color: 'var(--off-white)',
                opacity: 0.55,
                letterSpacing: '0.16em',
                fontSize: '0.7rem',
              }}
            >
              Which best describes you?
            </p>

            <div className="role-options">
              <RoleOption
                title="I'm planning a project for our space"
                detail="Owner, facility manager, or end user"
                onClick={() => handleStart('owner')}
              />
              <RoleOption
                title="I'm bidding or specifying a project"
                detail="General contractor, architect, or designer"
                onClick={() => handleStart('specifier')}
              />
            </div>

            {/* For people who'd rather just send a message. */}
            <p className="mt-8" style={{ fontSize: '0.8rem' }}>
              <Link
                to="/contact"
                className="transition-opacity duration-300 hover:opacity-100"
                style={{
                  color: 'var(--off-white)',
                  opacity: 0.7,
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(236,228,215,0.3)',
                  paddingBottom: '2px',
                }}
              >
                Skip this and go right to the contact form →
              </Link>
            </p>
          </div>
        )}

        {state === STATES.INPUT && (
          <div>
            <p
              className="mb-10"
              style={{
                color: 'var(--off-white)',
                opacity: 0.55,
                fontSize: '13px',
                lineHeight: 1.8,
                fontWeight: 300,
              }}
            >
              {ROLE_HINTS[role] || ROLE_HINTS.owner}
            </p>

            <textarea
              aria-label="Describe your project"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              // Short guiding questions, not a sample project: a full example
              // looked like text already typed in. Faint + italic via
              // .intake-input::placeholder in index.css.
              placeholder={
                role === 'specifier'
                  ? 'What’s the project and scope? Where is it in design or bidding, and what’s the schedule?'
                  : 'What kind of space is it? New construction or renovation? Roughly how big, and when are you hoping to start?'
              }
              className="intake-input"
              rows={7}
              style={textareaStyle}
              autoFocus
            />

            {error && (
              <p
                role="alert"
                className="text-xs mt-4"
                style={{ color: 'var(--maroon-text)', opacity: 0.9 }}
              >
                {error}
              </p>
            )}

            <div className="flex justify-between items-center mt-8">
              <span
                className="text-xs"
                style={{ color: 'var(--off-white)', opacity: 0.55, letterSpacing: '0.06em' }}
              >
                {currentInput.trim().length > 0
                  ? `${currentInput.trim().split(/\s+/).length} words`
                  : ''}
              </span>
              <button
                onClick={handleSubmitInitial}
                disabled={currentInput.trim().length < 10}
                className="tap-44 font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50 disabled:opacity-20 disabled:cursor-not-allowed"
                style={ctaStyle}
              >
                Get Cavalier's Read →
              </button>
            </div>
          </div>
        )}

        {state === STATES.LOADING && (
          <div className="py-8">
            <p
              className="text-xs font-medium tracking-widest uppercase mb-6"
              style={{ color: 'var(--off-white)', opacity: 0.55, letterSpacing: '0.14em' }}
            >
              Reading your project...
            </p>
            {streamingText && (
              <p
                className="font-display"
                style={{
                  color: 'var(--off-white)',
                  fontSize: 'clamp(18px, 2.2vw, 26px)',
                  fontWeight: 400,
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                }}
              >
                {streamingText}
              </p>
            )}
          </div>
        )}

        {state === STATES.FOLLOWUP && (
          <div>
            <p
              className="text-xs font-medium tracking-widest uppercase mb-10"
              style={{ color: 'var(--off-white)', opacity: 0.55, letterSpacing: '0.14em' }}
            >
              One question
            </p>
            <p
              className="font-display mb-12"
              style={{
                color: 'var(--off-white)',
                fontSize: 'clamp(18px, 2.2vw, 26px)',
                fontWeight: 400,
                lineHeight: 1.6,
                fontStyle: 'italic',
              }}
            >
              {lastAssistantMessage}
            </p>

            <textarea
              value={followupInput}
              onChange={(e) => setFollowupInput(e.target.value)}
              placeholder="Type your answer..."
              className="intake-input"
              aria-label="Your answer"
              rows={3}
              style={textareaStyle}
              autoFocus
            />

            {error && (
              <p
                role="alert"
                className="text-xs mt-4"
                style={{ color: 'var(--maroon-text)', opacity: 0.9 }}
              >
                {error}
              </p>
            )}

            <div className="flex justify-end mt-8">
              <button
                onClick={handleSubmitFollowup}
                disabled={followupInput.trim().length < 2}
                className="tap-44 font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50 disabled:opacity-20 disabled:cursor-not-allowed"
                style={ctaStyle}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {state === STATES.RESULT && (
          <div>
            <p
              className="text-xs font-medium tracking-widest uppercase mb-10"
              style={{ color: 'var(--off-white)', opacity: 0.55, letterSpacing: '0.14em' }}
            >
              Cavalier's Read
            </p>
            <p
              className="font-display mb-14"
              style={{
                color: 'var(--off-white)',
                fontSize: 'clamp(18px, 2.2vw, 26px)',
                fontWeight: 400,
                lineHeight: 1.6,
                fontStyle: 'italic',
              }}
            >
              {lastAssistantMessage}
            </p>
            <div className="hairline mb-10" />
            <div className="flex gap-8 items-center">
              <button
                type="button"
                onClick={() => {
                  stashAndContinue()
                  setContactOpen(true)
                }}
                className="tap-44 font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
                style={{
                  color: 'var(--maroon-text)',
                  letterSpacing: '0.14em',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(123,30,44,0.55)',
                  borderRadius: 0,
                  padding: 0,
                  paddingBottom: '3px',
                  cursor: 'pointer',
                }}
              >
                Let's Talk →
              </button>
              <button
                onClick={handleReset}
                className="tap-44 font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
                style={{
                  color: 'var(--off-white)',
                  opacity: 0.55,
                  letterSpacing: '0.14em',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </section>
  )
}

// One choice in "Which best describes you?": a hairline row with an arrow.
// Hover / keyboard focus: a stone wash fades in and the arrow turns maroon.
// Styles: .role-option in index.css.
function RoleOption({ title, detail, onClick }) {
  return (
    <button type="button" className="role-option" onClick={onClick}>
      <span>
        <span className="role-option-title">{title}</span>
        <span className="role-option-detail">{detail}</span>
      </span>
      <span className="role-option-arrow" aria-hidden="true">
        →
      </span>
    </button>
  )
}
