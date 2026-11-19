import { Link } from 'react-router-dom'
// Background (Nov 19 2026): the Motorola DynaTAC photo
// ("assets/temp_proj_photos/Vintage Motorola DynaTAC 8000X Product Shot.png"),
// an early-'80s icon nodding to Cavalier's start in 1981. Earlier tries:
// about_library.jpg, about_samples.jpg, about_cube.jpg, about_cube_moody.jpg.
//   about_phone.jpg         — web copy of the photo (phones and tablets)
//   about_phone_desktop.jpg — same photo with its plain grey backdrop
//                             stretched 1500px left, 1200px right and 110px
//                             down (made with Pillow), so it can fill any
//                             width at the page's height without cropping the
//                             phone or fading over it.
// Colour treatment, spacing and layout: the "About photo" block in index.css.
import aboutPhoto from '../../assets/about_phone.jpg'
import aboutPhotoDesktop from '../../assets/about_phone_desktop.jpg'

// Phones/tablets: only the bottom edge fades (a straight mask), where the
// photo strip ends and the page's graphite continues below it.
const bottomFade = 'linear-gradient(to bottom, #000 0%, #000 70%, transparent 100%)'

// Where the phone's left edge sits in about_phone_desktop.jpg, as a share of
// its width: (1500px padding + 1000px into the photo) / 4372px. (The image
// also has 110px of extra grey at the bottom, behind the footer.)
const PHONE_LEFT_IN_IMAGE = '57.2%'

// Founder's story (copy supplied Nov 19 2026, trimmed version). The closing line is set in
// bold below the paragraphs.
const STORY = [
  'In 1981, mobile phones were the size of bricks and construction drawings lived on paper. That was the year Randy Basso started Cavalier Flooring Systems.',
  "Back then, estimating a job meant driving to a general contractor's office or the Dodge room to pick up a set of drawings. Takeoffs were done by hand, with an architect's scale, colored pencils, and a calculator.",
  'The tools have changed dramatically, but some things have remained remarkably consistent.',
  'For Randy, business has always been about personal relationships. Knowing the people on the other end of the phone. Showing up when you said you would. And never leaving a contractor or building owner in a bad spot.',
  "Over the decades, that approach has made Randy one of the most familiar and respected names in Richmond's commercial flooring industry.",
]

const bodyText = {
  color: 'var(--off-white)',
  fontSize: '17px',
  lineHeight: 1.7,
  fontWeight: 300,
  marginBottom: 'var(--about-gap-p)',
}

export default function AboutPage() {
  return (
    // Graphite background and white text as In the Field (.field-stone in
    // index.css).
    // - flex "1 0 auto": at least down to the bottom of the window, and taller
    //   when the story needs it (plain flex-1 let the clipped section shrink
    //   to one window and cut the text off).
    // - overflow-clip, not overflow-hidden: hidden would make the section its
    //   own scroll box, and the sticky photo below couldn't pin to the window.
    <section className="field-stone relative overflow-clip" style={{ flex: '1 0 auto' }}>
      {/* Phones, tablets and small laptops (below 1280px): the photo sits
          above the text, in the flow of the page, so text never covers the
          phone. */}
      <div
        aria-hidden="true"
        className="xl:hidden relative pointer-events-none overflow-hidden"
        style={{ aspectRatio: '1672 / 941', maskImage: bottomFade, WebkitMaskImage: bottomFade }}
      >
        <img
          src={aboutPhoto}
          alt=""
          className="w-full h-full"
          style={{ objectFit: 'cover', filter: 'var(--about-photo-filter)' }}
        />
      </div>

      {/* 1280px and wider: the photo is pinned to the window (sticky) while the
          story scrolls past on the left. It's always exactly one window tall
          below the menu, so the whole phone shows at the same size however
          long the text is; at the end of the page it rests on the bottom,
          under the footer. Shifted so the phone starts a set distance after
          the text column. */}
      <div aria-hidden="true" className="hidden xl:block absolute inset-0 pointer-events-none">
        <div
          className="sticky overflow-hidden"
          style={{ top: 'var(--nav-h)', height: 'calc(100vh - var(--nav-h))' }}
        >
          <img
            src={aboutPhotoDesktop}
            alt=""
            className="absolute top-0"
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: 'none',
              left: 'var(--about-phone-left)',
              transform: `translateX(-${PHONE_LEFT_IN_IMAGE})`,
              filter: 'var(--about-photo-filter)',
            }}
          />
        </div>
      </div>

      {/* All content sits on the left, over the photo's open space */}
      {/* .about-copy: top/bottom padding shrinks with screen height (index.css) */}
      <div className="about-copy relative z-10 px-8 md:px-14 pt-8 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="xl:max-w-[var(--about-copy-width)]">
            <h1
              className="font-display"
              style={{
                color: 'var(--off-white)',
                fontSize: 'var(--about-h1-size)',
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                marginBottom: 'var(--about-gap-lg)',
              }}
            >
              {/* Always breaks as "Commercial flooring, / since 1981." */}
              Commercial flooring,
              <br />
              since 1981.
            </h1>

            <div className="hairline" style={{ marginBottom: 'var(--about-gap-md)' }} />

            {STORY.map((text) => (
              <p key={text.slice(0, 24)} className="font-body" style={bodyText}>
                {text}
              </p>
            ))}
            <p className="font-body" style={{ ...bodyText, fontWeight: 500, marginBottom: 'var(--about-gap-lg)' }}>
              The industry has changed. The way we do business hasn't.
            </p>

            <div className="hairline" style={{ marginBottom: 'var(--about-gap-lg)' }} />

            <Link
              to="/contact"
              className="font-body text-xs font-medium tracking-widest uppercase transition-opacity duration-300 hover:opacity-50!"
              style={{
                color: 'var(--off-white)',
                letterSpacing: '0.14em',
                borderBottom: '1px solid var(--off-white)',
                paddingBottom: '3px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Start a conversation →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
