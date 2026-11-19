import { Link } from 'react-router-dom'
import ContactForm from './ContactForm'
// Photo (Nov 19 2026): web copy of
// "assets/Modern Curved Healthcare Corridor.png". To change it, swap
// this import. How strongly it's darkened is set by --contact-photo-* in index.css.
import hero from '../../assets/contact_hero.jpg'

export default function Contact() {
  return (
    // Same treatment as "How can we help?" (DiscussPage.jsx): a filtered photo
    // covers the first screen and fades into the page colour.
    <section
      className="contact-over-photo relative overflow-hidden"
      style={{ minHeight: 'calc(100vh - 74px)' }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 pointer-events-none overflow-hidden"
        style={{ height: '100vh' }}
      >
        <img
          src={hero}
          alt=""
          className="w-full h-full"
          style={{ objectFit: 'cover', objectPosition: '60% 60%', filter: 'var(--contact-photo-filter)' }}
        />
        <div className="absolute inset-0" style={{ background: 'var(--contact-photo-overlay)' }} />
      </div>

      <div className="relative py-32 md:py-44 px-8 md:px-14">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-12 gap-16 md:gap-0">
            {/* Left — eyebrow + headline + optional first step */}
            <div className="md:col-span-5 md:pr-16">
              <p
                className="contact-label font-body text-xs font-medium tracking-widest uppercase mb-12"
                style={{ color: 'var(--maroon-text)', letterSpacing: '0.16em' }}
              >
                Contact
              </p>
              <h1
                className="font-display mb-8"
                style={{
                  color: 'var(--off-white)',
                  fontSize: 'clamp(28px, 3.5vw, 48px)',
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                }}
              >
                Let's talk through your project.
              </h1>

              <div className="hairline mb-8" />

              <p
                className="font-body text-xs font-medium tracking-widest uppercase mb-3"
                style={{ color: 'rgba(236,228,215,0.85)', letterSpacing: '0.16em' }}
              >
                Optional first step
              </p>
              <p
                className="font-body mb-3"
                style={{
                  color: 'rgba(236,228,215,0.9)',
                  fontSize: '14px',
                  lineHeight: 1.7,
                  fontWeight: 300,
                }}
              >
                Walk through{' '}
                <Link
                  to="/discuss"
                  style={{
                    color: 'var(--maroon-text)',
                    textDecoration: 'none',
                    borderBottom: '1px solid rgba(217,86,107,0.5)',
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
                  color: 'rgba(236,228,215,0.85)',
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
            <div className="contact-form-col md:col-span-6 md:col-start-7">
              <ContactForm theme="dark" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
