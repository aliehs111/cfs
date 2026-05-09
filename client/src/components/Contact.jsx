import { Link } from 'react-router-dom'
import ContactForm from './ContactForm'

export default function Contact() {
  return (
    <section
      className="py-32 md:py-44 px-8 md:px-14"
      style={{ backgroundColor: 'var(--cream)' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-12 gap-16 md:gap-0">
          {/* Left — eyebrow + headline + optional first step */}
          <div className="md:col-span-5 md:pr-16">
            <p
              className="font-body text-xs font-medium tracking-widest uppercase mb-12"
              style={{ color: 'var(--maroon)', letterSpacing: '0.16em' }}
            >
              Contact
            </p>
            <h2
              className="font-display mb-8"
              style={{
                color: 'var(--charcoal)',
                fontSize: 'clamp(28px, 3.5vw, 48px)',
                fontWeight: 500,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              Let's talk through your project.
            </h2>

            <div className="hairline-dark mb-8" />

            <p
              className="font-body text-xs font-medium tracking-widest uppercase mb-3"
              style={{ color: 'rgba(26,24,22,0.4)', letterSpacing: '0.16em' }}
            >
              Optional first step
            </p>
            <p
              className="font-body mb-3"
              style={{
                color: 'rgba(26,24,22,0.7)',
                fontSize: '14px',
                lineHeight: 1.7,
                fontWeight: 300,
              }}
            >
              Walk through{' '}
              <Link
                to="/discuss"
                style={{
                  color: 'var(--maroon)',
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(123,30,44,0.4)',
                  paddingBottom: '1px',
                }}
              >
                How can we help?
              </Link>{' '}
              first — describe your project, get our read back, then send a message with that context attached.
            </p>
            <p
              className="font-body"
              style={{
                color: 'rgba(26,24,22,0.6)',
                fontSize: '13px',
                lineHeight: 1.7,
                fontWeight: 300,
                fontStyle: 'italic',
              }}
            >
              Or just send a message here — that works too.
            </p>
          </div>

          {/* Right — form */}
          <div className="md:col-span-6 md:col-start-7">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  )
}
