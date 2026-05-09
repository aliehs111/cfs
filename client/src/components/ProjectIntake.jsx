import { useState } from 'react'
import { Link } from 'react-router-dom'

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

export default function ProjectIntake() {
  const [state, setState] = useState(STATES.INTRO)
  const [role, setRole] = useState(null)
  const [messages, setMessages] = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [followupInput, setFollowupInput] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')

  const handleStart = (chosenRole) => {
    setRole(chosenRole)
    setState(STATES.INPUT)
  }

  const sendToServer = async (newMessages) => {
    setStreamingText('')
    setError('')
    setState(STATES.LOADING)

    try {
      const res = await fetch(`${API_BASE}/api/project-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, role }),
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
        setStreamingText((prev) => prev + chunk)
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

      if (askedQuestion && canAskAnother) {
        setState(STATES.FOLLOWUP)
      } else {
        setState(STATES.RESULT)
      }
    } catch (e) {
      if (e.message === 'rate_limit') {
        setError(
          "You've reached today's limit. Please come back tomorrow or contact us directly."
        )
      } else {
        setError('Something went wrong. Please try again.')
      }
      setState(newMessages.length === 1 ? STATES.INPUT : STATES.FOLLOWUP)
    }
  }

  const handleSubmitInitial = () => {
    if (currentInput.trim().length < 10) return
    const newMessages = [{ role: 'user', content: currentInput.trim() }]
    setMessages(newMessages)
    sendToServer(newMessages)
  }

  const handleSubmitFollowup = () => {
    if (followupInput.trim().length < 2) return
    const newMessages = [
      ...messages,
      { role: 'user', content: followupInput.trim() },
    ]
    setMessages(newMessages)
    setFollowupInput('')
    sendToServer(newMessages)
  }

  const handleReset = () => {
    setState(STATES.INTRO)
    setRole(null)
    setMessages([])
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
    borderBottom: '1px solid rgba(236,228,215,0.15)',
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

  const roleButtonStyle = {
    color: 'var(--off-white)',
    fontFamily: 'var(--font-body, "DM Sans"), system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: 400,
    letterSpacing: '0.02em',
    background: 'transparent',
    border: '1px solid rgba(236,228,215,0.18)',
    padding: '20px 24px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease',
    width: '100%',
    lineHeight: 1.4,
  }

  const lastAssistantMessage =
    [...messages].reverse().find((m) => m.role === 'assistant')?.content || ''

  return (
    <section className="pt-16 pb-24 px-6 md:px-14 w-full">
      <div className="max-w-3xl mx-auto">
        <p
          className="uppercase mb-6"
          style={{
            color: 'var(--maroon)',
            letterSpacing: '0.16em',
            fontSize: '0.7rem',
            opacity: 0.85,
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
                opacity: 0.4,
                letterSpacing: '0.16em',
                fontSize: '0.7rem',
              }}
            >
              Which best describes you?
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleStart('owner')}
                style={roleButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--maroon)'
                  e.currentTarget.style.color = 'var(--maroon)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(236,228,215,0.18)'
                  e.currentTarget.style.color = 'var(--off-white)'
                }}
              >
                I'm planning a project for our space
                <span
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    opacity: 0.55,
                    marginTop: '4px',
                    color: 'inherit',
                  }}
                >
                  Owner, facility manager, or end-user decision-maker
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleStart('specifier')}
                style={roleButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--maroon)'
                  e.currentTarget.style.color = 'var(--maroon)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(236,228,215,0.18)'
                  e.currentTarget.style.color = 'var(--off-white)'
                }}
              >
                I'm bidding or specifying a project
                <span
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    opacity: 0.55,
                    marginTop: '4px',
                    color: 'inherit',
                  }}
                >
                  General contractor, architect, or designer
                </span>
              </button>
            </div>
          </div>
        )}

        {state === STATES.INPUT && (
          <div>
            <p
              className="mb-10"
              style={{
                color: 'var(--off-white)',
                opacity: 0.45,
                fontSize: '13px',
                lineHeight: 1.8,
                fontWeight: 300,
              }}
            >
              {ROLE_HINTS[role] || ROLE_HINTS.owner}
            </p>

            <textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder={
                role === 'specifier'
                  ? "Bidding a 25,000 sq ft retrofit at a community college library in Norfolk. Architect has spec'd LVT throughout open stacks and carpet tile in the study rooms. Award expected late June, mobilization mid-August. Building is occupied — work has to happen in two phases around the academic calendar."
                  : "We're renovating a 12,000 sq ft outpatient clinic in Charlottesville — wing of exam rooms and a waiting area. Existing sheet vinyl is curling at the seams. Need something durable, easy to clean, and that doesn't read like a hospital. Hoping to start construction in August."
              }
              rows={7}
              style={textareaStyle}
              autoFocus
            />

            {error && (
              <p
                className="text-xs mt-4"
                style={{ color: 'var(--maroon)', opacity: 0.9 }}
              >
                {error}
              </p>
            )}

            <div className="flex justify-between items-center mt-8">
              <span
                className="text-xs"
                style={{ color: 'var(--off-white)', opacity: 0.3, letterSpacing: '0.06em' }}
              >
                {currentInput.trim().length > 0
                  ? `${currentInput.trim().split(/\s+/).length} words`
                  : ''}
              </span>
              <button
                onClick={handleSubmitInitial}
                disabled={currentInput.trim().length < 10}
                className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50 disabled:opacity-20 disabled:cursor-not-allowed"
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
              style={{ color: 'var(--off-white)', opacity: 0.4, letterSpacing: '0.14em' }}
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
              style={{ color: 'var(--off-white)', opacity: 0.4, letterSpacing: '0.14em' }}
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
              rows={3}
              style={textareaStyle}
              autoFocus
            />

            {error && (
              <p
                className="text-xs mt-4"
                style={{ color: 'var(--maroon)', opacity: 0.9 }}
              >
                {error}
              </p>
            )}

            <div className="flex justify-end mt-8">
              <button
                onClick={handleSubmitFollowup}
                disabled={followupInput.trim().length < 2}
                className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50 disabled:opacity-20 disabled:cursor-not-allowed"
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
              style={{ color: 'var(--off-white)', opacity: 0.4, letterSpacing: '0.14em' }}
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
              <Link
                to="/contact"
                onClick={stashAndContinue}
                className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
                style={{
                  color: 'var(--maroon)',
                  letterSpacing: '0.14em',
                  borderBottom: '1px solid rgba(123,30,44,0.55)',
                  paddingBottom: '3px',
                  textDecoration: 'none',
                }}
              >
                Let's Talk →
              </Link>
              <button
                onClick={handleReset}
                className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50"
                style={{
                  color: 'var(--off-white)',
                  opacity: 0.4,
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
    </section>
  )
}
