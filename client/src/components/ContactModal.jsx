import { useEffect, useState } from 'react'
import ContactForm from './ContactForm'

export default function ContactModal({ isOpen, onClose }) {
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSubmitted(false)
      return
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

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
        style={{
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
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'rgba(236,228,215,0.4)',
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
            <h3
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
            </h3>
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
