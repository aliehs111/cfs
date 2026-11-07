import { Link } from 'react-router-dom'

// DRAFT (Nov 2026) for the founder to review and approve (specs.md §9).
// Keep this in step with what the site really does: if a feature changes what
// is collected or who processes it, update this page.
const LAST_UPDATED = 'November 7, 2026'
// TODO(founder): an email address for privacy requests, e.g. info@cavfloor.com.
// While empty, the page points people to the phone number and Contact page.
const PRIVACY_EMAIL = ''

const SECTIONS = [
  {
    title: 'What we collect',
    items: [
      [
        'Contact form',
        'Your name, company, email, phone number and message. If you used our project tool first, that conversation is attached to your message.',
      ],
      [
        'Project tool ("How can we help?")',
        'Whether you’re an owner or a contractor/specifier, what you write about your project, and the replies you receive. We save the conversation even if you leave before finishing, so we can follow up on projects we might be a good fit for.',
      ],
      [
        'Chat',
        'What you type is sent to our AI provider to produce a reply. We don’t keep a copy of chat conversations; we only record that a chat took place.',
      ],
      [
        'Visits',
        'Which pages are viewed, the website that linked to us, and the general type of device and browser. We don’t store your IP address for this, and we don’t use advertising or tracking cookies.',
      ],
      [
        'Staff accounts',
        'For Cavalier employees who sign in: name, email, and a record of activity such as posts, comments and sign-ins.',
      ],
    ],
  },
]

export default function PrivacyPage() {
  return (
    <section style={{ backgroundColor: 'var(--cream)' }}>
      <div className="px-8 md:px-14 pt-16 md:pt-28 pb-24">
        <div className="max-w-2xl mx-auto md:mx-0 md:ml-[8vw]">
          <p
            className="font-body text-xs font-medium tracking-widest uppercase mb-10"
            style={{ color: 'var(--maroon)', letterSpacing: '0.16em' }}
          >
            Privacy
          </p>
          <h1
            className="font-display mb-6"
            style={{
              color: 'var(--charcoal)',
              fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            How we handle your information
          </h1>
          <p style={{ ...body, opacity: 0.6, fontSize: '0.85rem' }}>Last updated {LAST_UPDATED}</p>

          <p style={{ ...body, marginTop: '2rem' }}>
            Cavalier Flooring Systems uses the information you share on this website to answer your questions and talk
            with you about your project. We keep it short and plain here; if anything is unclear, call us.
          </p>

          {SECTIONS.map((s) => (
            <div key={s.title}>
              <H2>{s.title}</H2>
              <dl>
                {s.items.map(([term, text]) => (
                  <div key={term} style={{ marginTop: '1.25rem' }}>
                    <dt style={{ ...body, fontWeight: 500, opacity: 1 }}>{term}</dt>
                    <dd style={{ ...body, margin: '0.25rem 0 0' }}>{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          <H2>How we use it</H2>
          <p style={body}>
            To reply to you, prepare for a conversation about your project, keep the website working and secure, and
            understand which pages are useful. We don’t sell your information, and we don’t share it with anyone for
            their own marketing.
          </p>

          <H2>Services that handle it for us</H2>
          <p style={body}>We use a small number of providers to run this website. They process information only to provide their service to us:</p>
          <ul style={{ ...body, paddingLeft: '1.25rem', listStyle: 'disc', marginTop: '0.75rem' }}>
            <li style={li}>
              <strong style={strong}>Anthropic</strong> provides the AI behind the chat and project tool. What you type
              there is sent to Anthropic to generate a reply. Under its commercial terms, Anthropic doesn’t use this text
              to train its models.
            </li>
            <li style={li}>
              <strong style={strong}>Cloudflare</strong> runs a quick check on our forms to tell people from automated
              spam. It looks at technical signals from your browser, such as your IP address.
            </li>
            <li style={li}>
              <strong style={strong}>Supabase</strong> (database and file storage) and <strong style={strong}>Railway</strong> (website hosting) store and serve the site’s data.
            </li>
            <li style={li}>
              <strong style={strong}>Google</strong> (Gmail) delivers the internal email that tells our team about a new
              message or project inquiry.
            </li>
          </ul>

          <H2>How long we keep it</H2>
          <p style={body}>
            Messages and project inquiries are kept as long as they’re useful for our working relationship with you, and
            deleted when you ask. Technical logs, including visit records, are deleted automatically after 90 days.
          </p>

          <H2>In the Field photos</H2>
          <p style={body}>
            Photos and videos on In the Field are posted by Cavalier staff from our own job sites. If you’d like an image
            that shows you or your property removed, let us know and we’ll take it down.
          </p>

          <H2>Your choices</H2>
          <p style={body}>
            You can ask us what information we have about you, ask us to correct it, or ask us to delete it.{' '}
            {PRIVACY_EMAIL ? (
              <>
                Email{' '}
                <a href={`mailto:${PRIVACY_EMAIL}`} style={link}>
                  {PRIVACY_EMAIL}
                </a>
                , call{' '}
              </>
            ) : (
              <>Call </>
            )}
            <a href="tel:+18042547700" style={link}>
              (804) 254-7700
            </a>
            , or use our{' '}
            <Link to="/contact" style={link}>
              contact page
            </Link>
            .
          </p>

          <H2>Children</H2>
          <p style={body}>This website is for businesses and isn’t directed at children under 13.</p>

          <H2>Changes</H2>
          <p style={body}>
            If we change how we handle information, we’ll update this page and the date at the top.
          </p>
        </div>
      </div>
    </section>
  )
}

const body = {
  color: 'var(--charcoal)',
  opacity: 0.8,
  fontSize: '0.95rem',
  lineHeight: 1.8,
  fontWeight: 300,
}
const li = { marginTop: '0.6rem' }
const strong = { fontWeight: 500 }
const link = { color: 'var(--maroon)', textDecoration: 'underline', textUnderlineOffset: '3px' }

function H2({ children }) {
  return (
    <h2
      className="font-display"
      style={{ color: 'var(--charcoal)', fontSize: '1.4rem', fontWeight: 500, marginTop: '3rem', marginBottom: '0.5rem' }}
    >
      {children}
    </h2>
  )
}
