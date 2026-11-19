// One component, two pages (Nov 19 2026). Posts belong to a section; staff
// pick it when posting (FieldPostPage). A Day in the Life is the
// tongue-in-cheek one: what crews walk into, captioned with a straight face.
export const FIELD_SECTIONS = {
  field: {
    eyebrow: '', // removed Nov 19 2026
    title: 'In the Field',
    intro: "What we're working on right now, posted by the people doing the work.",
    empty: 'Nothing posted yet. Check back soon.',
  },
  'day-in-the-life': {
    eyebrow: '', // no label for now (Nov 19 2026)
    title: 'A Day in the Life',
    intro: '', // no tagline for now (Nov 19 2026)
    empty: 'Nothing here yet. Give it a week.',
  },
}

// Where each section's posts appear on the site.
export const SECTION_PATHS = { field: '/in-the-field', 'day-in-the-life': '/day-in-the-life' }
