import { useEffect, useId, useRef, useState } from 'react'
import ContactForm from './ContactForm'

// The open dialog is its own component, so closing it unmounts it and the
// "sent" state starts fresh next time.
export default function ContactModal({ isOpen, onClose }) {
  return isOpen ? <OpenContactModal onClose={onClose} /> : null
}

function OpenContactModal({ onClose }) {
  const [submitted, setSubmitted] = useState(false)
  const dialog = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const opener = document.activeElement
    // Move focus into the dialog so screen readers announce it.
    dialog.current?.focus()
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      // Keep Tab inside the dialog while it's open.
      if (e.key === 'Tab' && dialog.current) {
        const items = dialog.current.querySelectorAll('button, [href], input:not([tabindex="-1"]), textarea, select')
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(26,24,22,0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          outline: 'none',
          backgroundColor: 'var(--charcoal)',
          border: '1px solid rgba(236,228,215,0.1)',
          maxWidth: '560px',
          width: '100%',
          padding: 'clamp(28px, 5vw, 48px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          position: 'relative',
          marginTop: 'clamp(40px, 8vh, 80px)',
          marginBottom: '40px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'rgba(236,228,215,0.55)',
            cursor: 'pointer',
            padding: '8px',
            fontSize: '22px',
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {!submitted && (
          <>
            <h2
              id={titleId}
              className="font-display mb-3"
              style={{
                color: 'var(--off-white)',
                fontSize: 'clamp(22px, 3vw, 30px)',
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                fontStyle: 'italic',
              }}
            >
              Let's continue this conversation.
            </h2>
            <p
              className="font-body mb-10"
              style={{
                color: 'rgba(236,228,215,0.55)',
                fontSize: '14px',
                lineHeight: 1.7,
                fontWeight: 300,
              }}
            >
              Send a message — anything you've shared with our intake tool will come with it.
            </p>
          </>
        )}

        <ContactForm theme="dark" onSuccess={() => setSubmitted(true)} />
      </div>
    </div>
  )
}
