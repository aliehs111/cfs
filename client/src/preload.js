// Data saved into a pre-built page at build time (scripts/prerender.mjs), so
// the page's content is in the HTML for search engines and shows instantly.
// Shape: { path: '/projects/some-slug', data: { project: {...} } }.
// The build sets it on globalThis before rendering; in the browser it comes
// from an inline script in the page. Only used when the path matches.
export function readPreload(path) {
  const p = globalThis.__CAVALIER_PRELOAD__
  return p && p.path === path ? p.data : null
}
