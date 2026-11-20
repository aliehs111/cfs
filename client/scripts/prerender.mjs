// Saves each public page as ready-made HTML after `vite build`, so search
// engines, link previews (LinkedIn, email, Slack) and AI search tools see the
// page's own title, description and content without running JavaScript.
//
//   dist/index.html            → home
//   dist/about/index.html      → /about   (and so on)
//   dist/projects/<slug>/index.html → each public project
//   dist/sitemap.xml, dist/robots.txt (Sitemap line) when VITE_SITE_URL is set
//
// Railway's static server (Caddy) already serves /about/index.html for /about.
// Project data comes from the API at build time (VITE_API_URL). If the API
// can't be reached, the static pages are still built and project pages fall
// back to loading in the browser, as before. Re-deploy the frontend after
// adding or editing projects to refresh their pages and the sitemap.
//
// Run by `npm run build`. Never fails the build over SEO extras.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ssrEntry = path.join(root, 'dist-ssr', 'entry-server.js')

const { render, PAGES, metaForPath, metaForProject, absolute, SITE_URL, SITE_NAME } = await import(
  pathToFileURL(ssrEntry).href
)

const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8')
const API_BASE = (process.env.VITE_API_URL || '').replace(/\/+$/, '')

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function headTags(meta) {
  const url = meta.noindex ? '' : absolute(meta.path)
  const image = absolute(meta.image || '/og-image.jpg')
  const tags = [
    `<title data-seo>${esc(meta.title)}</title>`,
    `<meta data-seo name="description" content="${esc(meta.description)}" />`,
    meta.noindex && `<meta data-seo name="robots" content="noindex" />`,
    url && `<link data-seo rel="canonical" href="${esc(url)}" />`,
    `<meta data-seo property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta data-seo property="og:type" content="${esc(meta.type || 'website')}" />`,
    `<meta data-seo property="og:title" content="${esc(meta.title)}" />`,
    `<meta data-seo property="og:description" content="${esc(meta.description)}" />`,
    url && `<meta data-seo property="og:url" content="${esc(url)}" />`,
    image && `<meta data-seo property="og:image" content="${esc(image)}" />`,
    `<meta data-seo name="twitter:card" content="summary_large_image" />`,
  ]
  return tags.filter(Boolean).join('\n    ')
}

function page(url, meta, preload = null) {
  const appHtml = render(url, preload)
  // JSON inside <script>: escape "<" so text can't close the tag early.
  const preloadScript = preload
    ? `<script>window.__CAVALIER_PRELOAD__=${JSON.stringify(preload).replace(/</g, '\\u003c')}</script>\n    `
    : ''
  let html = template
    .replace(/<title data-seo>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta data-seo name="description"[^>]*>\s*/, '')
    // Function replacers: a `$` in project text ($&, $1…) would otherwise be
    // read as a replacement pattern and garble the page.
    .replace('<!--seo-tags-->', () => headTags(meta))
    .replace('<div id="root"></div>', () => `${preloadScript}<div id="root">${appHtml}</div>`)
  // The home page uses the 2026 palette (PaletteScope in App.jsx); set it in
  // the HTML so it shows correctly before JavaScript runs.
  if (url === '/') html = html.replace('<html lang="en">', '<html lang="en" data-palette="2026">')
  return html
}

async function write(url, html) {
  const file = url === '/' ? path.join(dist, 'index.html') : path.join(dist, url, 'index.html')
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, html)
}

async function fetchProjects() {
  if (!API_BASE) {
    console.warn('[prerender] VITE_API_URL not set: skipping project pages.')
    return []
  }
  try {
    const res = await fetch(`${API_BASE}/api/projects`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { projects = [] } = await res.json()
    return projects.filter((p) => p && p.slug)
  } catch (err) {
    console.warn(`[prerender] Couldn't load projects (${err.message}): skipping project pages.`)
    return []
  }
}

const projects = await fetchProjects()
let count = 0

// Staff pages: an empty page (no content, noindex) so they don't briefly
// show the home page before the app loads. Written first so a public page
// can never be overwritten by one.
const shell = template.replace('<!--seo-tags-->', '<meta data-seo name="robots" content="noindex" />')
for (const url of ['/admin', '/login', '/my-alerts', '/in-the-field/post']) {
  await write(url, shell)
}

// Public pages. dist/index.html becomes the home page. Caddy also serves it
// for URLs with no file (unknown pages, projects added since the last
// deploy); the app then shows the right page once JavaScript loads.
for (const url of Object.keys(PAGES)) {
  const preload = url === '/projects' && projects.length ? { path: url, data: { projects } } : null
  await write(url, page(url, metaForPath(url), preload))
  count++
}

for (const project of projects) {
  const meta = metaForProject(project)
  await write(meta.path, page(meta.path, meta, { path: meta.path, data: { project } }))
  count++
}

// Sitemap and robots.txt Sitemap line need the real domain.
if (SITE_URL) {
  const today = new Date().toISOString().slice(0, 10)
  const entries = [
    ...Object.keys(PAGES).map((url) => ({ loc: absolute(url), lastmod: today })),
    ...projects.map((p) => ({
      loc: absolute(`/projects/${p.slug}`),
      lastmod: String(p.updated_at || p.created_at || today).slice(0, 10),
    })),
  ]
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map((e) => `  <url><loc>${esc(e.loc)}</loc><lastmod>${e.lastmod}</lastmod></url>`).join('\n') +
    '\n</urlset>\n'
  await fs.writeFile(path.join(dist, 'sitemap.xml'), xml)
  const robotsFile = path.join(dist, 'robots.txt')
  const robots = await fs.readFile(robotsFile, 'utf8')
  await fs.writeFile(robotsFile, `${robots.trimEnd()}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
  console.log(`[prerender] sitemap.xml: ${entries.length} URLs`)
} else {
  console.warn('[prerender] VITE_SITE_URL not set: no sitemap, canonical links or og:url (set it at the domain move).')
}

console.log(`[prerender] ${count} pages saved (${projects.length} projects).`)
